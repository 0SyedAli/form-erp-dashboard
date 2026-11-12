'use client';

import React, { useState } from 'react';
import { Invoice, Branch } from '@/types';
import { Printer, X, PlusCircle, CheckCircle2 } from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/formatters';
import { printThermalReceipt } from '@/utils/thermalPrinter';

interface InvoiceReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  branch?: Branch | null;
  cashierName?: string;
  onStartNewSale: () => void;
}

export default function InvoiceReceiptModal({
  isOpen,
  onClose,
  invoice,
  branch,
  cashierName = 'Cashier',
  onStartNewSale,
}: InvoiceReceiptModalProps) {
  const [format, setFormat] = useState<'THERMAL_80MM' | 'A4'>('THERMAL_80MM');

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    printThermalReceipt(invoice, branch, cashierName);
  };

  const formattedDate = formatDateTime(invoice.date || invoice.createdAt || invoice.issueDate);
  const formattedDueDate = invoice.dueDate ? formatDate(invoice.dueDate) : '';
  const totalQty = (invoice.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  const storeName = branch?.name || 'FOAM SHOP POS';
  const branchAddress = branch?.address || 'Main Market, Karachi';
  const branchPhone = branch?.phone || '0300-1234567';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base font-sans">Sale Completed Successfully</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector Pills */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-slate-100 bg-white">
          <span className="text-xs font-semibold text-slate-500">Preview Layout:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFormat('THERMAL_80MM')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${format === 'THERMAL_80MM'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Thermal 80mm
            </button>
            <button
              onClick={() => setFormat('A4')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${format === 'A4'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Standard A4
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
          <div
            id="printable-pos-invoice"
            className={`bg-white shadow-md border border-slate-300 p-5 font-sans font-semibold text-slate-900 transition-all ${format === 'THERMAL_80MM'
              ? 'w-[320px] rounded-sm text-[12px] leading-tight'
              : 'w-[420px] rounded-lg text-sm'
              }`}
          >
            {/* Top Store Logo */}
            <div className="text-center pb-2">
              <img
                src="/assets/brands/brand-logo.png"
                alt="Store Logo"
                className="max-h-[55px] max-w-[140px] inline-block object-contain"
              />
            </div>

            {/* Business Header */}
            <div className="text-center pb-1">
              <h2 className="text-base font-black tracking-tight text-slate-900 uppercase">
                {storeName}
              </h2>
              <p className="text-[11px] text-slate-700 font-medium mt-0.5">{branchAddress}</p>
              <p className="text-[11px] text-slate-700 font-medium">Ph: {branchPhone}</p>
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Receipt Metadata */}
            <div className="text-center font-bold text-[13px] tracking-wider my-1">
              SALE RECEIPT
            </div>

            <div className="text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Inv: {invoice.invoiceNumber}</span>
                <span className="font-semibold">{invoice.saleType || 'RETAIL'}</span>
              </div>
              <div className="flex justify-between">
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Billed By: {cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{invoice.customerName || 'Walk-in'}</span>
              </div>
              {invoice.customerPhone && (
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>{invoice.customerPhone}</span>
                </div>
              )}
              {invoice.isInterBranch && invoice.sourceBranchName && (
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Stock From:</span>
                  <span>{invoice.sourceBranchName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Table Header */}
            <div className="flex justify-between font-bold text-[12px]">
              <span>S#   Items</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Items Table */}
            <div className="space-y-1 text-[12px]">
              {(invoice.items || []).map((item, idx) => {
                const lineTotal = item.lineTotal ?? item.total ?? ((item.unitPrice || 0) * (item.quantity || 1));
                const sizeInfo = item.sizeLabel ? ` [${item.sizeLabel}${item.thicknessLabel ? ` • ${item.thicknessLabel}` : ''}]` : '';
                const isLast = idx === (invoice.items || []).length - 1;
                return (
                  <div key={idx}>
                    <div className="font-bold text-[13px]">
                      <span>{idx + 1}.   {item.productName}{sizeInfo}</span>
                    </div>
                    <div className="flex justify-between text-[12px] text-slate-800 mt-0.5">
                      <span className="pl-4">{item.quantity} × Rs. {(item.unitPrice || 0).toLocaleString()}</span>
                      <span className="font-bold">Rs. {lineTotal.toLocaleString()}</span>
                    </div>
                    {!isLast && (
                      <div className="border-t border-dotted border-slate-400 my-1.5" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Total Items Count */}
            <div className="flex justify-between font-bold text-[12px]">
              <span>Total Items:</span>
              <span>{totalQty}</span>
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Totals */}
            <div className="space-y-1 text-[12px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>Rs. {(invoice.grossAmount ?? invoice.subtotal ?? 0).toLocaleString()}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount</span>
                  <span>- Rs. {invoice.discountAmount.toLocaleString()}</span>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>Rs. {invoice.taxAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            <div className="flex justify-between font-bold text-[13px]">
              <span>Grand Total</span>
              <span>Rs. {(invoice.netAmount ?? invoice.grandTotal ?? 0).toLocaleString()}</span>
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Payment Section */}
            <div className="space-y-1 text-[12px]">
              <div className="flex justify-between">
                <span>Receiving Amount</span>
                <span className="font-bold">Rs. {(invoice.amountReceived ?? invoice.amountPaid ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Return Amount</span>
                <span>Rs. {(invoice.changeAmount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="font-bold">{invoice.paymentMethod || 'CASH'}</span>
              </div>

              {invoice.amountDue > 0 && (
                <>
                  <div className="border-t border-dashed border-slate-800 my-1.5" />
                  <div className="flex justify-between font-bold">
                    <span>Remaining Khata:</span>
                    <span>Rs. {invoice.amountDue.toLocaleString()}</span>
                  </div>
                  {formattedDueDate && (
                    <div className="flex justify-between text-[11px]">
                      <span>Due Date:</span>
                      <span>{formattedDueDate}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Terms & Urdu Greeting */}
            <div className="text-center mt-2 space-y-1">
              <div className="font-bold text-[11px]">Thank you for your business!</div>
              <div
                className="text-[12px] leading-relaxed text-slate-800"
                style={{
                  fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', Tahoma, sans-serif",
                  direction: 'rtl',
                }}
              >
                خریدے ہوئے سامان کی واپسی کی مدت 7 دن ہے۔
              </div>
            </div>

            <div className="border-t border-dashed border-slate-800 my-2" />

            {/* Software Credit Branding (Image 2) */}
            <div className="text-center text-[10px] text-slate-700 mt-2">
              <div className="font-bold">Software by Synoxify Solutions</div>
              <div>www.synoxify.com | 0311-8449006</div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onStartNewSale}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Sale (F2)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice (F6)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
