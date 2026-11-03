'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetSupplierPaymentsQuery,
  useGetSuppliersQuery,
  useGetBranchesQuery,
  useGetSupplierBillsQuery,
  useCreateSupplierPaymentMutation,
} from '@/store/services/apiSlice';
import { hasPermission } from '@/lib/permissions';
import { SupplierPayment, SupplierPaymentMethod } from '@/types';
import {
  Plus,
  Search,
  Eye,
  Printer,
  AlertCircle,
  X,
} from 'lucide-react';

function SupplierPaymentsContent() {
  const searchParams = useSearchParams();
  const preselectedSupplierId = searchParams?.get('supplierId');
  const preselectedBillId = searchParams?.get('billId');

  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: payments = [], isLoading: isPaymentsLoading } = useGetSupplierPaymentsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: allBills = [] } = useGetSupplierBillsQuery();
  const [createPaymentMutation, { isLoading: isSubmitting }] = useCreateSupplierPaymentMutation();

  const canPay = hasPermission(currentUser, 'payments.suppliers.create');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  // Payment Modal State
  const initialTargetBill = useMemo(() => {
    return preselectedBillId ? allBills.find((b) => b.id === preselectedBillId) : null;
  }, [preselectedBillId, allBills]);

  const [isModalOpen, setIsModalOpen] = useState(() => Boolean(preselectedSupplierId));
  const [supplierId, setSupplierId] = useState(() => preselectedSupplierId || '');
  const [branchId, setBranchId] = useState('BR-MAIN-01');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amount, setAmount] = useState<number>(() => initialTargetBill?.amountDue || 0);
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<Record<string, number>>(() =>
    initialTargetBill ? { [initialTargetBill.id]: initialTargetBill.amountDue } : {}
  );
  const [formError, setFormError] = useState<string | null>(null);

  // View Modal State
  const [viewingPayment, setViewingPayment] = useState<SupplierPayment | null>(null);

  // Open bills for the selected supplier
  const supplierOpenBills = useMemo(() => {
    if (!supplierId) return [];
    return allBills.filter((b) => b.supplierId === supplierId && b.amountDue > 0);
  }, [allBills, supplierId]);

  // Auto-allocate amount across open bills
  const handleAutoAllocate = () => {
    let remaining = amount;
    const newAlloc: Record<string, number> = {};

    for (const bill of supplierOpenBills) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, bill.amountDue);
      newAlloc[bill.id] = alloc;
      remaining -= alloc;
    }

    setAllocations(newAlloc);
  };

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!supplierId) {
      setFormError('Please select a supplier.');
      return;
    }

    if (amount <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }

    if (totalAllocated > amount) {
      setFormError(
        `Total allocated (Rs. ${totalAllocated.toLocaleString()}) cannot exceed total payment amount (Rs. ${amount.toLocaleString()}).`
      );
      return;
    }

    // Check allocations per bill
    for (const [billId, allocAmt] of Object.entries(allocations)) {
      if (allocAmt > 0) {
        const bill = allBills.find((b) => b.id === billId);
        if (bill && allocAmt > bill.amountDue) {
          setFormError(
            `Allocated amount for ${bill.billNumber} (Rs. ${allocAmt.toLocaleString()}) exceeds amount due (Rs. ${bill.amountDue.toLocaleString()}).`
          );
          return;
        }
      }
    }

    const allocationItems = Object.entries(allocations)
      .filter(([, val]) => val > 0)
      .map(([billId, val]) => {
        const bill = allBills.find((b) => b.id === billId);
        return {
          billId,
          billNumber: bill?.billNumber || billId,
          allocatedAmount: val,
        };
      });

    try {
      const created = await createPaymentMutation({
        supplierId,
        branchId,
        paymentDate,
        amount,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        createdBy: currentUser?.name || 'Accounts Officer',
        allocations: allocationItems,
      }).unwrap();

      setIsModalOpen(false);
      setViewingPayment(created);
      // Reset
      setSupplierId('');
      setAmount(0);
      setAllocations({});
      setReferenceNumber('');
      setNotes('');
    } catch (err: unknown) {
      setFormError((err as { data?: string })?.data || 'Failed to record supplier payment.');
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (supplierFilter !== 'ALL' && p.supplierId !== supplierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.voucherNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [payments, supplierFilter, searchQuery]);

  const totalPaidOut = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier Payments</h1>
            <p className="text-sm text-slate-500 mt-1">
              Disburse payments to vendors, allocate against open bills, and generate payment vouchers
            </p>
          </div>

          {canPay && (
            <button
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Record Payment Voucher</span>
            </button>
          )}
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Supplier Disbursements
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">
              Rs. {totalPaidOut.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">{payments.length} vouchers generated</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Accounting Treatment
              </span>
              <p className="text-xs text-slate-600 mt-1">
                Payments settle liabilities and do NOT inflate direct sales expenses or reduce revenue directly.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Voucher #, Supplier, Cheque/Ref #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
              />
            </div>

            <div>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method / Ref</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Processed By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {isPaymentsLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading payments...
                    </td>
                  </tr>
                ) : filteredPayments.length > 0 ? (
                  filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-brand-burgundy">
                        <button
                          onClick={() => setViewingPayment(p)}
                          className="hover:underline text-left font-mono"
                        >
                          {p.voucherNumber}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">{p.supplierName}</span>
                        <span className="text-[11px] text-slate-400">{p.supplierCode || p.supplierId}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 text-xs">{p.branchName}</td>

                      <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                        {p.paymentDate}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <span className="font-medium text-slate-800 block">
                          {p.paymentMethod.replace('_', ' ')}
                        </span>
                        {p.referenceNumber && (
                          <span className="text-slate-400 font-mono block mt-0.5">
                            Ref: {p.referenceNumber}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                        Rs. {p.amount.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs text-slate-600">
                        {p.paidBy || p.createdBy}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setViewingPayment(p)}
                          className="p-1.5 text-slate-500 hover:text-brand-burgundy hover:bg-slate-100 rounded-md transition-colors"
                          title="View Voucher"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No supplier payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Record Payment Voucher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Record Supplier Payment Voucher</h2>
                <p className="text-xs text-slate-500">Disburse payment and reduce accounts payable liability</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Supplier Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(e.target.value);
                      setAllocations({});
                    }}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Due: Rs. {s.currentOutstanding.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Branch */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Paying Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Amount */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (PKR) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={amount || ''}
                    onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    required
                    placeholder="Enter total amount"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy font-bold text-brand-burgundy"
                  />
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as SupplierPaymentMethod)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (IBFT/RTGS)</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="PAYPAK_CARD">PayPak Card</option>
                  </select>
                </div>

                {/* Reference */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cheque # / Trx Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. CHQ-991244 or Trx ID"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>
              </div>

              {/* Bill Allocation Matrix */}
              {supplierId && (
                <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-800">
                        Allocate Against Open Bills ({supplierOpenBills.length} open)
                      </span>
                      <p className="text-[11px] text-slate-400">Distribute payment across outstanding invoices</p>
                    </div>
                    {amount > 0 && supplierOpenBills.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoAllocate}
                        className="text-xs font-semibold text-brand-burgundy hover:underline"
                      >
                        Auto Allocate
                      </button>
                    )}
                  </div>

                  {supplierOpenBills.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {supplierOpenBills.map((b) => {
                        const allocatedVal = allocations[b.id] || 0;

                        return (
                          <div
                            key={b.id}
                            className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg"
                          >
                            <div>
                              <span className="font-semibold text-slate-800">{b.billNumber}</span>
                              <span className="text-slate-500 ml-2">Due: {b.dueDate}</span>
                              <span className="text-rose-600 font-semibold block text-[11px]">
                                Amount Due: Rs. {b.amountDue.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400">Allocate:</span>
                              <input
                                type="number"
                                min={0}
                                max={b.amountDue}
                                value={allocatedVal || ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  setAllocations((prev) => ({
                                    ...prev,
                                    [b.id]: Math.min(val, b.amountDue),
                                  }));
                                }}
                                className="w-24 px-2 py-1 text-right bg-white border border-slate-300 rounded font-bold"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-2">
                      No open bills found for this supplier. Payment will be credited directly to the supplier ledger.
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">
                      Total Allocated: Rs. {totalAllocated.toLocaleString()} / Rs. {amount.toLocaleString()}
                    </span>
                    {amount - totalAllocated > 0 && (
                      <span className="text-amber-700 font-medium">
                        Unallocated: Rs. {(amount - totalAllocated).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Issue Payment Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Voucher Modal */}
      {viewingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-brand-burgundy">{viewingPayment.voucherNumber}</h2>
                <p className="text-xs text-slate-500">Official Supplier Payment Voucher</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                  title="Print Voucher"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewingPayment(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Vendor:</span>
                <span className="font-semibold text-slate-800">{viewingPayment.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Disbursed From:</span>
                <span className="font-semibold text-slate-800">{viewingPayment.branchName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Date:</span>
                <span className="font-semibold text-slate-800">{viewingPayment.paymentDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Method:</span>
                <span className="font-semibold text-slate-800">
                  {viewingPayment.paymentMethod.replace('_', ' ')}
                  {viewingPayment.referenceNumber ? ` (${viewingPayment.referenceNumber})` : ''}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800">Total Amount Disbursed:</span>
              <span className="text-lg font-bold text-emerald-700">
                Rs. {viewingPayment.amount.toLocaleString()}
              </span>
            </div>

            {/* Allocations Table */}
            {viewingPayment.allocations && viewingPayment.allocations.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2 px-3">Settled Bill</th>
                      <th className="py-2 px-3 text-right">Allocated Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPayment.allocations.map((a, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{a.billNumber}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          Rs. {a.allocatedAmount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingPayment(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function SupplierPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Supplier Payments Module...
        </div>
      }
    >
      <SupplierPaymentsContent />
    </Suspense>
  );
}
