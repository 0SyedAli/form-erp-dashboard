'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useGetCustomersQuery,
  useGetInvoicesQuery,
  useGetPaymentCollectionsQuery,
  useCreatePaymentCollectionMutation,
} from '@/store/services/apiSlice';
import { useAppSelector } from '@/store';
import { PaymentCollection, PaymentMethod } from '@/types';
import {
  Receipt,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Clock,
  Printer,
  Calendar,
  ArrowRight,
  CreditCard,
  Banknote,
  Building,
  X,
} from 'lucide-react';

function CollectionsContent() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get('customerId') || '';

  const currentUser = useAppSelector((state) => state.auth.currentUser);

  // Queries
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: invoices = [] } = useGetInvoicesQuery({});
  const { data: collections = [], isLoading: isColLoading } = useGetPaymentCollectionsQuery();

  const [createCollectionMutation, { isLoading: isPosting }] =
    useCreatePaymentCollectionMutation();

  // Selected Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId);

  useEffect(() => {
    if (initialCustomerId) {
      const timer = setTimeout(() => {
        setSelectedCustomerId(initialCustomerId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialCustomerId]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Open & Unpaid Invoices for this customer
  const openInvoices = useMemo(() => {
    if (!selectedCustomerId) return [];
    return invoices.filter(
      (inv) =>
        inv.customerId === selectedCustomerId &&
        inv.amountDue > 0 &&
        inv.paymentStatus !== 'PAID'
    );
  }, [invoices, selectedCustomerId]);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Submit Collection
  const handleSubmitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

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

    try {
      const result = await createCollectionMutation({
        customerId: selectedCustomer.id,
        branchId: currentUser?.assignedBranchId || 'BR-MAIN-01',
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
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to post collection');
    }
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
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Customers Registry</span>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight font-sans flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <span>Customer Payment Recovery &amp; Collections</span>
            </h1>
            <p className="text-xs text-slate-500 font-sans">
              Collect outstanding customer receivables, allocate payments across open invoices, or record customer advances
            </p>
          </div>
        </div>

        <Link
          href="/pos"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span>Open POS Counter</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (Customer & Open Invoices) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Customer Search & Selector */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                Select Customer Account
              </label>

              <div className="relative">
                <select
                  id="collection-customer-select"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setPaymentAmount(0);
                    setAllocations({});
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customerCode}) • Outstanding: Rs.{' '}
                      {c.currentOutstanding.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 font-sans">
                        {selectedCustomer.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {selectedCustomer.customerType}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Phone: {selectedCustomer.phone} • Terms: {selectedCustomer.creditTerms}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Total Outstanding
                    </span>
                    <span className="text-base font-black text-purple-800 font-sans">
                      Rs. {selectedCustomer.currentOutstanding.toLocaleString()}
                    </span>
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
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                  >
                    Pay Full Outstanding
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
                        className={`p-4 transition-colors flex flex-wrap items-center justify-between gap-3 ${
                          isAllocated ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {inv.saleType || 'WALK_IN'}
                            </span>
                            <span className="text-[10px] text-slate-400">{inv.date}</span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-sans">
                            <span>Net Total: Rs. {inv.netAmount.toLocaleString()}</span>
                            <span>• Paid: Rs. {inv.amountPaid.toLocaleString()}</span>
                            <span className="font-bold text-purple-800">
                              Due: Rs. {inv.amountDue.toLocaleString()}
                            </span>
                          </div>

                          {inv.dueDate && (
                            <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1 font-medium">
                              <Calendar className="w-3 h-3" /> Due Date: {inv.dueDate}
                            </p>
                          )}
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
                              max={inv.amountDue}
                              value={allocatedVal || ''}
                              onChange={(e) =>
                                handleInvoiceAllocChange(
                                  inv.id,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              placeholder="0"
                              className="w-28 px-2.5 py-1 text-right text-xs font-bold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                            />
                            {allocatedVal > 0 && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Remaining: Rs. {remainingAfter.toLocaleString()}
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

              {/* Amount Collected Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount Received / Collected (PKR) *
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    id="collection-amount-input"
                    required
                    min={1}
                    value={paymentAmount || ''}
                    onChange={(e) => handleAmountChange(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="e.g. 25000"
                    className="w-full pl-9 pr-4 py-2.5 text-base font-black border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-sans"
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
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'CASH'
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
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'PAYPAK_CARD'
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
                    className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'BANK_TRANSFER'
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Instrument / Reference # (Cheque / Trx ID)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. CHQ-991245 or TRX-88219"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Voucher Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Payment recovered against overdue invoices..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Allocation & Advance Summary */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Collected:</span>
                  <span className="font-bold text-slate-900 font-sans">
                    Rs. {paymentAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Allocated to Invoices:</span>
                  <span className="font-bold text-emerald-700 font-sans">
                    Rs. {totalAllocated.toLocaleString()}
                  </span>
                </div>
                {excessAdvance > 0 && (
                  <div className="flex justify-between text-blue-700 font-bold pt-1 border-t border-slate-200">
                    <span>Unallocated Advance Balance:</span>
                    <span>Rs. {excessAdvance.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="submit-collection-btn"
                disabled={!selectedCustomer || paymentAmount <= 0 || isPosting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isPosting ? 'Posting Collection...' : 'Confirm & Post Recovery Payment'}</span>
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
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No payment collections recorded yet.
                    </td>
                  </tr>
                ) : (
                  collections.map((c) => {
                    const formattedDate = new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(c.collectedAt));

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {c.receiptNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{formattedDate}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{c.customerName}</td>
                        <td className="py-3.5 px-4 text-slate-600">{c.paymentMethod}</td>
                        <td className="py-3.5 px-4 text-right font-black text-emerald-700 font-sans">
                          Rs. {c.amount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {c.allocations.map((a, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-semibold text-slate-700 border border-slate-200"
                              >
                                {a.invoiceNumber}: Rs. {a.allocatedAmount.toLocaleString()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-blue-700 font-sans">
                          {c.unallocatedAdvance > 0
                            ? `Rs. ${c.unallocatedAdvance.toLocaleString()}`
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
        </div>
      </main>

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
                    <span>{new Date(completedCollection.collectedAt).toLocaleString()}</span>
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
                  {completedCollection.allocations.map((a, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{a.invoiceNumber}:</span>
                      <span>Rs. {a.allocatedAmount.toLocaleString()}</span>
                    </div>
                  ))}
                  {completedCollection.unallocatedAdvance > 0 && (
                    <div className="flex justify-between text-blue-700 font-bold">
                      <span>Customer Advance:</span>
                      <span>Rs. {completedCollection.unallocatedAdvance.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="pt-2 flex justify-between font-black text-sm text-emerald-800 font-sans">
                  <span>TOTAL RECOVERED:</span>
                  <span>Rs. {completedCollection.amount.toLocaleString()}</span>
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
    </div>
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
