'use client';

import React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';

export interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  customer: string;
  type: 'Retail' | 'Wholesale';
  amount: string;
  status: 'Paid' | 'Pending';
}

interface BranchRecentInvoicesCardProps {
  invoices?: InvoiceRow[];
}

export default function BranchRecentInvoicesCard({ invoices = [] }: BranchRecentInvoicesCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Recent Invoices
        </h3>
        <Link
          href="/pos/history"
          className="text-xs font-semibold text-brand-blue hover:underline cursor-pointer"
        >
          View All
        </Link>
      </div>

      {/* Table or Clean Empty State */}
      {invoices.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-700">No invoices recorded yet</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Counter invoices for this branch will appear here after checkout.
          </p>
        </div>
      ) : (
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
              {invoices.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-gray-900">
                    {item.number}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{item.date}</td>
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {item.customer}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{item.type}</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">
                    {item.amount}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
