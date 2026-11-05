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
  PauseCircle,
  Printer,
  Banknote,
  User,
  AlertCircle,
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

  // Effective payment calculation
  const changeAmount = Math.max(0, amountReceived - totalAmount);

  const canCheckout =
    items.length > 0 &&
    isRetailAllowed &&
    !isProcessing;

  const handleClearClick = () => {
    if (showClearConfirm) {
      onClearCart();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <div className="w-[360px] xl:w-[390px] bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col shrink-0 overflow-y-auto h-full select-none scrollbar-thin">
      {/* 1. Header matching reference mockup: Cart (X Items) | Clear All */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-slate-800" />
          <h2 className="text-base font-bold text-slate-900 font-sans">
            Cart{' '}
            <span className="text-slate-500 font-normal text-sm">
              ({totalItemCount} {totalItemCount === 1 ? 'Item' : 'Items'})
            </span>
          </h2>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearClick}
            className="text-xs font-semibold flex items-center gap-1 transition-colors px-2 py-1 rounded-lg cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{showClearConfirm ? 'Confirm Clear?' : 'Clear All'}</span>
          </button>
        )}
      </div>

      {/* Customer bar if Wholesale or Distributor */}
      {saleType !== 'WALK_IN' && (
        <div className="px-3.5 py-2 bg-blue-50/60 border-b border-blue-100 text-xs shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-800 truncate">
              {selectedCustomer ? selectedCustomer.name : 'Select Customer Account'}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenCustomerModal}
            className="text-blue-600 font-bold hover:underline shrink-0 text-[11px]"
          >
            {selectedCustomer ? 'Change' : 'Assign'}
          </button>
        </div>
      )}

      {/* 2. Cart Items List matching reference mockup */}
      <div className="flex-1 min-h-[300px] overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
        {items.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-3">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-slate-700 font-sans">Your Cart is Empty</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Select mattresses and configurations from the catalogue to add them to this sale.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.variantId}
              className="bg-white rounded-xl border border-slate-200/90 p-3 transition-all shadow-2xs hover:border-slate-300 flex flex-col gap-2"
            >
              {/* Item Top Row */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50/50">
                      {/* Mini mattress representation */}
                      <svg viewBox="0 0 40 24" className="w-8 h-6 text-blue-500">
                        <polygon points="20,2 38,10 20,18 2,10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
                        <polygon points="2,10 20,18 20,22 2,14" fill="#3b82f6" />
                        <polygon points="20,18 38,10 38,14 20,22" fill="#1d4ed8" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-bold text-sm text-slate-900 truncate font-sans">
                      {item.productName}
                    </h4>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.variantId)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-0.5 rounded cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    {item.sizeLabel} • {item.thicknessInches}&quot; Thickness
                  </p>

                  <p className="text-xs font-bold text-slate-800 mt-0.5 font-sans">
                    Rs. {item.unitPrice.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Item Bottom Row: Stepper and Line Total */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1)}
                    className="w-7 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center font-bold text-xs text-slate-800">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
                    disabled={item.quantity >= item.availableStock}
                    className="w-7 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <span className="text-sm font-black text-slate-900 font-sans">
                  Rs. {item.lineTotal.toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Calculations & Checkout Footer matching reference mockup */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-200 space-y-3 shrink-0">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-xs text-slate-700">
          <span className="font-semibold text-slate-600">Subtotal</span>
          <span className="font-bold text-slate-900">Rs. {subtotal.toLocaleString()}</span>
        </div>

        {/* Discount (Rs.) */}
        <div className="flex items-center justify-between text-xs text-slate-700">
          <span className="font-semibold text-slate-600">Discount (Rs.)</span>
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

        {/* Total Amount Banner matching reference screenshot */}
        <div className="bg-[#e6f4ea] border border-[#ceead6] rounded-xl px-4 py-3 flex items-center justify-between shadow-2xs">
          <span className="text-sm font-bold text-[#137333] font-sans">Total Amount</span>
          <span className="text-xl font-black text-[#137333] font-sans tracking-tight">
            Rs. {totalAmount.toLocaleString()}
          </span>
        </div>

        {/* Amount Received (Rs.) */}
        <div className="flex items-center justify-between text-xs text-slate-700">
          <span className="font-semibold">Amount Received (Rs.)</span>
          <input
            id="pos-amount-received"
            type="number"
            min={0}
            value={amountReceived || ''}
            onChange={(e) => onAmountReceivedChange(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder={totalAmount > 0 ? totalAmount.toString() : '0'}
            className="w-32 px-2.5 py-1 text-right text-xs font-black border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        {/* Change (Rs.) */}
        <div className="bg-[#e6f4ea] rounded-xl px-4 py-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#137333]">Change (Rs.)</span>
          <span className="font-black text-[#137333] text-sm">
            Rs. {changeAmount.toLocaleString()}
          </span>
        </div>

        {/* Complete Sale Button (F5) matching reference mockup */}
        <button
          type="button"
          id="pos-complete-sale-btn"
          onClick={onCompleteSale}
          disabled={!canCheckout}
          className="w-full py-3.5 bg-[#0f9d58] hover:bg-[#0b8043] active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
        >
          {/* Cash Banknote Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
          <span>Complete Sale (F5)</span>
        </button>

        {/* Secondary Buttons: Hold Sale (F3) & Print Invoice (F6) */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onHoldSale}
            disabled={items.length === 0 || isProcessing}
            className="flex-1 py-2 bg-white hover:bg-slate-100 active:scale-[0.99] border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <PauseCircle className="w-3.5 h-3.5 text-slate-600" />
            <span>Hold Sale (F3)</span>
          </button>

          <button
            type="button"
            onClick={onPrintInvoice}
            disabled={items.length === 0 || isProcessing}
            className="flex-1 py-2 bg-white hover:bg-slate-100 active:scale-[0.99] border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Invoice (F6)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
