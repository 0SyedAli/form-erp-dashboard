'use client';

import React, { use, Suspense } from 'react';
import Link from 'next/link';
import {
  useGetCustomerByIdQuery,
  useGetCustomerLedgerQuery,
} from '@/store/services/apiSlice';
import {
  useGetCustomerByIdQuery as useGetBackendCustomerByIdQuery,
  useGetCustomerLedgerQuery as useGetBackendCustomerLedgerQuery,
} from '@/store/services/posApi';
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Building2,
  Truck,
  User,
  Receipt,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { formatDate } from '@/utils/formatters';

interface LedgerPageProps {
  params: Promise<{ id: string }>;
}

function LedgerContent({ params }: LedgerPageProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const isBackendMode = process.env.NEXT_PUBLIC_DATA_MODE === 'backend';

  const { data: demoCustomer, isLoading: isDemoCustLoading } = useGetCustomerByIdQuery(customerId, {
    skip: isBackendMode,
  });
  const { data: demoLedgerEntries = [], isLoading: isDemoLedgerLoading } = useGetCustomerLedgerQuery(
    customerId,
    { skip: isBackendMode }
  );

  const { data: backendCustomer, isLoading: isBackendCustLoading } = useGetBackendCustomerByIdQuery(
    customerId,
    { skip: !isBackendMode }
  );
  const { data: backendLedgerData, isLoading: isBackendLedgerLoading } =
    useGetBackendCustomerLedgerQuery({ id: customerId }, { skip: !isBackendMode });

  const customer = isBackendMode
    ? (backendCustomer || backendLedgerData?.customer
      ? ({
        ...backendCustomer,
        ...backendLedgerData?.customer,
        id:
          (backendCustomer || backendLedgerData?.customer)?.id ||
          (backendCustomer || backendLedgerData?.customer)?._id,
        code:
          ((backendCustomer || backendLedgerData?.customer) as any)?.code ||
          ((backendCustomer || backendLedgerData?.customer) as any)?.customerCode ||
          'CUST',
        currentOutstanding:
          (backendCustomer || backendLedgerData?.customer)?.currentOutstanding ||
          backendLedgerData?.summary?.currentBalance ||
          0,
      } as any)
      : null)
    : demoCustomer;

  const ledgerEntries = isBackendMode
    ? ((backendLedgerData?.entries || []).map((e: any) => ({
      id: e.id || e._id,
      customerId: e.customerId,
      date: e.entryDate || e.date || e.createdAt || e.timestamp,
      type: e.entryType || e.type,
      referenceNumber: e.referenceInvoiceId,
      description: e.description || 'N/A',
      debit: e.debit,
      credit: e.credit,
      runningBalance: e.runningBalance,
      branchId: e?.branchId?.code,
    })) as any[])
    : demoLedgerEntries;

  const isCustLoading = isBackendMode ? isBackendCustLoading : isDemoCustLoading;
  const isLedgerLoading = isBackendMode ? isBackendLedgerLoading : isDemoLedgerLoading;

  const availableCredit = customer
    ? Math.max(0, customer.creditLimit - customer.currentOutstanding)
    : 0;

  const isLimitExceeded = Boolean(
    customer && customer.creditLimit > 0 && customer.currentOutstanding >= customer.creditLimit
  );
  const overLimitAmount = isLimitExceeded && customer
    ? customer.currentOutstanding - customer.creditLimit
    : 0;

  // Print statement
  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="space-y-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/customers"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Customers</span>
            </Link>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans flex items-center gap-2">
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
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {/* Khata Alert Banner when Credit Limit is Exceeded */}
        {isLimitExceeded && (
          <div className="bg-rose-50 border-2 border-rose-500/80 rounded-2xl p-4 sm:p-5 text-rose-950 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-600 text-white">
                    Limit Exceeded (خاتہ بلاک / اوور لِمٹ)
                  </span>
                  <span className="text-xs font-bold text-rose-700">
                    Over by Rs. {overLimitAmount.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-1 font-medium leading-relaxed">
                  اس کسٹمر کا موجودہ بقایا واجب الادا بیلنس (<strong>Rs. {customer?.currentOutstanding?.toLocaleString()}</strong>) اس کی منظور شدہ حد (<strong>Rs. {customer?.creditLimit?.toLocaleString()}</strong>) سے تجاوز کر چکا ہے۔ نئی ادھار سیل سے قبل پرانی ریکوری وصول کریں۔
                </p>
              </div>
            </div>

            <Link
              href={`/payments/collections?customerId=${customerId}`}
              className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-stretch sm:self-auto justify-center cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>فوری ریکوری درج کریں (Collect Now)</span>
            </Link>
          </div>
        )}

        {/* Main Content Area */}
        <div className="space-y-6">
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
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${customer.customerType === 'DISTRIBUTOR'
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
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${customer.customerType === 'DISTRIBUTOR'
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
                    className={`px-3 py-1 rounded-full text-xs font-bold ${customer.status === 'ACTIVE'
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
                  <span className="text-lg font-black text-red-500 font-sans">
                    Rs. {customer.currentOutstanding.toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Available Credit</span>
                  <span
                    className={`text-lg font-extrabold font-sans ${customer.currentOutstanding >= customer.creditLimit
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
                    <th className="py-3 px-4">Branch</th>
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
                      const formattedDate = formatDate(entry.transactionDate || entry.date || entry.createdAt);

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 text-slate-500 font-sans">{formattedDate}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.type === 'INVOICE'
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
                            {entry.branchId}
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
        </div>
      </div>
    </AppLayout>
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
