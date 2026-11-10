'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  CreditCard,
  Building,
  Calendar,
  User,
  Phone,
  BookOpen,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Customer, PaymentMethod, PaymentArrangement, SaleType } from '@/types';
import { formatDate } from '@/utils/formatters';

export interface CheckoutSubmitData {
  paymentArrangement: PaymentArrangement;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  walkInName?: string;
  walkInPhone?: string;
  dueDate?: string;
  discountConcession?: number;
}

interface PaymentCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  saleType: SaleType;
  selectedCustomer: Customer | null;
  onOpenCustomerModal: () => void;
  onConfirmSale: (data: CheckoutSubmitData) => Promise<void>;
  isProcessing?: boolean;
}

export default function PaymentCheckoutModal({
  isOpen,
  onClose,
  subtotal,
  discountAmount,
  totalAmount,
  saleType,
  selectedCustomer,
  onOpenCustomerModal,
  onConfirmSale,
  isProcessing = false,
}: PaymentCheckoutModalProps) {
  // 1. Payment Tabs: 'PAID' (Default) or 'CREDIT'
  const [activeTab, setActiveTab] = useState<'PAID' | 'CREDIT'>('PAID');

  // 2. Paid Tab State
  const [receivedInput, setReceivedInput] = useState<string>('');
  const [paidPaymentMethod, setPaidPaymentMethod] = useState<PaymentMethod>('CASH');
  const [applyShortfallAsConcession, setApplyShortfallAsConcession] = useState<boolean>(true);

  // 3. Credit Tab State (Advance down-payment)
  const [creditAdvanceInput, setCreditAdvanceInput] = useState<string>('0');
  const [creditPaymentMethod, setCreditPaymentMethod] = useState<PaymentMethod>('CASH');

  // 4. Walk-in Customer Info
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('');

  // 5. Due Date (default 30 days)
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Reset / synchronize state whenever modal opens or totalAmount changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('PAID');
      setReceivedInput(totalAmount > 0 ? String(totalAmount) : '0');
      setPaidPaymentMethod('CASH');
      setApplyShortfallAsConcession(true);

      setCreditAdvanceInput('0');
      setCreditPaymentMethod('CASH');

      if (selectedCustomer) {
        setWalkInName(selectedCustomer.name || '');
        setWalkInPhone(selectedCustomer.phone || '');
      } else {
        setWalkInName('');
        setWalkInPhone('');
      }
    }
  }, [isOpen, totalAmount, selectedCustomer]);

  // Derived effective received amount in Paid tab
  const parsedReceived = useMemo(() => {
    const val = parseFloat(receivedInput);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [receivedInput]);

  // Derived advance amount in Credit tab
  const parsedCreditAdvance = useMemo(() => {
    const val = parseFloat(creditAdvanceInput);
    if (isNaN(val) || val < 0) return 0;
    return Math.min(val, totalAmount);
  }, [creditAdvanceInput, totalAmount]);

  // Shortfall or Change calculations for Paid tab
  const changeAmount = Math.max(0, parsedReceived - totalAmount);
  const shortfallAmount = Math.max(0, totalAmount - parsedReceived);

  // Remaining khata amount
  const remainingKhataAmount = useMemo(() => {
    if (activeTab === 'CREDIT') {
      return Math.max(0, totalAmount - parsedCreditAdvance);
    }
    if (parsedReceived < totalAmount && !applyShortfallAsConcession) {
      return shortfallAmount;
    }
    return 0;
  }, [activeTab, totalAmount, parsedCreditAdvance, parsedReceived, applyShortfallAsConcession, shortfallAmount]);

  const isCreditActive = remainingKhataAmount > 0 || activeTab === 'CREDIT';

  // Wholesale Credit Limit Calculations
  const currentCustomerOutstanding = selectedCustomer?.currentOutstanding || 0;
  const customerCreditLimit = selectedCustomer?.creditLimit || 0;
  const newProjectedOutstanding = currentCustomerOutstanding + remainingKhataAmount;
  const isCreditLimitExceeded =
    selectedCustomer &&
    customerCreditLimit > 0 &&
    newProjectedOutstanding > customerCreditLimit &&
    remainingKhataAmount > 0;

  // Validation: Missing walk-in credit details
  const isWalkInCreditMissing =
    saleType === 'WALK_IN' && isCreditActive && (!walkInName.trim() || !walkInPhone.trim());

  // Validation: Missing wholesale customer
  const isWholesaleCustomerMissing =
    saleType !== 'WALK_IN' && !selectedCustomer;

  // Final submit disabled flag
  const isSubmitDisabled = isProcessing || isWalkInCreditMissing || isWholesaleCustomerMissing;

  // Submit Handler
  const handleConfirm = async () => {
    if (isSubmitDisabled) return;

    let finalArrangement: PaymentArrangement = 'FULL';
    let concession = 0;
    let effectivePaid = 0;
    let effectiveMethod: PaymentMethod = 'CASH';

    if (activeTab === 'CREDIT') {
      if (parsedCreditAdvance >= totalAmount) {
        finalArrangement = 'FULL';
        effectivePaid = totalAmount;
        effectiveMethod = creditPaymentMethod;
      } else if (parsedCreditAdvance > 0) {
        finalArrangement = 'PARTIAL';
        effectivePaid = parsedCreditAdvance;
        effectiveMethod = creditPaymentMethod;
      } else {
        finalArrangement = 'CREDIT';
        effectivePaid = 0;
        effectiveMethod = 'CREDIT_30D';
      }
    } else {
      // PAID tab
      if (parsedReceived >= totalAmount) {
        finalArrangement = 'FULL';
        effectivePaid = totalAmount;
        effectiveMethod = paidPaymentMethod;
      } else if (parsedReceived > 0) {
        if (applyShortfallAsConcession) {
          // e.g. Customer paid Rs. 1000 instead of 1050; waive 50 as concession
          concession = shortfallAmount;
          finalArrangement = 'FULL';
          effectivePaid = parsedReceived;
          effectiveMethod = paidPaymentMethod;
        } else {
          // Unpaid balance goes to Khata (Partial payment)
          finalArrangement = 'PARTIAL';
          effectivePaid = parsedReceived;
          effectiveMethod = paidPaymentMethod;
        }
      } else {
        finalArrangement = 'CREDIT';
        effectivePaid = 0;
        effectiveMethod = 'CREDIT_30D';
      }
    }

    await onConfirmSale({
      paymentArrangement: finalArrangement,
      paymentMethod: effectiveMethod,
      amountReceived: effectivePaid,
      walkInName: walkInName.trim() || undefined,
      walkInPhone: walkInPhone.trim() || undefined,
      dueDate: isCreditActive ? dueDate : undefined,
      discountConcession: concession,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden max-h-[92vh] transition-colors duration-200 ${isCreditLimitExceeded ? 'border-rose-300' : 'border-slate-200'
          }`}
      >
        {/* 1. Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${isCreditLimitExceeded ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50/80 border-slate-100'
            }`}
        >
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Complete Sale & Payment</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase">
                {saleType}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Review payment amount, select khata terms, and confirm customer record
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
          {/* Top 2 Tabs: Paid vs Credit */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('PAID')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'PAID'
                ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Paid (Naqd / Online)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CREDIT')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'CREDIT'
                ? 'bg-white text-amber-700 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Credit (Khata / Udhaar)</span>
            </button>
          </div>

          {/* Bill Summary Banner */}
          <div className="bg-[#f0f9f4] border border-[#ceead6] rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-600 block">Total Bill Amount</span>
              {discountAmount > 0 && (
                <span className="text-[11px] text-emerald-700 font-medium">
                  Subtotal: Rs. {subtotal.toLocaleString()} • Discount: -Rs. {discountAmount.toLocaleString()}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-[#137333] tracking-tight">
                Rs. {totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* TAB 1: PAID */}
          {activeTab === 'PAID' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Amount Received Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <label htmlFor="modal-amount-received" className="font-bold text-slate-800">
                    Amount Received from Customer (Rs.) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setReceivedInput(String(totalAmount))}
                    className="text-emerald-700 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Exact: Rs. {totalAmount.toLocaleString()}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Rs.
                  </span>
                  <input
                    id="modal-amount-received"
                    type="number"
                    min={0}
                    value={receivedInput}
                    onChange={(e) => setReceivedInput(e.target.value)}
                    placeholder="Enter received amount"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    autoFocus
                  />
                </div>

                {/* Calculation Note: Change or Shortfall */}
                {parsedReceived > totalAmount && (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <span className="text-emerald-800 font-semibold">Change to Return to Customer:</span>
                    <span className="text-emerald-900 font-black text-sm">
                      Rs. {changeAmount.toLocaleString()}
                    </span>
                  </div>
                )}

                {parsedReceived === totalAmount && totalAmount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold px-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Exact full payment received (Rs. 0 Change)</span>
                  </div>
                )}

                {parsedReceived < totalAmount && (
                  <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between text-amber-900 font-bold">
                      <span>Shortfall (Kam Raqam Di):</span>
                      <span className="text-sm font-black text-amber-950">
                        Rs. {shortfallAmount.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-normal">
                      Customer gave Rs. {parsedReceived.toLocaleString()} instead of Rs. {totalAmount.toLocaleString()}.
                    </p>
                    <label className="flex items-center gap-2 text-slate-800 font-semibold cursor-pointer pt-1 border-t border-amber-200/60">
                      <input
                        type="checkbox"
                        checked={applyShortfallAsConcession}
                        onChange={(e) => setApplyShortfallAsConcession(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-[11px]">
                        Waive remaining <strong>Rs. {shortfallAmount.toLocaleString()}</strong> as discount / concession (Bill marked Paid)
                      </span>
                    </label>
                    {!applyShortfallAsConcession && (
                      <p className="text-[11px] text-amber-900 font-bold pt-1">
                        👉 Remaining Rs. {shortfallAmount.toLocaleString()} will be recorded as Khata / Udhaar for this customer.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidPaymentMethod('CASH')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${paidPaymentMethod === 'CASH'
                      ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 shadow-2xs ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaidPaymentMethod('PAYPAK_CARD')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${paidPaymentMethod === 'PAYPAK_CARD'
                      ? 'border-blue-500 bg-blue-50/80 text-blue-800 shadow-2xs ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaidPaymentMethod('BANK_TRANSFER')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${paidPaymentMethod === 'BANK_TRANSFER'
                      ? 'border-indigo-500 bg-indigo-50/80 text-indigo-800 shadow-2xs ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>Bank / Online</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREDIT (KHATA) */}
          {activeTab === 'CREDIT' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Advance / Partial Payment Input Field (Requested by User) */}
              <div className="space-y-1.5 bg-amber-50/60 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                  <label htmlFor="modal-credit-advance" className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-700" />
                    <span>Advance / Partial Amount Paid Now (Rs.)</span>
                  </label>
                  <span className="text-[11px] text-amber-700 font-semibold">(Optional)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-tight">
                  Agar customer abhi kuch peshgi (down-payment) de raha ho to yahan likhein:
                </p>
                <div className="relative mt-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Rs.
                  </span>
                  <input
                    id="modal-credit-advance"
                    type="number"
                    min={0}
                    max={totalAmount}
                    value={creditAdvanceInput}
                    onChange={(e) => setCreditAdvanceInput(e.target.value)}
                    placeholder="0 (Agar abhi kuch nahi diya)"
                    className="w-full pl-11 pr-4 py-2 bg-white border border-amber-300 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>

                {/* Advance Payment Method if Advance > 0 */}
                {parsedCreditAdvance > 0 && (
                  <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Advance Payment Method:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCreditPaymentMethod('CASH')}
                        className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${creditPaymentMethod === 'CASH'
                          ? 'border-emerald-500 bg-white text-emerald-800 ring-1 ring-emerald-500'
                          : 'border-amber-200 bg-amber-50/50 text-slate-700 hover:bg-white'
                          }`}
                      >
                        <Banknote className="w-3 h-3" />
                        <span>Cash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditPaymentMethod('PAYPAK_CARD')}
                        className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${creditPaymentMethod === 'PAYPAK_CARD'
                          ? 'border-blue-500 bg-white text-blue-800 ring-1 ring-blue-500'
                          : 'border-amber-200 bg-amber-50/50 text-slate-700 hover:bg-white'
                          }`}
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Card</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreditPaymentMethod('BANK_TRANSFER')}
                        className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${creditPaymentMethod === 'BANK_TRANSFER'
                          ? 'border-indigo-500 bg-white text-indigo-800 ring-1 ring-indigo-500'
                          : 'border-amber-200 bg-amber-50/50 text-slate-700 hover:bg-white'
                          }`}
                      >
                        <Building className="w-3 h-3" />
                        <span>Bank</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Calculation Summary */}
                <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs font-bold">
                  <span className="text-amber-900">Remaining Khata Balance (Udhaar):</span>
                  <span className="text-amber-950 font-black text-sm">
                    Rs. {remainingKhataAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Due Date Picker */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Payment Due Date (Wapsi Ki Tareekh)</span>
                  </span>
                  {dueDate && (
                    <span className="text-[11px] font-semibold text-amber-700">
                      {formatDate(dueDate)}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-amber-500 shadow-2xs"
                />
              </div>
            </div>
          )}

          {/* 3. Customer Info Section */}
          <div className="pt-2 border-t border-slate-100">
            {saleType === 'WALK_IN' ? (
              /* Walk-in Customer Details */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Customer Details</span>
                    {isCreditActive ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                        Required for Khata (Lazmi)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">(Optional)</span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400">Walk-in</span>
                </div>

                {isCreditActive && (
                  <p className="text-[11px] text-amber-800 font-medium bg-amber-50 border border-amber-200/80 rounded-lg p-2 leading-relaxed">
                    Udhaar / Khata sale ke liye customer ka Name aur Phone Number lazmi likhein taake ledger record ban sake.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={isCreditActive ? 'Customer Name *' : 'Customer Name'}
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:bg-white focus:ring-1 ${isCreditActive && !walkInName.trim()
                        ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-emerald-500'
                        }`}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={isCreditActive ? 'Phone (e.g. 0300...) *' : 'Phone (e.g. 0300...)'}
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:bg-white focus:ring-1 ${isCreditActive && !walkInPhone.trim()
                        ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-emerald-500'
                        }`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Wholesale / Distributor Customer Account & Credit Status */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Customer Account & Credit Ledger</span>
                  </span>
                  <button
                    type="button"
                    onClick={onOpenCustomerModal}
                    className="text-blue-600 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    {selectedCustomer ? 'Switch Customer' : '+ Select Customer'}
                  </button>
                </div>

                {!selectedCustomer ? (
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                    <span>No customer selected. {saleType} requires an account.</span>
                    <button
                      type="button"
                      onClick={onOpenCustomerModal}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-[11px] hover:bg-blue-700 transition-colors"
                    >
                      Assign Customer
                    </button>
                  </div>
                ) : (
                  <div
                    className={`rounded-xl border p-3 text-xs space-y-2.5 transition-colors ${isCreditLimitExceeded
                      ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                      : 'bg-slate-50/80 border-slate-200 text-slate-800'
                      }`}
                  >
                    {/* Customer Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">
                          {selectedCustomer.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {selectedCustomer.phone} • {selectedCustomer.city || 'Wholesale Client'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-[10px] text-slate-700">
                        {selectedCustomer.customerType}
                      </span>
                    </div>

                    {/* Credit Breakdown Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                        <span className="text-[10px] text-slate-500 block">Credit Limit</span>
                        <span className="font-bold text-slate-800 text-xs">
                          Rs. {customerCreditLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                        <span className="text-[10px] text-slate-500 block">Current Khata</span>
                        <span className="font-bold text-amber-700 text-xs">
                          Rs. {currentCustomerOutstanding.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                        <span className="text-[10px] text-slate-500 block">New Balance</span>
                        <span
                          className={`font-black text-xs ${isCreditLimitExceeded ? 'text-rose-700' : 'text-slate-900'
                            }`}
                        >
                          Rs. {newProjectedOutstanding.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Light Danger Credit Limit Warning (Informational per user request) */}
                    {isCreditLimitExceeded && (
                      <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-lg text-rose-900 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Customer Credit Limit Exceeded!</span>
                        </div>
                        <p className="text-[11px] text-rose-800 leading-tight">
                          Customer limit is <strong>Rs. {customerCreditLimit.toLocaleString()}</strong>.
                          New outstanding will be <strong>Rs. {newProjectedOutstanding.toLocaleString()}</strong> (Exceeded by Rs. {(newProjectedOutstanding - customerCreditLimit).toLocaleString()}).
                        </p>
                        <p className="text-[10px] text-rose-700 font-semibold italic pt-0.5">
                          Notice: This is for information. You can still proceed and complete this sale.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel / Back
            </button>

            <button
              type="button"
              id="modal-confirm-sale-btn"
              onClick={handleConfirm}
              disabled={isSubmitDisabled}
              className="flex-1 py-2.5 bg-[#0f9d58] hover:bg-[#0b8043] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Sale...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>Confirm & Complete Sale</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </div>

          {/* Inline Validation Hints (Replaces intrusive alerts) */}
          {isWalkInCreditMissing && (
            <p className="text-[11px] text-rose-600 font-semibold text-center flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Khata / Udhaar sale ke liye Customer Name aur Phone Number likhna lazmi hai.</span>
            </p>
          )}

          {isWholesaleCustomerMissing && (
            <p className="text-[11px] text-blue-600 font-semibold text-center flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Wholesale sale ke liye customer account select karna zaroori hai.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
