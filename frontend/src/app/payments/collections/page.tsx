'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useGetCustomersQuery,
  useGetInvoicesQuery,
  useGetPaymentCollectionsQuery,
  useCreatePaymentCollectionMutation,
  useGetBranchesQuery,
} from '@/store/services/apiSlice';
import {
  useGetCustomersQuery as useGetBackendCustomersQuery,
  useGetCustomerOutstandingInvoicesQuery as useGetBackendCustomerOutstandingQuery,
  useGetCollectionsQuery as useGetBackendCollectionsQuery,
  useCreateCollectionMutation as useCreateBackendCollectionMutation,
  useGetBranchesQuery as useGetBackendBranchesQuery,
} from '@/store/services/posApi';
import { useAppSelector } from '@/store';
import { PaymentCollection, PaymentMethod } from '@/types';
import AppLayout from '@/components/layout/AppLayout';
import { formatDate, formatDateTime } from '@/utils/formatters';
import { useClientPagination } from '@/components/common/Pagination';
import {
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Calendar,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Banknote,
  Building,
  Store,
  X,
  BookOpen,
  Check,
} from 'lucide-react';

function CollectionsContent() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get('customerId') || '';
  const targetInvoiceId = searchParams.get('invoiceId') || '';
  const initialBranchId = searchParams.get('branchId') || '';

  const currentUser = useAppSelector((state) => state.auth.currentUser);

  const isBackendMode = process.env.NEXT_PUBLIC_DATA_MODE !== 'demo';

  // Queries
  const { data: demoCustomers = [] } = useGetCustomersQuery(undefined, { skip: isBackendMode });
  const { data: demoInvoices = [] } = useGetInvoicesQuery({}, { skip: isBackendMode });
  const { data: demoCollections = [], isLoading: isDemoColLoading } = useGetPaymentCollectionsQuery(
    undefined,
    { skip: isBackendMode }
  );

  const [createCollectionMutation, { isLoading: isDemoPosting }] =
    useCreatePaymentCollectionMutation();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Branches Queries
  const { data: demoBranches = [] } = useGetBranchesQuery(undefined, { skip: isBackendMode });
  const { data: backendBranches = [] } = useGetBackendBranchesQuery(undefined, {
    skip: !isBackendMode,
  });
  const branches = useMemo(() => {
    return isBackendMode ? backendBranches : demoBranches;
  }, [isBackendMode, backendBranches, demoBranches]);

  const [adminBranchId, setSelectedBranchId] = useState(initialBranchId);
  const selectedBranchId = isSuperAdmin ? adminBranchId : currentUser?.assignedBranchId || currentUser?.branchId || '';

  // Scoped Customer Query: Branch users strictly query their own branch; Super Admin can filter or view all
  const [customerSearch, setCustomerSearch] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setServerSearch(customerSearch.trim()), 250);
    return () => clearTimeout(timeout);
  }, [customerSearch]);

  const customerQueryParams = useMemo(() => {
    if (!isSuperAdmin) {
      const bId = currentUser?.assignedBranchId || (currentUser as any)?.branchId;
      return { branchId: bId || undefined, search: serverSearch || undefined };
    }
    return { branchId: selectedBranchId || undefined, search: serverSearch || undefined };
  }, [isSuperAdmin, currentUser, selectedBranchId, serverSearch]);

  const { currentData: backendCustomers = [] } = useGetBackendCustomersQuery(customerQueryParams, {
    skip: !isBackendMode,
  });
  const { currentData: backendCollections = [], isFetching: isBackendColLoading } =
    useGetBackendCollectionsQuery(selectedBranchId ? { branchId: selectedBranchId } : undefined, { skip: !isBackendMode });

  const [createBackendCollectionMutation, { isLoading: isBackendPosting }] =
    useCreateBackendCollectionMutation();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId);

  // Optimized On-Demand Customer Outstanding Invoices Query (Strictly for this branch)
  const { currentData: customerOutstandingData, isFetching: isOutstandingLoading, isError: outstandingError } =
    useGetBackendCustomerOutstandingQuery(
      selectedCustomerId
        ? {
          id: selectedCustomerId,
          branchId: isSuperAdmin ? selectedBranchId || undefined : selectedBranchId,
        }
        : '',
      { skip: !isBackendMode || !selectedCustomerId, refetchOnMountOrArgChange: true }
    );

  const customers = useMemo(() => {
    if (isBackendMode) {
      return (backendCustomers || []).map((c: any) => ({
        ...c,
        id: c.id || c._id,
        branchId: c.branchId || '',
        branchName: c.branchName || '',
        branchCode: c.branchCode || '',
        currentOutstanding: c.currentOutstanding || 0,
        availableCredit:
          c.availableCredit ??
          Math.max(0, (c.creditLimit || 0) - (c.currentOutstanding || 0)),
      })) as any[];
    }
    return demoCustomers;
  }, [isBackendMode, backendCustomers, demoCustomers]);

  const openInvoices = useMemo(() => {
    if (!selectedCustomerId) return [];
    if (isBackendMode) {
      const list = customerOutstandingData?.invoices || [];
      return list.filter((inv) => !targetInvoiceId || (inv.id || inv._id) === targetInvoiceId).map((inv: any) => ({
        id: inv.id || inv._id,
        invoiceNumber: inv.invoiceNumber,
        customerId: selectedCustomerId,
        branchId: inv.branchId || inv.sourceBranchId,
        amountDue: Number(inv.balanceDue ?? inv.amountDue ?? 0),
        totalAmount: Number(inv.totalAmount ?? 0),
        netAmount: Number(inv.totalAmount ?? 0),
        paidAmount: Number(inv.paidAmount ?? 0),
        amountPaid: Number(inv.paidAmount ?? 0),
        saleType: inv.saleType || 'RETAIL',
        dueDate: inv.dueDate,
        paymentStatus: Number(inv.balanceDue ?? 0) === 0 ? 'PAID' : 'PARTIAL',
        date: inv.invoiceDate || inv.date || inv.createdAt,
        branchName: inv.branchName || 'Branch',
      }));
    }
    return demoInvoices.filter(
      (inv) =>
        (!targetInvoiceId || inv.id === targetInvoiceId) && inv.customerId === selectedCustomerId &&
        inv.amountDue > 0 &&
        inv.paymentStatus !== 'PAID'
    );
  }, [isBackendMode, selectedCustomerId, customerOutstandingData, demoInvoices, targetInvoiceId]);

  const collections = useMemo(() => {
    if (isBackendMode) {
      return (backendCollections || []).map((c: any) => ({
        ...c,
        id: c.id || c._id,
        collectionNumber: c.collectionNumber,
        receiptNumber: c.receiptNumber || c.collectionNumber,
        customerId: c.customerId?._id || c.customerId?.id || c.customerId,
        customerName: c.customerName || c.customerId?.name || 'Customer',
        amount: Number(c.totalCollected ?? c.amount ?? 0),
        unallocatedAdvance: Number(c.unallocatedAmount ?? c.unallocatedAdvance ?? 0),
        paymentMethod: c.paymentMethod,
        date: c.collectionDate || c.createdAt,
        collectedAt: c.collectionDate || c.collectedAt || c.createdAt,
        collectedByName: c.collectedBy || c.collectedByName || 'Staff',
        allocations: (c.allocations || []).map((a: any) => ({
          ...a,
          allocatedAmount: Number(a.allocatedAmount ?? 0),
          invoiceNumber: a.invoiceNumber || 'INV',
        })),
      })) as any[];
    }
    return demoCollections;
  }, [isBackendMode, backendCollections, demoCollections]);

  // Client-Side Pagination for Collections History (renders when collections > 10)
  const { paginatedItems: paginatedCollections, PaginationComponent: CollectionsPagination } =
    useClientPagination(collections, 10, 'collections');

  const isColLoading = isBackendMode ? isBackendColLoading : isDemoColLoading;
  const isPosting = isBackendMode ? isBackendPosting : isDemoPosting;

  useEffect(() => {
    if (initialCustomerId) {
      const timer = setTimeout(() => {
        setSelectedCustomerId(initialCustomerId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialCustomerId]);

  const selectedCustomer = useMemo(() => {
    const cust = customers.find((c) => c.id === selectedCustomerId) || customerOutstandingData?.customer || null;
    if (!cust) return null;
    if (isBackendMode && customerOutstandingData) {
      return {
        ...cust,
        currentOutstanding: customerOutstandingData.totalOutstanding ?? cust.currentOutstanding,
      };
    }
    return cust;
  }, [customers, selectedCustomerId, isBackendMode, customerOutstandingData]);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submittingRef = useRef(false);

  const targetDue = targetInvoiceId ? openInvoices[0]?.amountDue : undefined;
  useEffect(() => {
    if (targetDue === undefined) return;
    setPaymentAmount(targetDue);
    setAllocations({ [targetInvoiceId]: targetDue });
  }, [targetDue, targetInvoiceId]);

  // Completed Collection Receipt Modal
  const [completedCollection, setCompletedCollection] = useState<PaymentCollection | null>(null);

  // Reset or pre-fill allocations when customer or payment amount changes
  const handleAutoAllocate = (amountToAllocate: number) => {
    let remaining = amountToAllocate;
    const newAlloc: Record<string, number> = {};

    for (const inv of openInvoices) {
      if (remaining <= 0) {
        newAlloc[inv.id] = 0;
        continue;
      }
      const alloc = Math.min(inv.amountDue, remaining);
      newAlloc[inv.id] = alloc;
      remaining -= alloc;
    }

    setAllocations(newAlloc);
  };

  const handleAmountChange = (val: number) => {
    setPaymentAmount(val);
    handleAutoAllocate(val);
  };

  // Specific invoice allocation change
  const handleInvoiceAllocChange = (invoiceId: string, val: number) => {
    const inv = openInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const clamped = Math.max(0, Math.min(inv.amountDue, val));
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: clamped,
    }));
  };

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);
  }, [allocations]);

  const excessAdvance = Math.max(0, paymentAmount - totalAllocated);

  const customerOutstanding = Number(selectedCustomer?.currentOutstanding ?? 0);
  const amountDeductedFromOutstanding = Math.min(
    customerOutstanding,
    totalAllocated > 0 ? totalAllocated : (paymentAmount || 0)
  );
  const remainingBalanceAfterPayment = Math.max(0, customerOutstanding - amountDeductedFromOutstanding);

  // Submit Collection
  const handleSubmitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isOutstandingLoading || outstandingError) return;
    setErrorMessage(null);

    if (targetInvoiceId && (!targetDue || paymentAmount > targetDue || allocations[targetInvoiceId] !== paymentAmount)) {
      setErrorMessage('Enter an amount up to the outstanding balance for this invoice.');
      return;
    }
    if (isSuperAdmin && !selectedBranchId && new Set(openInvoices.map((invoice) => invoice.branchId)).size > 1) {
      setErrorMessage('Select the branch receiving this payment.');
      return;
    }

    if (!selectedCustomer) {
      setErrorMessage('Please select a customer to collect payment from.');
      return;
    }
    if (paymentAmount <= 0) {
      setErrorMessage('Please enter a positive collection amount.');
      return;
    }

    const allocList = Object.entries(allocations)
      .filter(([, amt]) => amt > 0)
      .map(([invoiceId, allocatedAmount]) => {
        const inv = openInvoices.find((i) => i.id === invoiceId);
        return {
          invoiceId,
          invoiceNumber: inv?.invoiceNumber || invoiceId,
          allocatedAmount,
        };
      });

    const effectiveBranch =
      (selectedBranchId && selectedBranchId !== 'ALL' ? selectedBranchId : undefined) ||
      openInvoices[0]?.branchId ||
      (selectedCustomer as any)?.branchId ||
      currentUser?.assignedBranchId ||
      (currentUser as any)?.branchId ||
      (branches.length > 0 ? (branches[0].id || (branches[0] as any)._id) : undefined);

    submittingRef.current = true;
    try {
      if (isBackendMode) {
        const payload = {
          customerId: selectedCustomer.id || (selectedCustomer as any)._id,
          branchId: effectiveBranch && effectiveBranch !== 'ALL' ? effectiveBranch : undefined,
          amount: paymentAmount,
          paymentMethod: (paymentMethod === 'CREDIT_30D' ? 'CASH' : paymentMethod) as any,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          allocations: allocList.map((a) => ({
            invoiceId: a.invoiceId,
            allocatedAmount: a.allocatedAmount,
          })),
        };
        const fingerprint = JSON.stringify(payload);
        if (requestRef.current?.fingerprint !== fingerprint) {
          const key = Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(16).padStart(8, '0')).join('');
          requestRef.current = { fingerprint, key: `collection-${key}` };
        }
        const result = await createBackendCollectionMutation({ ...payload, idempotencyKey: requestRef.current.key }).unwrap();
        requestRef.current = null;

        const collectionObj = (result as any).collection || result;
        setCompletedCollection({
          ...collectionObj,
          id: collectionObj.id || collectionObj._id,
          receiptNumber: collectionObj.receiptNumber || collectionObj.collectionNumber,
          customerName: collectionObj.customerName || selectedCustomer.name,
          amount: Number(collectionObj.totalCollected ?? collectionObj.amount ?? paymentAmount),
          unallocatedAdvance: Number(collectionObj.unallocatedAmount ?? collectionObj.unallocatedAdvance ?? 0),
          date: collectionObj.collectionDate || collectionObj.createdAt || new Date().toISOString(),
          collectedAt: collectionObj.collectionDate || collectionObj.createdAt || new Date().toISOString(),
          collectedByName: collectionObj.collectedBy || currentUser?.name || 'Staff',
          allocations: (collectionObj.allocations || []).map((a: any) => ({
            ...a,
            allocatedAmount: Number(a.allocatedAmount ?? 0),
            invoiceNumber: a.invoiceNumber || 'INV',
          })),
        } as any);
        setPaymentAmount(0);
        setAllocations({});
        setReference('');
        setNotes('');
        return;
      }

      const result = await createCollectionMutation({
        customerId: selectedCustomer.id,
        branchId: effectiveBranch || 'BR-MAIN-01',
        amount: paymentAmount,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: allocList,
        collectedById: currentUser?.id || 'USR-ADMIN-01',
        collectedByName: currentUser?.name || 'Admin',
      }).unwrap();

      setCompletedCollection(result);
      setPaymentAmount(0);
      setAllocations({});
      setReference('');
      setNotes('');
    } catch (err: any) {
      requestRef.current = null;
      setErrorMessage(
        err?.data?.error?.message ||
        err?.data?.message ||
        (err as Error).message ||
        'Failed to post collection'
      );
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* <Link
              href="/customers"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-200 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span>Customers Registry</span>
            </Link> */}
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-sans flex items-center gap-2">
                <span>Customer Payment Recovery &amp; Collections</span>
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Collect outstanding customer receivables, allocate payments across open invoices, or record customer advances
              </p>
            </div>
          </div>

          {/* <Link
            href="/pos"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open POS Counter</span>
          </Link> */}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (Customer & Open Invoices) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Customer Search & Selector with Branch Isolation */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              {/* Branch Isolation / Scope Indicator */}
              {isSuperAdmin ? (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-900 font-bold">
                      <Store className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Branch</span>
                    </div>
                    <select
                      value={selectedBranchId}
                      disabled={!!targetInvoiceId}
                      onChange={(e) => {
                        setSelectedBranchId(e.target.value);
                        setSelectedCustomerId('');
                        setPaymentAmount(0);
                        setAllocations({});
                      }}
                      className="px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">All Branches (All Registered Customers)</option>
                      {branches.map((b: any) => (
                        <option key={b.id || b._id} value={b.id || b._id}>
                          {b.name} ({b.code || b.shopNumber || 'Branch'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-indigo-700">
                    As Super Admin, you can view and manage all customers across all branches, or filter to see customers of an individual branch.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950">
                        Branch: {branches.find((b: any) => (b.id || b._id) === selectedBranchId)?.name || 'Your Branch'}
                      </span>
                      <p className="text-[11px] text-emerald-800">
                        Strict Branch Isolation: Showing strictly your branch&apos;s registered customers and khata dues.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                    Branch Scoped
                  </span>
                </div>
              )}

              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                Select Customer Account
              </label>

              {!targetInvoiceId && isBackendMode && (
                <div className="relative">
                  <input
                    type="search"
                    aria-label="Search customers"
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="mb-2 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs truncate focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                    style={{ textOverflow: 'ellipsis' }}
                  />
                </div>
              )}
              <div className="relative">
                <select
                  id="collection-customer-select"
                  value={selectedCustomerId}
                  disabled={!!targetInvoiceId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setPaymentAmount(0);
                    setAllocations({});
                  }}
                  className="w-full capitalize px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer truncate"
                  style={{ textOverflow: 'ellipsis' }}
                >
                  <option value="">-- Choose Customer ({customers.length} available) --</option>
                  {(selectedCustomer && !customers.some((c) => c.id === selectedCustomerId) ? [selectedCustomer, ...customers] : customers).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} • Due: Rs.{' '}
                      {(c.currentOutstanding ?? 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 font-sans">
                        {selectedCustomer.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                        {selectedCustomer.customerType}
                      </span>
                      {selectedCustomer.branchName && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 flex items-center gap-1 border border-slate-300">
                          <Store className="w-3 h-3 text-slate-600" />
                          <span>Branch: {selectedCustomer.branchName}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span>Phone: <strong className="text-slate-700">{selectedCustomer.phone || 'N/A'}</strong></span>
                      {/* <span>•</span> */}
                      {/* <span>Terms: <strong className="text-slate-700">{selectedCustomer.creditTerms || 'Net 30'}</strong></span> */}
                    </div>
                    <div className="pt-0.5">
                      <Link
                        href={`/customers/${encodeURIComponent(selectedCustomerId)}/ledger${selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : ''}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 bg-white hover:bg-slate-50 border border-slate-300 hover:border-emerald-300 px-3 py-1 rounded-lg transition-colors shadow-2xs group"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-600" />
                        <span>View Ledger / Khata</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                      </Link>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2.5 bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Total Outstanding
                      </span>
                      <span className="text-lg font-black text-rose-600 font-sans tracking-tight">
                        Rs. {(customerOutstanding ?? 0).toLocaleString()}
                      </span>
                    </div>

                    {/* <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Remaining After Payment
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-sans ${remainingBalanceAfterPayment === 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                      >
                        Rs. {remainingBalanceAfterPayment.toLocaleString()}
                      </span>
                    </div> */}
                  </div>
                </div>
              )}
            </div>

            {/* Open Invoices List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-xs text-slate-800 font-sans uppercase tracking-wider">
                    Open &amp; Pending Invoices ({openInvoices.length})
                  </h3>
                </div>

                {selectedCustomer && openInvoices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAmountChange(selectedCustomer.currentOutstanding)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pay Full Outstanding</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {!selectedCustomer ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Select a customer above to view their pending invoices.
                  </div>
                ) : openInvoices.length === 0 ? (
                  <div className="p-8 text-center text-xs text-emerald-600 font-bold flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <span>This customer has zero outstanding balance!</span>
                  </div>
                ) : (
                  openInvoices.map((inv) => {
                    const isAllocated = (allocations[inv.id] || 0) > 0;
                    const allocatedVal = allocations[inv.id] || 0;
                    const remainingAfter = Math.max(0, inv.amountDue - allocatedVal);

                    return (
                      <div
                        key={inv.id}
                        className={`p-4 transition-colors flex flex-wrap items-center justify-between gap-3 ${isAllocated ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                          }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              {inv.saleType || 'WALK_IN'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatDate(inv.date)}
                            </span>
                            {inv.dueDate && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                <Calendar className="w-3 h-3 text-amber-600" />
                                <span>Due: {formatDate(inv.dueDate)}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-sans">
                            <span>
                              Net Total: <strong className="text-slate-700">Rs. {(inv.netAmount ?? 0).toLocaleString()}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Paid: <strong className="text-slate-700">Rs. {(inv.amountPaid ?? 0).toLocaleString()}</strong>
                            </span>
                            <span>•</span>
                            <span className="font-extrabold text-rose-600">
                              Due: Rs. {(inv.amountDue ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Allocation Input */}
                        <div className="flex items-center gap-2 text-right">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Allocate (Rs.)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              max={inv.amountDue ?? 0}
                              value={allocatedVal === 0 ? '' : allocatedVal}
                              onChange={(e) => {
                                const raw = e.target.value;
                                handleInvoiceAllocChange(
                                  inv.id,
                                  raw === '' ? 0 : Math.max(0, Number(raw) || 0)
                                );
                              }}
                              placeholder="0"
                              className="w-28 px-2.5 py-1.5 text-right text-xs font-bold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-400"
                            />
                            {allocatedVal > 0 && (
                              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                                Remaining: Rs. {(remainingAfter ?? 0).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column (Payment Collection Voucher Form) */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleSubmitCollection}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-800 font-sans">
                  Record Payment Voucher
                </h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  New Recovery
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Receiving Branch Selector */}
              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-slate-400" />
                    <span>Receiving Branch *</span>
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      setPaymentAmount(0);
                      setAllocations({});
                    }}
                    disabled={!isSuperAdmin || !!targetInvoiceId}
                    className={`w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-sans ${currentUser?.role !== 'SUPER_ADMIN' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                  >
                    {currentUser?.role === 'SUPER_ADMIN' && (
                      <option value="">All Branches / Auto-Detect Customer Branch</option>
                    )}
                    {branches.map((b: any) => (
                      <option key={b.id || b._id} value={b.id || b._id}>
                        {b.name} ({b.code || b.shopNumber || 'Branch'})
                      </option>
                    ))}
                  </select>
                  {currentUser?.role !== 'SUPER_ADMIN' && (
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">
                      Branch Locked: You can only recover khata dues for your assigned branch.
                    </p>
                  )}
                </div>
              )}

              {targetInvoiceId && !isOutstandingLoading && !completedCollection && !targetDue && (
                <p role="status" className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
                  {outstandingError ? 'Could not load this invoice.' : 'This invoice has no collectible balance at the selected branch.'}
                </p>
              )}

              {/* Amount Collected Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount Received / Collected (PKR) *
                </label>
                <div className="relative">
                  <span className="text-xs font-black text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 select-none">
                    Rs.
                  </span>
                  <input
                    type="number"
                    id="collection-amount-input"
                    required
                    min={0.01}
                    step={0.01}
                    max={targetDue}
                    value={paymentAmount === 0 ? '' : paymentAmount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      handleAmountChange(raw === '' ? 0 : Math.max(0, Number(raw) || 0));
                    }}
                    placeholder="e.g. 25000"
                    className="w-full pl-10 pr-4 py-2.5 text-base font-black border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-sans outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Method *
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${paymentMethod === 'CASH'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PAYPAK_CARD')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${paymentMethod === 'PAYPAK_CARD'
                      ? 'bg-white text-blue-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-white text-purple-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <Building className="w-3.5 h-3.5" />
                    <span>Bank</span>
                  </button>
                </div>
              </div>

              {/* Reference Number */}
              {/* <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instrument / Reference # (Cheque / Trx ID)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. CHQ-991245 or TRX-88219"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                />
              </div> */}

              {/* Notes */}
              {/* <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Voucher Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Payment recovered against overdue invoices..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                />
              </div> */}

              {/* 3-Column Allocation & Recovery Summary Card */}
              <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total Collected
                    </span>
                    <span className="text-xs font-black text-slate-900 font-sans mt-0.5 block truncate">
                      Rs. {(paymentAmount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Allocated
                    </span>
                    <span className="text-xs font-black text-emerald-700 font-sans mt-0.5 block truncate">
                      Rs. {(totalAllocated || 0).toLocaleString()}
                    </span>
                  </div>

                  <div
                    className={`p-2.5 bg-white rounded-lg border shadow-2xs ${excessAdvance > 0
                      ? 'border-blue-200 bg-blue-50/40'
                      : remainingBalanceAfterPayment > 0
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-slate-200/80'
                      }`}
                  >
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">
                      {excessAdvance > 0
                        ? 'Advance Balance'
                        : remainingBalanceAfterPayment > 0
                          ? 'Remaining Due'
                          : 'Balance Cleared'}
                    </span>
                    <span
                      className={`text-xs font-black font-sans mt-0.5 block truncate ${excessAdvance > 0
                        ? 'text-blue-700'
                        : remainingBalanceAfterPayment > 0
                          ? 'text-amber-800'
                          : 'text-emerald-700'
                        }`}
                    >
                      Rs.{' '}
                      {excessAdvance > 0
                        ? excessAdvance.toLocaleString()
                        : remainingBalanceAfterPayment.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="submit-collection-btn"
                disabled={!selectedCustomer || paymentAmount <= 0 || isPosting || isOutstandingLoading || outstandingError || (!!targetInvoiceId && !targetDue)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
              >
                {isPosting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Posting Collection...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Confirm &amp; Post Recovery Payment</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Recent Collections History Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-xs text-slate-800 font-sans uppercase tracking-wider">
              Recent Recovery Collections ({collections.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount Collected</th>
                  <th className="py-3 px-4">Allocated Invoices</th>
                  <th className="py-3 px-4 text-right">Advance Balance</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {isColLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading payment recovery records...
                    </td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5 border border-slate-200/60">
                          <Receipt className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800">
                          No payment collections recorded yet
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Your recent recoveries for this branch will appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCollections.map((c) => {
                    const formattedDate = formatDateTime(c.collectedAt);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {c.receiptNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{formattedDate}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{c.customerName}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${c.paymentMethod === 'CASH'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : c.paymentMethod === 'PAYPAK_CARD' || c.paymentMethod === 'CARD'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-purple-50 text-purple-800 border border-purple-200'
                              }`}
                          >
                            {c.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-700 font-sans">
                          Rs. {(c.amount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(c.allocations || []).map((a: any, idx: number) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-semibold text-slate-700 border border-slate-200"
                              >
                                {a.invoiceNumber || 'INV'}: Rs. {(a.allocatedAmount ?? 0).toLocaleString()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-blue-700 font-sans">
                          {(c.unallocatedAdvance ?? 0) > 0
                            ? `Rs. ${(c.unallocatedAdvance ?? 0).toLocaleString()}`
                            : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setCompletedCollection(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Voucher</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (Only renders when collections > 10) */}
          {CollectionsPagination}
        </div>
      </div>

      {/* Payment Receipt / Voucher Modal */}
      {completedCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base font-sans">Payment Recovery Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setCompletedCollection(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Paper */}
            <div className="p-6 bg-slate-100 flex justify-center">
              <div
                id="printable-payment-voucher"
                className="w-full bg-white p-6 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 space-y-3"
              >
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <h2 className="text-base font-black text-slate-900 font-sans">MOLTY FOAM ERP</h2>
                  <p className="text-[11px] text-slate-600 font-sans">Payment Collection Voucher</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    Receipt: {completedCollection.receiptNumber}
                  </p>
                </div>

                <div className="space-y-1 text-[11px] py-1 border-b border-dashed border-slate-300">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{formatDateTime(completedCollection.collectedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <strong className="text-slate-900">{completedCollection.customerName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span>{completedCollection.paymentMethod}</span>
                  </div>
                  {completedCollection.reference && (
                    <div className="flex justify-between">
                      <span>Ref / Cheque:</span>
                      <span>{completedCollection.reference}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Collector:</span>
                    <span>{completedCollection.collectedByName}</span>
                  </div>
                </div>

                {/* Allocations */}
                <div className="space-y-1 text-[11px] py-1 border-b border-dashed border-slate-300">
                  <div className="font-bold text-slate-900 pb-0.5">Allocated Invoices:</div>
                  {(completedCollection.allocations || []).map((a, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{a.invoiceNumber || 'INV'}:</span>
                      <span>Rs. {(a.allocatedAmount ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                  {(completedCollection.unallocatedAdvance ?? 0) > 0 && (
                    <div className="flex justify-between text-blue-700 font-bold">
                      <span>Customer Advance:</span>
                      <span>Rs. {(completedCollection.unallocatedAdvance ?? 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="pt-2 flex justify-between font-black text-sm text-emerald-800 font-sans">
                  <span>TOTAL RECOVERED:</span>
                  <span>Rs. {(completedCollection.amount ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCompletedCollection(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function CollectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Collections Module...
        </div>
      }
    >
      <CollectionsContent />
    </Suspense>
  );
}
