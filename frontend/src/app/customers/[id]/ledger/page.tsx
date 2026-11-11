'use client';

import React, { use, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  useGetCustomerByIdQuery,
  useGetCustomerLedgerQuery,
} from '@/store/services/apiSlice';
import {
  useGetCustomerLedgerQuery as useGetBackendCustomerLedgerQuery,
  useGetBranchesQuery as useGetBackendBranchesQuery,
} from '@/store/services/posApi';
import { useAppSelector } from '@/store';
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  ArrowUpDown,
  Building2,
  Truck,
  User,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Store,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { formatDate, formatDateTime } from '@/utils/formatters';
import { useClientPagination } from '@/components/common/Pagination';

interface LedgerPageProps {
  params: Promise<{ id: string }>;
}

function LedgerContent({ params }: LedgerPageProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const isBackendMode = process.env.NEXT_PUBLIC_DATA_MODE === 'backend';

  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Branch selector state (Super Admin can switch; Branch staff is locked to their branch)
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Demo Queries
  const { data: demoCustomer, isLoading: isDemoCustLoading } = useGetCustomerByIdQuery(customerId, {
    skip: isBackendMode,
  });
  const { data: demoLedgerEntries = [], isLoading: isDemoLedgerLoading } = useGetCustomerLedgerQuery(
    customerId,
    { skip: isBackendMode }
  );

  // Backend Queries (Single optimized ledger query returning both customer and branch-scoped entries)
  const { data: backendLedgerData, isLoading: isBackendLedgerLoading } =
    useGetBackendCustomerLedgerQuery(
      {
        id: customerId,
        branchId: isSuperAdmin ? (selectedBranch !== 'ALL' ? selectedBranch : undefined) : undefined,
      },
      { skip: !isBackendMode }
    );

  // Super Admin Branches query (only loaded if Super Admin)
  const { data: backendBranches = [] } = useGetBackendBranchesQuery(undefined, {
    skip: !isBackendMode || !isSuperAdmin,
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  // Normalized Customer Object (Directly resolved from ledger data - no separate customer API call needed)
  const customer = useMemo(() => {
    if (isBackendMode) {
      const src = backendLedgerData?.customer;
      if (!src) return null;
      return {
        ...src,
        id: src.id || src._id,
        name: src.name || 'Customer',
        phone: src.phone || '-',
        email: src.email || '',
        city: src.city || 'Karachi',
        address: src.address || '',
        businessName: src.businessName || '',
        customerType: src.customerType || 'WALK_IN',
        customerCode: src.code || src.customerCode || `CUST-${src.phone ? src.phone.slice(-4) : '0000'}`,
        status: src.status || 'ACTIVE',
        creditLimit: Number(src.creditLimit || 0),
        creditTerms: src.creditTerms || '30 Days Net Credit',
        defaultDueDays: Number(src.defaultDueDays || 30),
        currentOutstanding: Number(
          (src as any).currentOutstanding ?? (src as any).outstandingBalance ?? backendLedgerData?.summary?.currentBalance ?? 0
        ),
      };
    }
    return demoCustomer;
  }, [isBackendMode, backendLedgerData, demoCustomer]);

  // Normalized Ledger Entries
  const rawEntries = useMemo(() => {
    if (isBackendMode) {
      return (backendLedgerData?.entries || []).map((e: any) => ({
        id: e.id || e._id,
        customerId: e.customerId,
        date: e.timestamp || e.entryDate || e.date || e.createdAt,
        type: e.entryType || e.type || 'INVOICE',
        referenceNumber:
          e.referenceNumber ||
          e.referenceInvoiceId ||
          e.referencePaymentId ||
          e.documentNumber ||
          '-',
        description: e.description || e.narration || 'Transaction recorded',
        branchName:
          e.branchName ||
          e.branchId?.name ||
          e.branchId?.code ||
          e.branchCode ||
          'Main Branch',
        performedBy: e.performedBy || 'System',
        debit: Number(e.debit || 0),
        credit: Number(e.credit || 0),
        runningBalance: Number(e.runningBalance || 0),
      }));
    }
    return (demoLedgerEntries || []).map((e: any) => ({
      id: e.id || e._id,
      customerId: e.customerId,
      date: e.date || e.createdAt,
      type: e.type || 'INVOICE',
      referenceNumber: e.referenceNumber || e.referenceInvoiceId || '-',
      description: e.description || e.narration || 'Transaction recorded',
      branchName: e.branchName || 'Main Branch',
      performedBy: e.performedBy || 'Cashier',
      debit: Number(e.debit || 0),
      credit: Number(e.credit || 0),
      runningBalance: Number(e.runningBalance || 0),
    }));
  }, [isBackendMode, backendLedgerData, demoLedgerEntries]);

  // Filtered & Sorted Ledger Entries
  const filteredEntries = useMemo(() => {
    return rawEntries
      .filter((e) => {
        if (typeFilter !== 'ALL' && e.type !== typeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchRef = e.referenceNumber.toLowerCase().includes(q);
          const matchDesc = e.description.toLowerCase().includes(q);
          const matchBranch = e.branchName.toLowerCase().includes(q);
          const matchUser = e.performedBy.toLowerCase().includes(q);
          if (!matchRef && !matchDesc && !matchBranch && !matchUser) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return sortOrder === 'DESC' ? timeB - timeA : timeA - timeB;
      });
  }, [rawEntries, typeFilter, searchQuery, sortOrder]);

  // Client-Side Pagination (Only shows when entries > 10)
  const { paginatedItems: paginatedEntries, PaginationComponent: LedgerPagination } =
    useClientPagination(filteredEntries, 10, 'ledger entries');

  // Financial Summary
  const summary = useMemo(() => {
    const totalDebit = rawEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = rawEntries.reduce((sum, e) => sum + e.credit, 0);
    const outstanding =
      customer?.currentOutstanding ?? Math.max(0, totalDebit - totalCredit);
    const creditLimit = customer?.creditLimit ?? 0;
    const availableCredit = Math.max(0, creditLimit - outstanding);
    const isLimitExceeded = Boolean(creditLimit > 0 && outstanding > creditLimit);
    const overLimitAmount = isLimitExceeded ? outstanding - creditLimit : 0;

    return {
      totalDebit,
      totalCredit,
      outstanding,
      creditLimit,
      availableCredit,
      isLimitExceeded,
      overLimitAmount,
      transactionCount: rawEntries.length,
    };
  }, [rawEntries, customer]);

  const isCustLoading = isBackendMode ? isBackendLedgerLoading : isDemoCustLoading;
  const isLedgerLoading = isBackendMode ? isBackendLedgerLoading : isDemoLedgerLoading;

  // Print statement
  const handlePrint = () => {
    window.print();
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!customer || rawEntries.length === 0) return;
    const headers = [
      'Date',
      'Type',
      'Reference #',
      'Branch',
      'Description',
      'Staff',
      'Debit (PKR)',
      'Credit (PKR)',
      'Running Balance (PKR)',
    ];
    const rows = rawEntries.map((e) => [
      `"${formatDate(e.date)}"`,
      `"${e.type}"`,
      `"${e.referenceNumber}"`,
      `"${e.branchName}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.performedBy}"`,
      e.debit,
      e.credit,
      e.runningBalance,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Statement_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="space-y-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
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

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/payments/collections?customerId=${customerId}`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Record Payment Recovery</span>
            </Link>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download statement as CSV"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Print account statement"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {/* Khata Alert Banner when Credit Limit is Exceeded */}
        {summary.isLimitExceeded && (
          <div className="bg-rose-50 border-2 border-rose-500/80 rounded-2xl p-4 sm:p-5 text-rose-950 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200 print:hidden">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-600 text-white">
                    Credit Limit Exceeded (اوور لِمٹ / کھاتہ بلاک)
                  </span>
                  <span className="text-xs font-bold text-rose-700">
                    Over by Rs. {summary.overLimitAmount.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-1 font-medium leading-relaxed">
                  اس کسٹمر کا موجودہ بقایا واجب الادا بیلنس (
                  <strong>Rs. {summary.outstanding.toLocaleString()}</strong>) منظور شدہ حد (
                  <strong>Rs. {summary.creditLimit.toLocaleString()}</strong>) سے تجاوز کر چکا ہے۔ نئی کریڈٹ سیل سے قبل وصولی درج کریں۔
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

        {/* Customer Profile Header Card */}
        {isCustLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
            Loading customer profile...
          </div>
        ) : !customer ? (
          <div className="p-8 text-center text-xs text-rose-500 bg-white rounded-2xl border border-rose-200">
            Customer account not found.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 font-sans">
                      {customer.name}
                    </h2>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
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

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5 font-sans">
                    {customer.businessName && (
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {customer.businessName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {customer.phone}
                    </span>
                    {customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {customer.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {customer.city}
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch Scope & Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Branch Khata Isolation Indicator */}
                {isSuperAdmin ? (
                  <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200 print:hidden">
                    <Store className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Branches (Consolidated Khata)</option>
                      {backendBranches.map((b: any) => (
                        <option key={b.id || b._id} value={b.id || b._id}>
                          {b.name} ({b.code || b.shopNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 print:hidden">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>Branch: {(currentUser as any)?.branchName || (currentUser as any)?.branch?.name || 'Assigned Branch'}</span>
                  </span>
                )}

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                    customer.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{customer.status} ACCOUNT</span>
                </span>
              </div>
            </div>

            {/* 4 Financial KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-semibold block">Total Invoiced (Debits)</span>
                <span className="text-lg font-black text-slate-900 font-sans block mt-0.5">
                  Rs. {summary.totalDebit.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">Total purchases on account</span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <span className="text-xs text-emerald-800 font-semibold block">Total Recovered (Credits)</span>
                <span className="text-lg font-black text-emerald-700 font-sans block mt-0.5">
                  Rs. {summary.totalCredit.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-600">Total payments collected</span>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${summary.outstanding > 0
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
              >
                <span className="text-xs font-semibold block text-slate-600">
                  Current Balance Due (Baqaya)
                </span>
                <span
                  className={`text-lg font-black font-sans block mt-0.5 ${summary.outstanding > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                >
                  Rs. {summary.outstanding.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500">
                  {summary.outstanding > 0 ? 'Receivable from customer' : 'Account settled (No dues)'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-semibold block">Credit Limit &amp; Avail</span>
                <span className="text-lg font-black text-slate-900 font-sans block mt-0.5">
                  Rs. {summary.availableCredit.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500">
                  Limit: Rs. {summary.creditLimit.toLocaleString()} • {customer.creditTerms}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Ledger Transactions Table Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 sm:px-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div>
              <h3 className="font-bold text-sm text-slate-800 font-sans flex items-center gap-2">
                <span>Statement of Account Transactions</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                  {filteredEntries.length} of {rawEntries.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Debits increase customer receivable; Credits decrease receivable (payments &amp; collections)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search invoice, ref, narration..."
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
                />
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Transactions</option>
                <option value="INVOICE">Invoices (Debits)</option>
                <option value="PAYMENT">Payments (Credits)</option>
                <option value="ADVANCE">Advances</option>
                <option value="ADJUSTMENT">Adjustments</option>
              </select>

              {/* Sort Order Toggle */}
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
                className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                title="Toggle sorting order"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>{sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}</span>
              </button>
            </div>
          </div>

          {/* Printable Statement Header (Visible only when printed) */}
          <div className="hidden print:block p-6 border-b border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black text-slate-900">MOLTY FOAM ERP</h1>
                <p className="text-xs text-slate-600">Customer Account Statement / Khata Ledger</p>
                <p className="text-xs text-slate-500 mt-1">Generated: {formatDateTime(new Date())}</p>
              </div>
              <div className="text-right">
                <h3 className="font-bold text-sm text-slate-900">{customer?.name}</h3>
                <p className="text-xs text-slate-600">{customer?.phone}</p>
                <p className="text-xs text-slate-600">{customer?.city}</p>
                <p className="text-xs font-mono font-bold mt-1 text-slate-800">
                  {customer?.customerCode}
                </p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reference #</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Narration / Description</th>
                  <th className="py-3 px-4">Staff</th>
                  <th className="py-3 px-4 text-right">Debit (Rs.)</th>
                  <th className="py-3 px-4 text-right">Credit (Rs.)</th>
                  <th className="py-3 px-4 text-right">Balance (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {isLedgerLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Loading ledger transactions...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      {rawEntries.length === 0
                        ? 'No posted ledger entries recorded for this customer account yet.'
                        : 'No transactions match the selected search or filter.'}
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => {
                    const formattedDate = formatDateTime(entry.date);

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-slate-600 font-sans whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.type === 'INVOICE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : entry.type === 'PAYMENT'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : entry.type === 'ADVANCE'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {entry.referenceNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          <span className="flex items-center gap-1 font-medium">
                            <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{entry.branchName}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-sm text-xs leading-relaxed">
                          {entry.description}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                          {entry.performedBy}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-sans whitespace-nowrap">
                          {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-sans whitespace-nowrap">
                          {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans whitespace-nowrap">
                          Rs. {entry.runningBalance.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Table Footer with Column Totals */}
              {filteredEntries.length > 0 && (
                <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-black text-xs text-slate-900">
                  <tr>
                    <td colSpan={6} className="py-3.5 px-4 text-right font-bold text-slate-600">
                      Total for Current View:
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans">
                      Rs.{' '}
                      {filteredEntries
                        .reduce((sum, e) => sum + e.debit, 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 font-sans">
                      Rs.{' '}
                      {filteredEntries
                        .reduce((sum, e) => sum + e.credit, 0)
                        .toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-rose-700 font-sans">
                      Rs. {summary.outstanding.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination Controls (Only renders when entries > 10) */}
          {LedgerPagination}
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
