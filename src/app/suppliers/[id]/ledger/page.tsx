'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import {
  useGetSupplierByIdQuery,
  useGetSupplierLedgerQuery,
  useGetSupplierLedgerSummaryQuery,
} from '@/store/services/apiSlice';
import {
  ArrowLeft,
  Printer,
  CreditCard,
} from 'lucide-react';

function SupplierLedgerContent() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const { data: supplier, isLoading: isSupLoading } = useGetSupplierByIdQuery(id);
  const { data: ledger = [], isLoading: isLedgerLoading } = useGetSupplierLedgerQuery(id);
  const { data: summary } = useGetSupplierLedgerSummaryQuery(id);

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredEntries = useMemo(() => {
    return ledger.filter((e) => {
      if (typeFilter !== 'ALL' && e.type !== typeFilter) return false;
      if (startDate && new Date(e.date).getTime() < new Date(startDate).getTime()) return false;
      if (endDate && new Date(e.date).getTime() > new Date(endDate).getTime()) return false;
      return true;
    });
  }, [ledger, typeFilter, startDate, endDate]);

  const totalCredits = filteredEntries.reduce((sum, e) => sum + e.credit, 0);
  const totalDebits = filteredEntries.reduce((sum, e) => sum + e.debit, 0);
  const closingBalance = summary?.currentBalance ?? (ledger.length > 0 ? ledger[ledger.length - 1].balance : 0);

  if (isSupLoading) {
    return (
      <AppLayout>
        <PurchasesNavTabs />
        <div className="p-8 text-center text-slate-500">Loading supplier ledger...</div>
      </AppLayout>
    );
  }

  if (!supplier) {
    return (
      <AppLayout>
        <PurchasesNavTabs />
        <div className="p-8 text-center space-y-4">
          <p className="text-slate-600">Supplier not found.</p>
          <Link href="/suppliers" className="text-brand-burgundy font-medium hover:underline">
            Back to suppliers
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Printable Statement Header */}
        <div className="hidden print:block mb-8">
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">MOLTY FOAM ERP</h1>
              <p className="text-xs text-slate-600">Supplier Accounts Payable Ledger Statement</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-slate-900">{supplier.name}</span>
              <p className="text-xs text-slate-600">Code: {supplier.code}</p>
            </div>
          </div>
        </div>

        {/* Back Link & Header (Screen Only) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href={`/suppliers/${supplier.id}`}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier Running Ledger</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {supplier.name} ({supplier.code}) • Accounts Payable Liability Account
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>

            <Link
              href={`/payments/suppliers?supplierId=${supplier.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Make Payment</span>
            </Link>
          </div>
        </div>

        {/* Balance Overview Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Invoiced (Credits)
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              Rs. {totalCredits.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">Vendor bills increase liability</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Settled (Debits)
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">
              Rs. {totalDebits.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">Payments & debit notes decrease liability</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Current Payable Balance
            </span>
            <span
              className={`text-2xl font-bold mt-1 block ${
                closingBalance > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              Rs. {closingBalance.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">Net current amount due</span>
          </div>
        </div>

        {/* Filters Bar (Screen Only) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Transaction Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
              >
                <option value="ALL">All Transactions</option>
                <option value="BILL">Vendor Bills (Credit)</option>
                <option value="PAYMENT">Payments (Debit)</option>
                <option value="DEBIT_NOTE">Debit Notes / Returns (Debit)</option>
                <option value="OPENING_BALANCE">Opening Balance</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Ledger Statement</h2>
            <span className="text-xs text-slate-500">{filteredEntries.length} entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reference #</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (PKR)</th>
                  <th className="py-3 px-4 text-right">Credit (PKR)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {isLedgerLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading ledger entries...
                    </td>
                  </tr>
                ) : filteredEntries.length > 0 ? (
                  filteredEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600">
                        {e.date}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            e.type === 'BILL'
                              ? 'bg-rose-50 text-brand-burgundy border-rose-200'
                              : e.type === 'PAYMENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : e.type === 'DEBIT_NOTE'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {e.type.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700 font-medium">
                        {e.referenceNumber}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-sm">
                        <span>{e.description}</span>
                        {e.branchName && (
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            {e.branchName}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs whitespace-nowrap">
                        {e.debit > 0 ? (
                          <span className="font-semibold text-emerald-700">
                            Rs. {e.debit.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs whitespace-nowrap">
                        {e.credit > 0 ? (
                          <span className="font-semibold text-rose-700">
                            Rs. {e.credit.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-sm whitespace-nowrap text-slate-900">
                        Rs. {e.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No ledger transactions found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SupplierLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Supplier Ledger...
        </div>
      }
    >
      <SupplierLedgerContent />
    </Suspense>
  );
}
