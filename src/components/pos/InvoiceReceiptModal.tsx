'use client';

import React, { useState } from 'react';
import { Invoice, Branch } from '@/types';
import { Printer, X, PlusCircle, CheckCircle2 } from 'lucide-react';

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
    window.print();
  };

  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(invoice.date || invoice.createdAt || invoice.issueDate || '2024-10-25'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
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
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                format === 'THERMAL_80MM'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thermal 80mm
            </button>
            <button
              onClick={() => setFormat('A4')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                format === 'A4'
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
            className={`bg-white shadow-md border border-slate-200 p-6 font-mono text-slate-800 transition-all ${
              format === 'THERMAL_80MM'
                ? 'w-[320px] rounded-lg'
                : 'w-[420px] rounded-xl'
            }`}
          >
            {/* Business Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h2 className="text-base font-black tracking-tight text-slate-900 font-sans">
                FOAM SHOP POS
              </h2>
              <p className="text-[11px] text-slate-600 font-sans">Quality Sleep Starts Here</p>
              <p className="text-[11px] text-slate-500 font-sans mt-1">
                {branch?.name || 'Main Retail Branch'}
              </p>
              {branch?.address && (
                <p className="text-[10px] text-slate-400 font-sans">{branch.address}</p>
              )}
            </div>

            {/* Receipt Metadata */}
            <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Invoice #:</span>
                <strong className="text-slate-900">{invoice.invoiceNumber}</strong>
              </div>
              <div className="flex justify-between">
                <span>Sale Type:</span>
                <strong className="text-blue-700">{invoice.saleType || 'WALK_IN'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold text-slate-800">{invoice.customerName || 'Walk-in Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{invoice.paymentMethod || 'CASH'} ({invoice.paymentStatus || 'PAID'})</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px]">
              <div className="flex justify-between font-bold text-slate-900 pb-1 mb-1 border-b border-slate-200">
                <span>Item</span>
                <span className="text-right">Total (Rs.)</span>
              </div>
              {invoice.items.map((item, idx) => (
                <div key={idx} className="py-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">{item.productName}</span>
                    <span>Rs. {(item.lineTotal ?? item.total ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {item.quantity} × Rs. {item.unitPrice.toLocaleString()} ({item.sku || 'N/A'})
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2.5 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {(invoice.grossAmount ?? invoice.subtotal ?? 0).toLocaleString()}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>- Rs. {invoice.discountAmount.toLocaleString()}</span>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>Rs. {invoice.taxAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300 text-slate-900">
                <span>GRAND TOTAL:</span>
                <span>Rs. {(invoice.netAmount ?? invoice.grandTotal ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1 text-[11px]">
                <span>Amount Paid:</span>
                <span>Rs. {(invoice.amountPaid ?? 0).toLocaleString()}</span>
              </div>
              {invoice.amountDue > 0 ? (
                <div className="p-2 bg-purple-50 rounded border border-purple-200 mt-1 space-y-0.5">
                  <div className="flex justify-between font-bold text-[11px] text-purple-900">
                    <span>Remaining Balance:</span>
                    <span>Rs. {invoice.amountDue.toLocaleString()}</span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex justify-between text-[10px] text-purple-700">
                      <span>Due Date:</span>
                      <span>{invoice.dueDate}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex justify-between font-bold text-[11px] text-emerald-700">
                  <span>Change:</span>
                  <span>Rs. {(invoice.changeAmount ?? 0).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Barcode/Footer */}
            <div className="pt-3 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500">
              <p className="font-bold text-slate-700">Thank you for your purchase!</p>
              <p className="mt-0.5">Goods once sold can be exchanged within 7 days.</p>
              <div className="mt-2 flex justify-center">
                <span className="font-mono tracking-widest text-slate-400 text-[9px]">
                  *{invoice.invoiceNumber}*
                </span>
              </div>
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
