'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useGetInvoicesQuery,
  useGetBranchesQuery,
  useGetCustomersQuery,
} from '@/store/services/apiSlice';
import {
  useGetInvoicesQuery as useGetBackendInvoicesQuery,
  useGetBranchesQuery as useGetBackendBranchesQuery,
  useGetCustomersQuery as useGetBackendCustomersQuery,
  useDeleteInvoiceMutation,
} from '@/store/services/posApi';
import { useAppSelector } from '@/store';
import { Invoice } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { getPendingSales } from '@/lib/offline/posOfflineDb';
import { formatDate, formatDateTime } from '@/utils/formatters';
import { useClientPagination } from '@/components/common/Pagination';
import {
  ArrowLeft,
  Search,
  Printer,
  Store,
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  Truck,
  User,
  AlertCircle,
  CheckCircle,
  Eye,
  Edit3,
  Trash2,
  PackageCheck,
  RotateCcw,
  Receipt,
  X,
  AlertTriangle,
} from 'lucide-react';
import InvoiceReceiptModal from '@/components/pos/InvoiceReceiptModal';

function SalesHistoryContent() {
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isBackendMode =
    process.env.NEXT_PUBLIC_DATA_MODE === 'backend' ||
    process.env.NEXT_PUBLIC_USE_BACKEND !== 'false';

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'SALES' | 'DISPATCHES'>('SALES');

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: demoInvoices = [], isLoading: isDemoLoading } = useGetInvoicesQuery(
    {},
    { skip: !mounted || isBackendMode }
  );
  const { data: demoBranches = [] } = useGetBranchesQuery(undefined, { skip: !mounted || isBackendMode });
  const { data: demoCustomers = [] } = useGetCustomersQuery(undefined, { skip: !mounted || isBackendMode });

  const { data: backendInvoices = [], isLoading: isBackendLoading } = useGetBackendInvoicesQuery(
    { limit: 100, scope: activeTab === 'DISPATCHES' ? 'dispatches' : 'sales' },
    { skip: !mounted || !isBackendMode, refetchOnMountOrArgChange: true }
  );
  const { data: backendBranches = [] } = useGetBackendBranchesQuery(undefined, {
    skip: !mounted || !isBackendMode,
  });
  const { data: backendCustomers = [] } = useGetBackendCustomersQuery(undefined, {
    skip: !mounted || !isBackendMode,
  });

  const rawBranches = isBackendMode
    ? (Array.isArray(backendBranches) ? backendBranches : (backendBranches as any)?.data || [])
    : demoBranches;
  const branches: any[] = (Array.isArray(rawBranches) ? rawBranches : []).map((b: any) => ({
    ...b,
    id: String(b.id || b._id || ''),
  }));

  const rawCustomers = isBackendMode
    ? (Array.isArray(backendCustomers) ? backendCustomers : (backendCustomers as any)?.data || [])
    : demoCustomers;
  const customers: any[] = (Array.isArray(rawCustomers) ? rawCustomers : []).map((c: any) => ({
    ...c,
    id: String(c.id || c._id || ''),
  }));

  const [offlineInvoices, setOfflineInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    getPendingSales().then((sales) => {
      if (sales && sales.length > 0) {
        setOfflineInvoices(sales.map((s) => s.invoice));
      }
    });

    let wasOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const handleOffline = () => { wasOffline = true; };
    const handleOnline = () => {
      if (wasOffline) {
        window.location.reload();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        e.preventDefault();
        e.returnValue = 'Offline Mode Active.';
        return e.returnValue;
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const invoices = useMemo(() => {
    if (isBackendMode) {
      const liveMapped = (backendInvoices || []).map((inv: any) => {
        const net = Number(inv.total ?? inv.netAmount ?? inv.grandTotal ?? 0);
        const gross = Number(inv.subtotal ?? inv.grossAmount ?? net);
        const discount = Number(inv.discount ?? inv.discountAmount ?? 0);
        const paid = Number(inv.paidAmount ?? inv.amountPaid ?? inv.amountReceived ?? 0);
        const due = Number(inv.balanceDue ?? inv.amountDue ?? 0);

        // Branch resolution
        const branchObj = typeof inv.branchId === 'object' && inv.branchId ? inv.branchId : null;
        const bId = branchObj ? String(branchObj._id || branchObj.id || '') : String(inv.branchId || '');
        const bName = branchObj ? branchObj.name : (inv.branchName || 'Branch');

        // Source branch resolution (for cross-branch dispatches)
        const sourceBranchObj = typeof inv.sourceBranchId === 'object' && inv.sourceBranchId ? inv.sourceBranchId : null;
        const sBId = sourceBranchObj ? String(sourceBranchObj._id || sourceBranchObj.id || '') : String(inv.sourceBranchId || '');
        const sBName = sourceBranchObj ? sourceBranchObj.name : (inv.sourceBranchName || '');

        // Customer resolution
        const custObj = typeof inv.customerId === 'object' && inv.customerId ? inv.customerId : null;
        const cId = custObj ? String(custObj._id || custObj.id || '') : (inv.customerId ? String(inv.customerId) : '');
        const cName = inv.customerName || (custObj ? custObj.name : 'Walk-in Customer');
        const cPhone = inv.customerPhone || (custObj ? custObj.phone : '');

        return {
          ...inv,
          id: String(inv.id || inv._id || ''),
          invoiceNumber: inv.invoiceNumber,
          branchId: bId,
          branchName: bName,
          sourceBranchId: sBId,
          sourceBranchName: sBName,
          isInterBranch: Boolean(inv.isInterBranch || (sBId && sBId !== bId)),
          customerId: cId,
          customerName: cName,
          customerPhone: cPhone,
          customerType: inv.customerType || 'WALK_IN',
          saleType: inv.saleType || 'WALK_IN',
          grossAmount: gross,
          subtotal: gross,
          discountAmount: discount,
          netAmount: net,
          grandTotal: net,
          amountPaid: paid,
          amountReceived: paid,
          amountDue: due,
          paymentStatus: inv.paymentStatus || 'PAID',
          paymentMethod: inv.paymentArrangement || inv.paymentMethod || 'CASH',
          status: inv.status || 'COMPLETED',
          date: inv.date || inv.createdAt,
          createdAt: inv.createdAt || inv.date,
          salesPerson: inv.cashierName || inv.salesPerson || 'Cashier',
          items: (inv.items || []).map((it: any) => ({
            productId: it.variantId || it.productId || it.sku,
            productName: it.productName || it.sku,
            sku: it.sku,
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            discount: it.discount || 0,
            total: it.lineTotal ?? it.total ?? ((it.unitPrice || 0) * (it.quantity || 1)),
            lineTotal: it.lineTotal ?? it.total ?? ((it.unitPrice || 0) * (it.quantity || 1)),
            sizeLabel: it.sizeLabel || '',
            thicknessLabel: it.thicknessLabel || '',
          })),
        };
      }) as Invoice[];
      return [...offlineInvoices, ...liveMapped];
    }
    return [...offlineInvoices, ...demoInvoices];
  }, [isBackendMode, backendInvoices, demoInvoices, offlineInvoices]);

  const isLoading = isBackendMode ? isBackendLoading : isDemoLoading;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const userBranchId = currentUser?.assignedBranchId || currentUser?.branchId;
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    userBranchId || 'ALL'
  );
  const [selectedSaleType, setSelectedSaleType] = useState<string>('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');

  const router = useRouter();
  const [deleteInvoiceMutation, { isLoading: isDeletingInvoice }] = useDeleteInvoiceMutation();

  // Detail, Edit & Delete modal states
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDeleteInvoice = async (returnStock: boolean) => {
    if (!deletingInvoice) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await deleteInvoiceMutation({
        id: deletingInvoice.id,
        returnStock,
      }).unwrap();
      setActionSuccess(
        `Invoice #${deletingInvoice.invoiceNumber} deleted successfully (${
          returnStock ? 'Stock restored to inventory' : 'Stock inventory unchanged'
        }).`
      );
      setDeletingInvoice(null);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(
        err?.data?.error?.message || err?.message || 'Failed to delete invoice.'
      );
    }
  };

  // Filtered sales list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Tab filter: Terminal Sales vs Cross-Branch Dispatches
      if (activeTab === 'DISPATCHES') {
        if (!inv.isInterBranch) return false;
        if (!isSuperAdmin && userBranchId && inv.sourceBranchId && inv.sourceBranchId !== userBranchId) {
          return false;
        }
        if (selectedBranchId !== 'ALL' && inv.sourceBranchId && inv.sourceBranchId !== selectedBranchId) {
          return false;
        }
      } else {
        // Standard terminal sales
        if (!isSuperAdmin && userBranchId && inv.branchId !== userBranchId) {
          return false;
        }
        if (selectedBranchId !== 'ALL' && inv.branchId !== selectedBranchId) {
          return false;
        }
      }

      // Sale type filter
      const invSaleType = inv.saleType || (inv.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'WALK_IN');
      if (selectedSaleType !== 'ALL' && invSaleType !== selectedSaleType) {
        return false;
      }

      // Payment Status filter
      if (selectedPaymentStatus !== 'ALL') {
        const isOverdue =
          inv.isOverdue ||
          (inv.amountDue > 0 &&
            inv.dueDate &&
            new Date(inv.dueDate).getTime() < new Date().getTime());

        if (selectedPaymentStatus === 'OVERDUE') {
          if (!isOverdue) return false;
        } else if (inv.paymentStatus !== selectedPaymentStatus) {
          return false;
        }
      }

      // Customer filter
      if (selectedCustomerId !== 'ALL' && inv.customerId !== selectedCustomerId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesNum = inv.invoiceNumber.toLowerCase().includes(query);
        const matchesCust = (inv.customerName || '').toLowerCase().includes(query);
        const matchesCashier = (inv.salesPerson || inv.cashierName || '').toLowerCase().includes(query);
        if (!matchesNum && !matchesCust && !matchesCashier) return false;
      }
      return true;
    });
  }, [
    invoices,
    isSuperAdmin,
    userBranchId,
    selectedBranchId,
    selectedSaleType,
    selectedPaymentStatus,
    selectedCustomerId,
    searchQuery,
  ]);

  // Client-Side Pagination (Only renders when invoices > 10)
  const { paginatedItems: paginatedInvoices, PaginationComponent: InvoicesPagination } =
    useClientPagination(filteredInvoices, 10, 'invoices');

  // Summary Metrics
  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.netAmount ?? inv.grandTotal ?? 0), 0);
  }, [filteredInvoices]);

  const totalCollected = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.amountPaid ?? 0), 0);
  }, [filteredInvoices]);

  const totalOutstanding = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.amountDue ?? 0), 0);
  }, [filteredInvoices]);

  const activeBranch = useMemo(() => {
    if (!selectedInvoice) return null;
    const found = branches.find((b: any) => b.id === selectedInvoice.branchId);
    if (found) return found;
    return {
      id: selectedInvoice.branchId,
      name: selectedInvoice.branchName || 'Main Branch',
      code: 'MAIN',
      shopNumber: 'Shop #12-14',
      address: 'Main Showroom',
      city: 'Karachi',
      phone: '021-3456789',
    };
  }, [branches, selectedInvoice]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to POS</span>
            </Link>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans">
                POS Sales History &amp; Invoices
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Browse Walk-in, Wholesale, and Distributor counter sales, credit invoices, and receipts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pos"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open POS Terminal</span>
            </Link>
            <Link
              href="/payments/collections"
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-slate-500" />
              <span>Collections</span>
            </Link>
          </div>
        </div>

        {/* Sales vs Cross-Branch Dispatches Tab Switcher */}
        <div className="flex border-b border-slate-200 gap-2 bg-white px-4 pt-2 rounded-2xl shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('SALES')}
            className={`py-3 px-4 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'SALES'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Store className="w-4 h-4" />
            {/* <span>Terminal Sales (ہماری برانچ کی سیلز)</span> */}
            <span>Terminal Sales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DISPATCHES')}
            className={`py-3 px-4 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'DISPATCHES'
              ? 'border-amber-600 text-amber-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Truck className="w-4 h-4" />
            {/* <span>Cross-Branch Dispatches (دوسری برانچز کو گیا سٹاک)</span> */}
            <span>Cross-Branch Dispatches </span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold font-sans">Total Sales Value</p>
                <h3 className="text-xl font-black text-slate-900 mt-1 font-sans">
                  Rs. {totalRevenue.toLocaleString()}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {filteredInvoices.length} Invoices
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold font-sans">Payments Collected</p>
                <h3 className="text-xl font-black text-emerald-700 mt-1 font-sans">
                  Rs. {totalCollected.toLocaleString()}
                </h3>
                <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Realized Cash &amp; Bank</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold font-sans">Outstanding Receivables</p>
                <h3 className="text-xl font-black text-purple-700 mt-1 font-sans">
                  Rs. {totalOutstanding.toLocaleString()}
                </h3>
                <p className="text-[11px] text-purple-600 mt-0.5 font-medium">Pending Recovery</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold font-sans">Average Order Value</p>
                <h3 className="text-xl font-black text-slate-900 mt-1 font-sans">
                  Rs.{' '}
                  {filteredInvoices.length > 0
                    ? Math.round(totalRevenue / filteredInvoices.length).toLocaleString()
                    : 0}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Across filtered sales</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Action Feedback Alerts */}
          {actionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionSuccess(null)}
                className="text-emerald-500 hover:text-emerald-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-rose-500 hover:text-rose-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice #, customer or cashier..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sale Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Tier:</span>
              <select
                value={selectedSaleType}
                onChange={(e) => setSelectedSaleType(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Sale Tiers</option>
                <option value="WALK_IN">Walk-in</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <select
                value={selectedPaymentStatus}
                onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="UNPAID">Unpaid (Credit)</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            {/* Customer Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Customer:</span>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden max-w-[160px] truncate"
              >
                <option value="ALL">All Customers</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customerType})
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1.5">
                <Store className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  {activeTab === 'DISPATCHES' ? (
                    <tr>
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Date &amp; Time</th>
                      <th className="py-3.5 px-4">Sold At Terminal (سیلنگ برانچ)</th>
                      <th className="py-3.5 px-4">Dispatched Items (سٹاک جو گیا)</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4 text-right">Value (مالیت)</th>
                      <th className="py-3.5 px-4">Terminal Cashier</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="py-3.5 px-4">Invoice # &amp; Date</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Branch</th>
                      <th className="py-3.5 px-4">Sale Tier</th>
                      <th className="py-3.5 px-4 text-right">Net Total</th>
                      <th className="py-3.5 px-4 text-right">Paid</th>
                      <th className="py-3.5 px-4 text-right">Balance Due</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {isLoading ? (
                    <tr>
                      <td colSpan={activeTab === 'DISPATCHES' ? 8 : 11} className="py-8 text-center text-slate-400">
                        Loading {activeTab === 'DISPATCHES' ? 'cross-branch dispatches' : 'sales records'}...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'DISPATCHES' ? 8 : 11} className="py-12 text-center text-slate-400">
                        {activeTab === 'DISPATCHES'
                          ? 'No cross-branch dispatches found. Any stock sold by other branches from your inventory will appear here.'
                          : 'No matching sales invoices found.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedInvoices.map((inv) => {
                      const formattedDate = formatDateTime(inv.date || inv.createdAt || inv.issueDate);

                      const branchName =
                        inv.branchName ||
                        branches.find((b: any) => b.id === inv.branchId)?.name ||
                        'Branch';
                      const sType = inv.saleType || (inv.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'WALK_IN');
                      const isOverdue =
                        inv.isOverdue ||
                        (inv.amountDue > 0 &&
                          inv.dueDate &&
                          new Date(inv.dueDate).getTime() < new Date().getTime());

                      if (activeTab === 'DISPATCHES') {
                        return (
                          <tr key={inv.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">{formattedDate}</td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{branchName}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Terminal: {inv.branchId}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                {(inv.items || []).map((it, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="font-bold text-amber-900">{it.quantity}×</span>{' '}
                                    <span className="font-medium text-slate-800">{it.productName}</span>{' '}
                                    {(it.sizeLabel || it.thicknessLabel) && (
                                      <span className="text-[10px] text-slate-500">
                                        ({[it.sizeLabel, it.thicknessLabel].filter(Boolean).join(' ')})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900">{inv.customerName}</span>
                              {inv.customerPhone && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {inv.customerPhone}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans">
                              Rs. {inv.netAmount.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              {inv.salesPerson || inv.cashierName || 'Cashier'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>View Receipt</span>
                              </button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* 1. Invoice & Date */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 block">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[11px] text-slate-400 font-sans block">
                              {formattedDate}
                            </span>
                          </td>

                          {/* 2. Customer */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block truncate max-w-[150px]">
                              {inv.customerName}
                            </span>
                            {inv.customerPhone && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {inv.customerPhone}
                              </span>
                            )}
                          </td>

                          {/* 3. Branch */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{branchName}</div>
                            {inv.isInterBranch && inv.sourceBranchName && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                <Truck className="w-2.5 h-2.5" />
                                From: {inv.sourceBranchName}
                              </span>
                            )}
                          </td>

                          {/* 4. Sale Tier */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sType === 'DISTRIBUTOR'
                                  ? 'bg-purple-100 text-purple-700'
                                  : sType === 'WHOLESALE'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {sType === 'DISTRIBUTOR' ? (
                                <Truck className="w-3 h-3" />
                              ) : sType === 'WHOLESALE' ? (
                                <Building2 className="w-3 h-3" />
                              ) : (
                                <User className="w-3 h-3" />
                              )}
                              <span>{sType}</span>
                            </span>
                          </td>

                          {/* 5. Net Total */}
                          <td className="py-3 px-4 text-right font-black text-slate-900 font-sans">
                            Rs. {(inv.netAmount || 0).toLocaleString()}
                          </td>

                          {/* 6. Paid */}
                          <td className="py-3 px-4 text-right font-bold text-emerald-700 font-sans">
                            Rs. {(inv.amountPaid || 0).toLocaleString()}
                          </td>

                          {/* 7. Balance Due */}
                          <td className="py-3 px-4 text-right font-black text-purple-800 font-sans">
                            {(inv.amountDue || 0) > 0 ? (
                              <div>
                                <span>Rs. {(inv.amountDue || 0).toLocaleString()}</span>
                                {inv.dueDate && (
                                  <span className={`block text-[10px] font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                    Due: {formatDate(inv.dueDate)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium">-</span>
                            )}
                          </td>

                          {/* 8. Status */}
                          <td className="py-3 px-4 text-center">
                            {isOverdue ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Overdue
                              </span>
                            ) : inv.paymentStatus === 'PAID' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                Paid
                              </span>
                            ) : inv.paymentStatus === 'PARTIALLY_PAID' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                Partial
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 text-nowrap">
                                Credit
                              </span>
                            )}
                          </td>

                          {/* 9. Actions (Eye, Edit, Receipt, Delete) */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Details Modal (Eye Button) */}
                              <button
                                type="button"
                                onClick={() => setViewingInvoice(inv)}
                                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="View Complete Sale Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Edit Invoice in POS (Edit Button) */}
                              <button
                                type="button"
                                onClick={() => router.push(`/pos?editInvoiceId=${encodeURIComponent(inv.id)}`)}
                                className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit in POS Counter"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Print Receipt / Voucher */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Print Receipt / Voucher"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Delete Invoice Modal (Trash Button) */}
                              <button
                                type="button"
                                onClick={() => setDeletingInvoice(inv)}
                                className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Invoice"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (Only renders when invoices > 10) */}
            {InvoicesPagination}
          </div>
        </div>

        {/* 1. View Complete Sale Details Modal (Eye Button) */}
        {viewingInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-base text-slate-900">
                        {viewingInvoice.invoiceNumber}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {viewingInvoice.saleType}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        viewingInvoice.paymentStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : viewingInvoice.paymentStatus === 'PARTIALLY_PAID'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {viewingInvoice.paymentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDateTime(viewingInvoice.date || viewingInvoice.createdAt)} • Cashier: {viewingInvoice.salesPerson || 'Counter'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingInvoice(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer & Branch Details */}
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border-b border-slate-100 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                    Customer Information
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {viewingInvoice.customerName}
                  </div>
                  <div className="text-slate-500">Phone: {viewingInvoice.customerPhone || 'Not recorded'}</div>
                  <div className="text-slate-500">Tier: {viewingInvoice.customerType || viewingInvoice.saleType}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                    Branch &amp; Payment Summary
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {viewingInvoice.branchName || 'Main Branch'}
                  </div>
                  <div className="text-slate-500">Payment: {viewingInvoice.paymentMethod || 'Cash'}</div>
                  {viewingInvoice.dueDate && viewingInvoice.amountDue > 0 && (
                    <div className="text-amber-700 font-semibold">
                      Due Date: {formatDate(viewingInvoice.dueDate)}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="p-5 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Purchased Items ({viewingInvoice.items?.length || 0})
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Item / SKU</th>
                        <th className="py-2.5 px-3 text-center">Specs</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(viewingInvoice.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">{it.productName}</span>
                            <span className="font-mono text-[10px] text-slate-400">{it.sku}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">
                            {[it.sizeLabel, it.thicknessLabel].filter(Boolean).join(' • ') || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            Rs. {(it.unitPrice || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 font-sans">
                            Rs. {((it.lineTotal ?? (it.unitPrice * it.quantity)) || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Gross:</span>
                    <span>Rs. {(viewingInvoice.grossAmount ?? viewingInvoice.subtotal ?? viewingInvoice.netAmount ?? 0).toLocaleString()}</span>
                  </div>
                  {viewingInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount Given:</span>
                      <span>- Rs. {(viewingInvoice.discountAmount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2 font-sans">
                    <span>Grand Total:</span>
                    <span>Rs. {(viewingInvoice.netAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold font-sans">
                    <span>Amount Paid:</span>
                    <span>Rs. {(viewingInvoice.amountPaid || 0).toLocaleString()}</span>
                  </div>
                  {(viewingInvoice.amountDue || 0) > 0 && (
                    <div className="flex justify-between text-purple-800 font-black font-sans border-t border-dashed border-slate-200 pt-1.5">
                      <span>Balance Due (Khata / Udhar):</span>
                      <span>Rs. {(viewingInvoice.amountDue || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewingInvoice(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const inv = viewingInvoice;
                      setViewingInvoice(null);
                      router.push(`/pos?editInvoiceId=${encodeURIComponent(inv.id)}`);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Sale in POS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInvoice(viewingInvoice);
                      setIsReceiptModalOpen(true);
                      setViewingInvoice(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Delete Confirmation Modal with 2 Distinct Action Buttons */}
        {deletingInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Delete Invoice #{deletingInvoice.invoiceNumber}
                    </h3>
                    <p className="text-xs text-rose-700 mt-0.5">
                      Select how you want to handle stock inventory &amp; invoice cancellation.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingInvoice(null)}
                  disabled={isDeletingInvoice}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Invoice Summary Details */}
              <div className="p-5 space-y-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <strong className="text-slate-800">{deletingInvoice.customerName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Amount:</span>
                    <strong className="text-slate-900 font-sans">
                      Rs. {(deletingInvoice.netAmount || 0).toLocaleString()}
                    </strong>
                  </div>
                  {deletingInvoice.amountDue > 0 && (
                    <div className="flex justify-between text-purple-700 font-semibold">
                      <span>Outstanding Balance (Khata):</span>
                      <span>Rs. {(deletingInvoice.amountDue || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Items:</span>
                    <strong className="text-slate-800">{deletingInvoice.items?.length || 0} product line(s)</strong>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                  <strong>Notice:</strong> In either choice, customer khata dues associated with this invoice will be safely cancelled and reversed.
                </div>

                {/* The 2 Primary Action Buttons */}
                <div className="space-y-2.5 pt-1">
                  {/* Option 1: Return Stock and Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteInvoice(true)}
                    disabled={isDeletingInvoice}
                    className="w-full p-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl text-left transition-all shadow-xs hover:shadow-md flex items-center justify-between group cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <PackageCheck className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">
                          Return Stock &amp; Delete Invoice
                        </div>
                        <div className="text-[11px] text-emerald-100 mt-0.5">
                          Restores item quantities back to warehouse inventory &amp; voids invoice
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white bg-white/20 px-2 py-1 rounded-lg shrink-0">
                      {isDeletingInvoice ? 'Processing...' : 'Return Stock'}
                    </span>
                  </button>

                  {/* Option 2: Delete Invoice Only */}
                  <button
                    type="button"
                    onClick={() => handleDeleteInvoice(false)}
                    disabled={isDeletingInvoice}
                    className="w-full p-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-2xl text-left transition-all shadow-xs hover:shadow-md flex items-center justify-between group cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">
                          Delete Invoice Only
                        </div>
                        <div className="text-[11px] text-rose-100 mt-0.5">
                          Voids invoice and reverses customer dues without altering stock
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white bg-white/20 px-2 py-1 rounded-lg shrink-0">
                      {isDeletingInvoice ? 'Processing...' : 'Delete Only'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Modal Cancel Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDeletingInvoice(null)}
                  disabled={isDeletingInvoice}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Receipt Modal */}
        <InvoiceReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          invoice={selectedInvoice}
          branch={activeBranch}
          cashierName={selectedInvoice?.salesPerson || selectedInvoice?.cashierName || 'Cashier'}
          onStartNewSale={() => setIsReceiptModalOpen(false)}
        />
      </div>
    </AppLayout>
  );
}

export default SalesHistoryContent;
