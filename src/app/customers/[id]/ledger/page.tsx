'use client';

import React, { use, Suspense } from 'react';
import Link from 'next/link';
import {
  useGetCustomerByIdQuery,
  useGetCustomerLedgerQuery,
} from '@/store/services/apiSlice';
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  CreditCard,
  Building2,
  Truck,
  User,
  CheckCircle2,
  Receipt,
  Download,
  AlertCircle,
  Calendar,
} from 'lucide-react';

interface LedgerPageProps {
  params: Promise<{ id: string }>;
}

function LedgerContent({ params }: LedgerPageProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;

  const { data: customer, isLoading: isCustLoading } = useGetCustomerByIdQuery(customerId);
  const { data: ledgerEntries = [], isLoading: isLedgerLoading } =
    useGetCustomerLedgerQuery(customerId);

  const availableCredit = customer
    ? Math.max(0, customer.creditLimit - customer.currentOutstanding)
    : 0;

  // Print statement
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            href="/customers"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Customers</span>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight font-sans flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <span>Customer Account Ledger</span>
            </h1>
            <p className="text-xs text-slate-500 font-sans">
              Complete chronological statement of credit sales, recoveries, and running balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/payments/collections?customerId=${customerId}`}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>Record Payment Recovery</span>
          </Link>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Statement</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
        {/* Customer Profile & Financial Summary Card */}
        {isCustLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading customer profile...
          </div>
        ) : !customer ? (
          <div className="p-8 text-center text-xs text-rose-500 bg-white rounded-2xl border border-rose-200">
            Customer account not found.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                    customer.customerType === 'DISTRIBUTOR'
                      ? 'bg-purple-100 text-purple-700'
                      : customer.customerType === 'WHOLESALE'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {customer.customerType === 'DISTRIBUTOR' ? (
                    <Truck className="w-6 h-6" />
                  ) : customer.customerType === 'WHOLESALE' ? (
                    <Building2 className="w-6 h-6" />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-900 font-sans">
                      {customer.name}
                    </h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {customer.customerCode}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        customer.customerType === 'DISTRIBUTOR'
                          ? 'bg-purple-100 text-purple-700'
                          : customer.customerType === 'WHOLESALE'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {customer.customerType}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1 font-sans">
                    {customer.businessName && (
                      <span className="font-semibold text-slate-700">
                        {customer.businessName}
                      </span>
                    )}
                    <span>Phone: {customer.phone}</span>
                    {customer.email && <span>Email: {customer.email}</span>}
                    {customer.city && <span>City: {customer.city}</span>}
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    customer.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {customer.status} ACCOUNT
                </span>
              </div>
            </div>

            {/* Financial Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
              <div>
                <span className="text-xs text-slate-500 font-semibold block">Credit Limit</span>
                <span className="text-lg font-extrabold text-slate-800 font-sans">
                  Rs. {customer.creditLimit.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-semibold block">
                  Current Outstanding (Due)
                </span>
                <span className="text-lg font-black text-purple-800 font-sans">
                  Rs. {customer.currentOutstanding.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-semibold block">Available Credit</span>
                <span
                  className={`text-lg font-extrabold font-sans ${
                    customer.currentOutstanding >= customer.creditLimit
                      ? 'text-rose-600'
                      : 'text-emerald-700'
                  }`}
                >
                  Rs. {availableCredit.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 font-semibold block">Credit Terms</span>
                <span className="text-sm font-bold text-slate-700 font-sans">
                  {customer.creditTerms} ({customer.defaultDueDays} Days)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Chronological Account Ledger Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="font-bold text-sm text-slate-800 font-sans">
                Statement of Account Transactions
              </h3>
              <p className="text-[11px] text-slate-500">
                Debits increase customer receivable; Credits decrease receivable (payments &amp; credits)
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {ledgerEntries.length} Transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reference #</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (Rs.)</th>
                  <th className="py-3 px-4 text-right">Credit (Rs.)</th>
                  <th className="py-3 px-4 text-right">Balance (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {isLedgerLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading ledger transactions...
                    </td>
                  </tr>
                ) : ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No posted ledger entries recorded for this customer account yet.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry) => {
                    const formattedDate = new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'short',
                    }).format(new Date(entry.transactionDate || entry.date || entry.createdAt));

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-slate-500 font-sans">{formattedDate}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.type === 'INVOICE'
                                ? 'bg-amber-100 text-amber-800'
                                : entry.type === 'PAYMENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : entry.type === 'ADVANCE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {entry.referenceNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {entry.description}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-sans">
                          {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-sans">
                          {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans">
                          Rs. {entry.runningBalance.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CustomerLedgerPage(props: LedgerPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500">
          Loading customer account ledger...
        </div>
      }
    >
      <LedgerContent {...props} />
    </Suspense>
  );
}
