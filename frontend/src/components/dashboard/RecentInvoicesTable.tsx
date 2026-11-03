'use client';

import React, { useState } from 'react';
import { Invoice } from '@/types';
import { formatPKR, formatPKDate } from '@/utils/formatters';
import { useAppDispatch } from '@/store';
import { openInvoiceDrawer } from '@/store/slices/invoiceDrawerSlice';
import {
  ReceiptText,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Building,
} from 'lucide-react';

interface RecentInvoicesTableProps {
  invoices: Invoice[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

export default function RecentInvoicesTable({
  invoices,
  title = 'Recent Billing & Invoices',
  subtitle = 'Click any transaction to open the comprehensive invoice inspection drawer',
  isLoading = false,
}: RecentInvoicesTableProps) {
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const pageSize = 8;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs animate-pulse">
        <div className="h-4 bg-gray-200 rounded-sm w-44 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(invoices.length / pageSize) || 1;
  const paginatedInvoices = invoices.slice((page - 1) * pageSize, page * pageSize);

  const getStatusBadge = (status: Invoice['paymentStatus']) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            PAID
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            PARTIAL
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            REFUNDED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getMethodLabel = (method: Invoice['paymentMethod']) => {
    switch (method) {
      case 'CASH':
        return 'Cash Counter';
      case 'BANK_TRANSFER':
        return 'Bank Transfer';
      case 'PAYPAK_CARD':
        return 'PayPak Card';
      case 'CHEQUE':
        return 'Cheque';
      case 'CREDIT_30D':
        return '30-Day Credit';
      default:
        return method;
    }
  };

  return (
    <div id="invoices" className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
      {/* Table Header */}
      <div className="p-5 sm:p-6 border-b border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {invoices.length} Records
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-0.5 font-normal">{subtitle}</p>
        </div>
      </div>

      {/* Table Content */}
      {invoices.length === 0 ? (
        <div className="p-12 text-center">
          <ReceiptText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No invoices found</p>
          <p className="text-[13px] text-gray-400 mt-0.5 font-normal">
            No transactions match the selected branch and date filter criteria.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[13px] font-semibold text-gray-600">
                <th className="py-3.5 px-4 sm:px-6">Invoice #</th>
                <th className="py-3.5 px-4">Date / Time (PKT)</th>
                <th className="py-3.5 px-4">Branch</th>
                <th className="py-3.5 px-4">Customer / Organization</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Net Amount</th>
                <th className="py-3.5 px-4">Settlement</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-normal text-gray-700">
              {paginatedInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => dispatch(openInvoiceDrawer(inv.id))}
                  className="hover:bg-red-50/30 cursor-pointer transition-colors group"
                >
                  {/* Invoice # */}
                  <td className="py-4 px-4 sm:px-6 font-mono font-medium text-brand-navy group-hover:text-brand-red">
                    {inv.invoiceNumber}
                  </td>

                  {/* Date & Time in PKT */}
                  <td className="py-4 px-4 text-gray-600 whitespace-nowrap text-sm font-normal">
                    {formatPKDate(inv.date, { includeTime: true })}
                  </td>

                  {/* Branch */}
                  <td className="py-4 px-4 text-gray-800 whitespace-nowrap text-sm font-normal">
                    <span>{inv.branchName}</span>
                  </td>

                  {/* Customer */}
                  <td className="py-4 px-4 max-w-[200px]">
                    <div className="font-medium text-gray-900 truncate text-sm">
                      {inv.customerName}
                    </div>
                    {inv.businessName && (
                      <span className="text-[13px] text-gray-500 truncate block font-normal">
                        {inv.businessName}
                      </span>
                    )}
                  </td>

                  {/* Customer Type badge */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {inv.customerType === 'RETAIL' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-red-50 text-brand-red border border-red-100">
                        <ShoppingBag className="w-3.5 h-3.5" /> Retail
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        <Building className="w-3.5 h-3.5" /> Wholesale
                      </span>
                    )}
                  </td>

                  {/* Net Amount */}
                  <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap text-sm">
                    {formatPKR(inv.netAmount)}
                  </td>

                  {/* Settlement method */}
                  <td className="py-4 px-4 text-gray-600 whitespace-nowrap text-sm font-normal">
                    {getMethodLabel(inv.paymentMethod)}
                  </td>

                  {/* Payment Status badge */}
                  <td className="py-4 px-4 text-center whitespace-nowrap">
                    {getStatusBadge(inv.paymentStatus)}
                  </td>

                  {/* Action */}
                  <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(openInvoiceDrawer(inv.id));
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-red hover:bg-white border border-transparent hover:border-gray-200 transition-colors cursor-pointer"
                      title="Inspect Invoice"
                      aria-label="Inspect Invoice"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 bg-gray-50/70 border-t border-gray-200 flex items-center justify-between text-[13px] font-normal text-gray-600">
          <span>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, invoices.length)} of {invoices.length} invoices
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-gray-800 text-[13px]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
