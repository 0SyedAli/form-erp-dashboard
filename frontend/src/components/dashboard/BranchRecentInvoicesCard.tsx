'use client';

import React from 'react';
import { useAppDispatch } from '@/store';
import { openInvoiceDrawer } from '@/store/slices/invoiceDrawerSlice';

interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  customer: string;
  type: 'Retail' | 'Wholesale';
  amount: string;
  status: 'Paid' | 'Pending';
}

const RECENT_INVOICES: InvoiceRow[] = [
  { id: 'INV-002345', number: 'INV-002345', date: 'Oct 31, 2024', customer: 'Walk-in Customer', type: 'Retail', amount: 'Rs. 45,000', status: 'Paid' },
  { id: 'INV-002344', number: 'INV-002344', date: 'Oct 30, 2024', customer: 'Khan Traders', type: 'Wholesale', amount: 'Rs. 180,000', status: 'Pending' },
  { id: 'INV-002343', number: 'INV-002343', date: 'Oct 30, 2024', customer: 'Ahmad Traders', type: 'Wholesale', amount: 'Rs. 240,000', status: 'Paid' },
  { id: 'INV-002342', number: 'INV-002342', date: 'Oct 29, 2024', customer: 'Walk-in Customer', type: 'Retail', amount: 'Rs. 38,000', status: 'Paid' },
  { id: 'INV-002341', number: 'INV-002341', date: 'Oct 29, 2024', customer: 'Walk-in Customer', type: 'Retail', amount: 'Rs. 52,000', status: 'Paid' },
];

export default function BranchRecentInvoicesCard() {
  const dispatch = useAppDispatch();

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Recent Invoices
        </h3>
        <button
          onClick={() => alert('Viewing all recent counter invoices')}
          className="text-xs font-semibold text-brand-blue hover:underline cursor-pointer"
        >
          View All
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 font-semibold text-[11px]">
              <th className="py-2.5 px-4">#</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4">Customer</th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4 text-right">Amount</th>
              <th className="py-2.5 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-700">
            {RECENT_INVOICES.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => dispatch(openInvoiceDrawer(inv.id))}
                className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                title="Click to view full invoice breakdown"
              >
                <td className="py-3 px-4 font-mono font-semibold text-brand-blue">
                  {inv.number}
                </td>
                <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                  {inv.date}
                </td>
                <td className="py-3 px-4 font-medium text-gray-900">
                  {inv.customer}
                </td>
                <td className="py-3 px-4 text-gray-600">
                  {inv.type}
                </td>
                <td className="py-3 px-4 font-bold text-gray-900 text-right whitespace-nowrap">
                  {inv.amount}
                </td>
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  {inv.status === 'Paid' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Paid
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
