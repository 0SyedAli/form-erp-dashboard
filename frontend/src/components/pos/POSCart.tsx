'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  POSCartItem,
  PaymentMethod,
  PaymentArrangement,
  Customer,
  SaleType,
} from '@/types';
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  CreditCard,
  Banknote,
  PauseCircle,
  Printer,
  AlertCircle,
  Building,
  CheckCircle,
  User,
  Building2,
  Truck,
  Calendar,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

interface POSCartProps {
  items: POSCartItem[];
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onRemoveItem: (variantId: string) => void;
  onClearCart: () => void;
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  amountReceived: number;
  onAmountReceivedChange: (amount: number) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCompleteSale: () => void;
  onHoldSale: () => void;
  onPrintInvoice: () => void;
  isProcessing?: boolean;
  isRetailAllowed?: boolean;

  // Flow 07 additions
  saleType: SaleType;
  selectedCustomer: Customer | null;
  onOpenCustomerModal: () => void;
  paymentArrangement: PaymentArrangement;
  onPaymentArrangementChange: (arr: PaymentArrangement) => void;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  creditOverride: boolean;
  onCreditOverrideChange: (override: boolean) => void;
  canApproveCredit?: boolean;
}

export default function POSCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  discountAmount,
  onDiscountChange,
  amountReceived,
  onAmountReceivedChange,
  paymentMethod,
  onPaymentMethodChange,
  onCompleteSale,
  onHoldSale,
  onPrintInvoice,
  isProcessing = false,
  isRetailAllowed = true,
  saleType,
  selectedCustomer,
  onOpenCustomerModal,
  paymentArrangement,
  onPaymentArrangementChange,
  dueDate,
  onDueDateChange,
  creditOverride,
  onCreditOverrideChange,
  canApproveCredit = true,
}: POSCartProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Calculations
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  // Derived Effective Payment Amounts
  const effectivePaid =
    paymentArrangement === 'FULL'
      ? totalAmount
      : paymentArrangement === 'CREDIT'
      ? 0
      : Math.min(totalAmount, amountReceived);

  const outstandingBalance = Math.max(0, totalAmount - effectivePaid);
  const changeAmount =
    paymentArrangement === 'FULL'
      ? Math.max(0, amountReceived - totalAmount)
      : 0;

  // Credit limit calculation
  const customerOutstanding = selectedCustomer?.currentOutstanding || 0;
  const customerCreditLimit = selectedCustomer?.creditLimit || 0;
  const availableCredit = Math.max(0, customerCreditLimit - customerOutstanding);
  const isCreditExceeded =
    (paymentArrangement === 'PARTIAL' || paymentArrangement === 'CREDIT') &&
    selectedCustomer !== null &&
    outstandingBalance > availableCredit;

  // Missing price check: any item with 0 unitPrice
  const hasMissingPrice = items.some((item) => item.unitPrice <= 0);

  // Validation rules:
  // 1. Partial or Credit requires an identified customer account
  const requiresCustomerAccount =
    paymentArrangement === 'PARTIAL' ||
    paymentArrangement === 'CREDIT' ||
    saleType === 'WHOLESALE' ||
    saleType === 'DISTRIBUTOR';

  const isCustomerMissing = requiresCustomerAccount && !selectedCustomer;

  // 2. Can checkout condition
  const canCheckout =
    items.length > 0 &&
    !hasMissingPrice &&
    !isCustomerMissing &&
    (!isCreditExceeded || creditOverride) &&
    isRetailAllowed &&
    !isProcessing &&
    (paymentArrangement === 'FULL' ? amountReceived >= totalAmount : true);

  // Clear with confirmation
  const handleClearClick = () => {
    if (items.length === 0) return;
    if (showClearConfirm) {
      onClearCart();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 4000);
    }
  };

  return (
    <div className="w-full lg:w-[32%] xl:w-[30%] min-w-[340px] bg-white border-l border-slate-200 flex flex-col h-full select-none shadow-xs shrink-0">
      {/* Customer Header Bar */}
      <div className="p-2.5 bg-slate-50 border-b border-slate-200">
        <div
          onClick={onOpenCustomerModal}
          id="pos-select-customer-btn"
          className="bg-white hover:bg-slate-100/80 border border-slate-200 rounded-xl p-2.5 transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
          title="Click to select or change customer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                selectedCustomer?.customerType === 'DISTRIBUTOR'
                  ? 'bg-purple-100 text-purple-700'
                  : selectedCustomer?.customerType === 'WHOLESALE'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {selectedCustomer?.customerType === 'DISTRIBUTOR' ? (
                <Truck className="w-4 h-4" />
              ) : selectedCustomer?.customerType === 'WHOLESALE' ? (
                <Building2 className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-800 truncate font-sans">
                  {selectedCustomer ? selectedCustomer.name : 'Walk-in (Anonymous)'}
                </span>
                {selectedCustomer && (
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                    {selectedCustomer.customerCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate font-sans">
                {selectedCustomer ? (
                  <span>
                    Limit: Rs. {selectedCustomer.creditLimit.toLocaleString()} • Due: Rs.{' '}
                    {selectedCustomer.currentOutstanding.toLocaleString()}
                  </span>
                ) : (
                  <span>Anonymous counter sale (Full Payment only)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-slate-400 group-hover:text-blue-600 shrink-0">
            <span className="text-xs font-semibold">Change</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Customer Missing Warning for Credit / Wholesale */}
        {isCustomerMissing && (
          <div className="mt-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {saleType !== 'WALK_IN'
                ? `${saleType} sale requires an identified customer account.`
                : 'Partial / Credit billing requires an identified customer account.'}
            </span>
          </div>
        )}
      </div>

      {/* Cart Items Header */}
      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-bold text-slate-800 font-sans">
            Cart{' '}
            <span className="text-slate-500 font-normal">
              ({totalItemCount} {totalItemCount === 1 ? 'Item' : 'Items'})
            </span>
          </h2>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearClick}
            className={`text-xs font-semibold flex items-center gap-1 transition-colors px-2 py-0.5 rounded-lg cursor-pointer ${
              showClearConfirm
                ? 'bg-rose-100 text-rose-700 animate-pulse'
                : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            <span>{showClearConfirm ? 'Confirm Clear?' : 'Clear'}</span>
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-2">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">Your cart is empty</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Select mattresses and configurations from the catalogue on the left.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isInvalidPrice = item.unitPrice <= 0;
            return (
              <div
                key={item.variantId}
                className={`bg-white rounded-xl border p-2.5 shadow-2xs transition-all flex flex-col gap-2 ${
                  isInvalidPrice
                    ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-400/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Item Top */}
                <div className="flex items-start gap-2.5">
                  <div className="w-11 h-11 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        width={44}
                        height={44}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-bold text-xs text-slate-800 truncate font-sans">
                        {item.productName}
                      </h4>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.variantId)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                      {item.sizeLabel} • {item.thicknessInches}&quot; Thickness •{' '}
                      <span className="font-mono">{item.sku}</span>
                    </p>

                    {isInvalidPrice ? (
                      <p className="text-[11px] font-bold text-rose-600 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Price not configured for {saleType} tier
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-slate-700 mt-0.5 font-sans">
                        Rs. {item.unitPrice.toLocaleString()}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({saleType})
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Item Bottom: Stepper and Line Total */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1)}
                      className="w-6 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-xs text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= item.availableStock}
                      className="w-6 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="text-xs font-black text-slate-900 font-sans">
                    Rs. {item.lineTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Calculations & Checkout Section */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2.5">
        {/* Payment Arrangement Selector: Full | Partial | Credit */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider font-sans">
            Payment Arrangement
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              id="payment-arr-full"
              onClick={() => {
                onPaymentArrangementChange('FULL');
                onAmountReceivedChange(totalAmount);
              }}
              className={`py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                paymentArrangement === 'FULL'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Payment
            </button>
            <button
              type="button"
              id="payment-arr-partial"
              onClick={() => {
                onPaymentArrangementChange('PARTIAL');
                if (amountReceived === 0 || amountReceived >= totalAmount) {
                  onAmountReceivedChange(Math.round(totalAmount / 2));
                }
              }}
              className={`py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                paymentArrangement === 'PARTIAL'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Partial
            </button>
            <button
              type="button"
              id="payment-arr-credit"
              onClick={() => {
                onPaymentArrangementChange('CREDIT');
                onAmountReceivedChange(0);
              }}
              className={`py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                paymentArrangement === 'CREDIT'
                  ? 'bg-white text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Credit
            </button>
          </div>
        </div>

        {/* Payment Method Selector Pill Row (when collecting payment) */}
        {paymentArrangement !== 'CREDIT' && (
          <div className="flex items-center gap-1 p-1 bg-slate-200/50 rounded-lg">
            <button
              type="button"
              onClick={() => onPaymentMethodChange('CASH')}
              className={`flex-1 py-1 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'CASH'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Banknote className="w-3 h-3" />
              <span>Cash</span>
            </button>
            <button
              type="button"
              onClick={() => onPaymentMethodChange('PAYPAK_CARD')}
              className={`flex-1 py-1 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'PAYPAK_CARD'
                  ? 'bg-white text-blue-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3 h-3" />
              <span>Card</span>
            </button>
            <button
              type="button"
              onClick={() => onPaymentMethodChange('BANK_TRANSFER')}
              className={`flex-1 py-1 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                paymentMethod === 'BANK_TRANSFER'
                  ? 'bg-white text-purple-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3 h-3" />
              <span>Bank</span>
            </button>
          </div>
        )}

        {/* Subtotal & Discount */}
        <div className="space-y-1 pt-1 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Subtotal</span>
            <span className="font-bold text-slate-900">Rs. {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold">Discount (Rs.)</span>
            <input
              type="number"
              min={0}
              max={subtotal}
              value={discountAmount || ''}
              onChange={(e) => onDiscountChange(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
              className="w-24 px-2 py-0.5 text-right text-xs font-bold border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Total Amount Box */}
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between shadow-2xs">
          <span className="text-xs font-bold text-slate-800 font-sans">Net Invoice Total</span>
          <span className="text-lg font-black text-emerald-800 font-sans tracking-tight">
            Rs. {totalAmount.toLocaleString()}
          </span>
        </div>

        {/* Partial Payment Amount Received Input */}
        {paymentArrangement === 'PARTIAL' && (
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span className="font-semibold">Amount Received (Rs.)</span>
            <input
              id="pos-partial-amount-received"
              type="number"
              min={1}
              max={totalAmount}
              value={amountReceived || ''}
              onChange={(e) => onAmountReceivedChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-32 px-2 py-1 text-right text-xs font-black border border-blue-400 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Full Payment Cash Received Input */}
        {paymentArrangement === 'FULL' && (
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span className="font-semibold">Cash Tendered (Rs.)</span>
            <input
              id="pos-amount-received"
              type="number"
              min={0}
              value={amountReceived || ''}
              onChange={(e) => onAmountReceivedChange(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder={totalAmount.toString()}
              className="w-32 px-2 py-1 text-right text-xs font-black border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}

        {/* Change Banner (Full Payment only) */}
        {paymentArrangement === 'FULL' && changeAmount > 0 && (
          <div className="bg-emerald-100/60 border border-emerald-200 rounded-lg px-3 py-1 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">Change Due</span>
            <span className="font-black text-emerald-800">Rs. {changeAmount.toLocaleString()}</span>
          </div>
        )}

        {/* Credit Breakdown Banner (Partial or Credit) */}
        {(paymentArrangement === 'PARTIAL' || paymentArrangement === 'CREDIT') && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900">Remaining Balance (Udhaar)</span>
              <span className="font-black text-purple-800 text-sm">
                Rs. {outstandingBalance.toLocaleString()}
              </span>
            </div>

            {/* Credit Due Date Picker */}
            <div className="flex items-center justify-between pt-1 border-t border-purple-200/60 text-[11px]">
              <span className="font-semibold text-purple-900 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-700" />
                Credit Due Date:
              </span>
              <input
                type="date"
                id="pos-due-date"
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                className="px-2 py-0.5 rounded border border-purple-300 bg-white font-sans text-xs focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {/* Credit Limit Exceeded Warning & Supervisor Override */}
        {isCreditExceeded && (
          <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-start gap-1.5 text-rose-800 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span>Credit Limit Exceeded!</span>
                <p className="text-[11px] font-normal text-rose-700">
                  Customer available credit is Rs. {availableCredit.toLocaleString()}. New credit
                  is Rs. {outstandingBalance.toLocaleString()}.
                </p>
              </div>
            </div>

            {canApproveCredit && (
              <label className="flex items-center gap-2 pt-1 text-slate-800 font-bold cursor-pointer border-t border-rose-200">
                <input
                  type="checkbox"
                  id="pos-credit-override-checkbox"
                  checked={creditOverride}
                  onChange={(e) => onCreditOverrideChange(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-blue-900">
                  Supervisor Override: Authorize Credit Exception
                </span>
              </label>
            )}
          </div>
        )}

        {/* Big Complete Sale Button (F5) */}
        <button
          type="button"
          id="pos-complete-sale-btn"
          onClick={onCompleteSale}
          disabled={!canCheckout}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
        >
          <CheckCircle className="w-4 h-4" />
          <span>
            {paymentArrangement === 'FULL'
              ? 'Complete Full Payment Sale (F5)'
              : paymentArrangement === 'PARTIAL'
              ? 'Complete Partial Credit Sale (F5)'
              : 'Complete Credit Sale (F5)'}
          </span>
        </button>

        {/* Dual Actions: Hold Sale (F3) & Print Invoice (F6) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onHoldSale}
            disabled={items.length === 0 || isProcessing}
            className="flex-1 py-1.5 bg-white hover:bg-slate-100 active:scale-[0.99] border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Hold Sale (F3)</span>
          </button>

          <button
            type="button"
            onClick={onPrintInvoice}
            disabled={items.length === 0 || isProcessing}
            className="flex-1 py-1.5 bg-white hover:bg-slate-100 active:scale-[0.99] border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Invoice (F6)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
