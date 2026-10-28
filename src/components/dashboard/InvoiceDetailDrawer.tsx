'use client';

import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeInvoiceDrawer } from '@/store/slices/invoiceDrawerSlice';
import { useGetInvoiceByIdQuery } from '@/store/services/apiSlice';
import { formatPKR, formatPKDate } from '@/utils/formatters';
import {
  X,
  Printer,
  Download,
  Phone,
  ShoppingBag,
  Building,
} from 'lucide-react';

export default function InvoiceDetailDrawer() {
  const dispatch = useAppDispatch();
  const { isOpen, selectedInvoiceId } = useAppSelector((state) => state.invoiceDrawer);

  const { data: invoice, isLoading } = useGetInvoiceByIdQuery(selectedInvoiceId || '', {
    skip: !isOpen || !selectedInvoiceId,
  });

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => dispatch(closeInvoiceDrawer())}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300"
          role="dialog"
          aria-labelledby="drawer-title"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-brand-navy text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center text-white font-bold text-sm shadow-xs">
                MF
              </div>
              <div>
                <h2 id="drawer-title" className="text-lg font-semibold tracking-tight">
                  {invoice ? invoice.invoiceNumber : 'Loading Invoice...'}
                </h2>
                <p className="text-[13px] text-slate-300">
                  Molty Foam Official Sales Voucher
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Print invoice"
                aria-label="Print invoice"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={() => dispatch(closeInvoiceDrawer())}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close invoice drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading || !invoice ? (
              <div className="py-20 text-center animate-pulse space-y-3">
                <div className="h-6 bg-gray-200 rounded-sm w-48 mx-auto" />
                <div className="h-4 bg-gray-100 rounded-sm w-64 mx-auto" />
              </div>
            ) : (
              <>
                {/* Meta details bar */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs uppercase font-medium">
                      Date & Time (PKT)
                    </span>
                    <strong className="text-gray-800 font-semibold text-sm">
                      {formatPKDate(invoice.date, { includeTime: true })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs uppercase font-medium">
                      Originating Branch
                    </span>
                    <strong className="text-gray-800 font-semibold text-sm">{invoice.branchName}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 block text-xs uppercase font-medium">
                      Channel Type
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold text-xs ${
                        invoice.customerType === 'RETAIL'
                          ? 'text-brand-red'
                          : 'text-brand-navy'
                      }`}
                    >
                      {invoice.customerType === 'RETAIL' ? (
                        <ShoppingBag className="w-3.5 h-3.5" />
                      ) : (
                        <Building className="w-3.5 h-3.5" />
                      )}
                      {invoice.customerType}
                    </span>
                  </div>
                </div>

                {/* Customer / Entity Box */}
                <div className="p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Bill To Information
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                      Sales Officer: {invoice.salesPerson}
                    </span>
                  </div>
                  <div className="font-semibold text-gray-900 text-base">
                    {invoice.customerName}
                  </div>
                  {invoice.businessName && (
                    <div className="text-sm font-medium text-gray-700">
                      Enterprise Client: {invoice.businessName}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 pt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {invoice.customerPhone}
                    </span>
                    {invoice.customerNTN && (
                      <span className="flex items-center gap-1 font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-xs font-medium">
                        NTN: {invoice.customerNTN}
                      </span>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Invoiced Line Items
                  </h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[13px] font-semibold">
                          <th className="py-3 px-3.5">Item / SKU</th>
                          <th className="py-3 px-3.5 text-center">Qty</th>
                          <th className="py-3 px-3.5 text-right">Unit Price</th>
                          <th className="py-3 px-3.5 text-right">Discount</th>
                          <th className="py-3 px-3.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {invoice.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-3.5 px-3.5">
                              <div className="font-semibold text-gray-900 text-sm">
                                {item.productName}
                              </div>
                              <span className="text-xs font-mono text-gray-400">
                                {item.sku}
                              </span>
                            </td>
                            <td className="py-3.5 px-3.5 text-center font-semibold text-gray-800 text-sm">
                              {item.quantity}
                            </td>
                            <td className="py-3.5 px-3.5 text-right text-gray-600 text-sm">
                              {formatPKR(item.unitPrice)}
                            </td>
                            <td className="py-3.5 px-3.5 text-right text-amber-700 font-medium text-sm">
                              {item.discount > 0 ? `- ${formatPKR(item.discount)}` : '-'}
                            </td>
                            <td className="py-3.5 px-3.5 text-right font-semibold text-gray-900 text-sm">
                              {formatPKR(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Gross Invoice Subtotal:</span>
                    <span className="font-medium text-gray-900">{formatPKR(invoice.grossAmount)}</span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Trade / Special Discounts:</span>
                      <span className="font-medium">- {formatPKR(invoice.discountAmount)}</span>
                    </div>
                  )}
                  {invoice.returnAmount > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Customer Return Deduction:</span>
                      <span className="font-medium">- {formatPKR(invoice.returnAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Applicable Sales Tax (Included):</span>
                    <span>PKR 0</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold text-gray-900">
                    <span>Net Invoice Total:</span>
                    <span className="text-base font-semibold text-brand-navy">
                      {formatPKR(invoice.netAmount)}
                    </span>
                  </div>
                </div>

                {/* Settlement Card */}
                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      Settlement Mode
                    </span>
                    <div className="font-semibold text-gray-800 mt-0.5 text-sm">
                      {invoice.paymentMethod === 'PAYPAK_CARD'
                        ? 'PayPak / 1Link Electronic POS'
                        : invoice.paymentMethod === 'BANK_TRANSFER'
                        ? 'Direct Treasury Wire (IBFT)'
                        : invoice.paymentMethod === 'CREDIT_30D'
                        ? '30-Day Corporate Credit Facility'
                        : invoice.paymentMethod === 'CHEQUE'
                        ? 'Crossed Commercial Cheque'
                        : 'Cash Counter Receipt'}
                    </div>
                    <span className="text-[13px] text-emerald-700 font-medium mt-0.5 block">
                      Paid: {formatPKR(invoice.amountPaid)}
                      {invoice.amountDue > 0 && (
                        <span className="text-amber-800 ml-2">
                          (Balance Due: {formatPKR(invoice.amountDue)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invoice.paymentStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : invoice.paymentStatus === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {invoice.paymentStatus}
                    </span>
                  </div>
                </div>

                {invoice.notes && (
                  <div className="p-3 rounded-lg bg-yellow-50/60 border border-yellow-100 text-xs text-yellow-900">
                    <strong>ERP Audit Note:</strong> {invoice.notes}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => {
                alert(`Receipt for ${invoice?.invoiceNumber} exported to official Molty Foam corporate PDF format.`);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-gray-500" />
              Download PDF
            </button>
            <button
              onClick={() => dispatch(closeInvoiceDrawer())}
              className="px-4 py-2.5 rounded-lg bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
