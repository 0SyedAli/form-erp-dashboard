'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetSupplierBillsQuery,
  useGetSuppliersQuery,
  useGetBranchesQuery,
  useGetPurchaseOrdersQuery,
  useGetProductVariantsQuery,
  useCreateSupplierBillMutation,
} from '@/store/services/apiSlice';
import { hasPermission } from '@/lib/permissions';
import { SupplierBill } from '@/types';
import {
  Plus,
  Search,
  AlertCircle,
  Eye,
  Clock,
  X,
  Trash2,
  ArrowRight,
} from 'lucide-react';

interface BillItemRow {
  sku: string;
  variantId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  discount: number;
  tax: number;
}

function SupplierBillsContent() {
  const searchParams = useSearchParams();
  const poIdParam = searchParams?.get('createForPo');

  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: bills = [], isLoading: isBillsLoading } = useGetSupplierBillsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery();
  const { data: variants = [] } = useGetProductVariantsQuery();
  const [createBillMutation, { isLoading: isCreatingBill }] = useCreateSupplierBillMutation();

  const canPostBill = hasPermission(currentUser, 'bills.post');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Bill Modal State
  const [isModalOpen, setIsModalOpen] = useState(() => Boolean(poIdParam));
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState('BR-MAIN-01');
  const [poId, setPoId] = useState(() => poIdParam || '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Line items
  const [items, setItems] = useState<BillItemRow[]>([
    {
      sku: '',
      variantId: '',
      productName: '',
      quantity: 1,
      unitCost: 0,
      discount: 0,
      tax: 0,
    },
  ]);

  // Selected Bill for View Modal
  const [viewingBill, setViewingBill] = useState<SupplierBill | null>(null);

  const handleSelectPO = (id: string) => {
    setPoId(id);
    const po = purchaseOrders.find((p) => p.id === id);
    if (po) {
      setSupplierId(po.supplierId);
      setBranchId(po.destinationBranchId);
      setItems(
        po.items.map((i) => ({
          sku: i.sku,
          variantId: i.variantId,
          productName: i.productName,
          quantity: i.orderedQuantity,
          unitCost: i.unitCost,
          discount: i.lineDiscount || 0,
          tax: i.taxAmount || 0,
        }))
      );
    }
  };

  // Handle supplier change to update due date based on payment terms
  const handleSupplierChange = (supId: string) => {
    setSupplierId(supId);
    const sup = suppliers.find((s) => s.id === supId);
    if (sup) {
      const days = sup.defaultDueDays || sup.defaultCreditDays || 30;
      const d = new Date(billDate);
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().slice(0, 10));
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        sku: '',
        variantId: '',
        productName: '',
        quantity: 1,
        unitCost: 0,
        discount: 0,
        tax: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemVariantChange = (index: number, variantId: string) => {
    const v = variants.find((item) => item.id === variantId);
    if (!v) return;

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        variantId: v.id,
        sku: v.sku,
        productName: v.productName || 'Mattress Product',
        unitCost: v.wholesalePrice ? Math.round(v.wholesalePrice * 0.75) : 15000,
      };
      return next;
    });
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    items.forEach((i) => {
      const lineSub = i.quantity * i.unitCost;
      subtotal += lineSub;
      discount += i.discount || 0;
      tax += i.tax || 0;
    });
    const grandTotal = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, grandTotal };
  }, [items]);

  // Filtered bills
  const filteredBills = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return bills.filter((b) => {
      if (supplierFilter !== 'ALL' && b.supplierId !== supplierFilter) return false;

      if (statusFilter === 'OVERDUE') {
        if (!(b.amountDue > 0 && b.dueDate < todayStr)) return false;
      } else if (statusFilter !== 'ALL' && b.paymentStatus !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          b.billNumber.toLowerCase().includes(q) ||
          b.supplierInvoiceNumber.toLowerCase().includes(q) ||
          b.supplierName.toLowerCase().includes(q) ||
          (b.poNumber && b.poNumber.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [bills, supplierFilter, statusFilter, searchQuery]);

  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!supplierId) {
      setFormError('Please select a supplier.');
      return;
    }

    if (!supplierInvoiceNumber.trim()) {
      setFormError('Supplier invoice reference number is required.');
      return;
    }

    if (items.some((i) => !i.sku || i.quantity <= 0 || i.unitCost < 0)) {
      setFormError('Please provide valid variants, positive quantities, and valid unit costs for all items.');
      return;
    }

    try {
      const created = await createBillMutation({
        supplierId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        branchId,
        poId: poId || undefined,
        grnIds: [],
        billDate,
        dueDate,
        notes: notes.trim() || undefined,
        createdBy: currentUser?.name || 'Accounts Officer',
        items: items.map((i) => ({
          sku: i.sku,
          variantId: i.variantId,
          productName: i.productName,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          discount: Number(i.discount || 0),
          tax: Number(i.tax || 0),
        })),
      }).unwrap();

      setIsModalOpen(false);
      setViewingBill(created);
    } catch (err: unknown) {
      setFormError((err as { data?: string })?.data || 'Failed to post supplier bill.');
    }
  };

  const totalOutstanding = bills.reduce((sum, b) => sum + b.amountDue, 0);
  const totalBilled = bills.reduce((sum, b) => sum + b.grandTotal, 0);

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier Bills</h1>
            <p className="text-sm text-slate-500 mt-1">
              Accounts payable vendor bills, payment due dates, and settlement status
            </p>
          </div>

          {canPostBill && (
            <button
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Register Vendor Bill</span>
            </button>
          )}
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Billed
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              Rs. {totalBilled.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">{bills.length} total bills</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Outstanding Accounts Payable
            </span>
            <span className="text-2xl font-bold text-rose-700 mt-1 block">
              Rs. {totalOutstanding.toLocaleString()}
            </span>
            <span className="text-xs text-rose-600 mt-0.5 block">
              {bills.filter((b) => b.amountDue > 0).length} unpaid or partial bills
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Supplier Payments
              </span>
              <p className="text-xs text-slate-500 mt-1">Disburse vendor payments and allocate against open bills</p>
            </div>
            <Link
              href="/payments/suppliers"
              className="px-3.5 py-2 bg-brand-burgundy text-white rounded-lg text-xs font-semibold hover:bg-rose-900 transition-colors shrink-0"
            >
              Make Payment
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search Bill #, Inv #, Supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Fully Paid</option>
                <option value="OVERDUE">Overdue Only</option>
              </select>
            </div>

            <div>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
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

        {/* Bills Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Supplier & Inv #</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Bill Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Amount Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {isBillsLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading bills...
                    </td>
                  </tr>
                ) : filteredBills.length > 0 ? (
                  filteredBills.map((b) => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isOverdue = b.amountDue > 0 && b.dueDate < todayStr;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-brand-burgundy">
                          <button
                            onClick={() => setViewingBill(b)}
                            className="hover:underline text-left"
                          >
                            {b.billNumber}
                          </button>
                          {b.poNumber && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              PO: {b.poNumber}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-900 block">{b.supplierName}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Inv: {b.supplierInvoiceNumber}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">{b.branchName}</td>

                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{b.billDate}</td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`} />
                            <span className={isOverdue ? 'font-bold text-rose-600' : 'text-slate-600'}>
                              {b.dueDate}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-slate-900 whitespace-nowrap">
                          Rs. {b.grandTotal.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                          <span className={b.amountDue > 0 ? 'text-rose-700' : 'text-slate-400'}>
                            Rs. {b.amountDue.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              isOverdue
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : b.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : b.paymentStatus === 'PARTIALLY_PAID'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isOverdue ? 'OVERDUE' : b.paymentStatus.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingBill(b)}
                              className="p-1.5 text-slate-500 hover:text-brand-burgundy hover:bg-slate-100 rounded-md transition-colors"
                              title="View Bill Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {b.amountDue > 0 && (
                              <Link
                                href={`/payments/suppliers?supplierId=${b.supplierId}&billId=${b.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-burgundy hover:bg-rose-50 rounded-md transition-colors"
                              >
                                <span>Pay</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No supplier bills match your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Bill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Post Supplier Bill</h2>
                <p className="text-xs text-slate-500">Record vendor invoice and accounts payable liability</p>
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

            <form onSubmit={handleSubmitBill} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Supplier */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.paymentTerms || 'Net 30'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vendor Invoice Reference */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor Invoice # <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-90123"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Branch */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
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

                {/* Bill Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Date</label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* PO Reference (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PO Link (Optional)</label>
                  <select
                    value={poId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="">No PO link</option>
                    {purchaseOrders
                      .filter((p) => !supplierId || p.supplierId === supplierId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.poNumber} — Rs. {p.grandTotal.toLocaleString()}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Bill reference notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-slate-800">Bill Items</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-brand-burgundy hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-5">
                        <select
                          value={row.variantId}
                          onChange={(e) => handleItemVariantChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                        >
                          <option value="">Select SKU...</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.sku} ({v.productName || 'Product'} - {v.sizeLabel})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setItems((prev) => {
                              const n = [...prev];
                              n[idx] = { ...n[idx], quantity: val };
                              return n;
                            });
                          }}
                          className="w-full px-2 py-1.5 text-center bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          min={0}
                          placeholder="Cost"
                          value={row.unitCost}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setItems((prev) => {
                              const n = [...prev];
                              n[idx] = { ...n[idx], unitCost: val };
                              return n;
                            });
                          }}
                          className="w-full px-2 py-1.5 text-right bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <span className="font-semibold text-slate-800 text-right">
                          Rs. {(row.quantity * row.unitCost).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-slate-700">Total Bill Payable:</span>
                  <span className="text-sm font-bold text-brand-burgundy">
                    Rs. {calculations.grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

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
                  disabled={isCreatingBill}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors"
                >
                  {isCreatingBill ? 'Posting...' : 'Post Bill (A/P)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Bill Modal */}
      {viewingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{viewingBill.billNumber}</h2>
                <p className="text-xs text-slate-500">
                  Vendor Inv #{viewingBill.supplierInvoiceNumber} • {viewingBill.supplierName}
                </p>
              </div>
              <button
                onClick={() => setViewingBill(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Bill Date:</span>
                <span className="font-semibold text-slate-800">{viewingBill.billDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Due Date:</span>
                <span className="font-semibold text-slate-800">{viewingBill.dueDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Amount:</span>
                <span className="font-bold text-slate-900">
                  Rs. {viewingBill.grandTotal.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Balance Due:</span>
                <span className="font-bold text-rose-700">
                  Rs. {viewingBill.amountDue.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3">Item / SKU</th>
                    <th className="py-2 px-3 text-center">Quantity</th>
                    <th className="py-2 px-3 text-right">Unit Cost</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingBill.items.map((i, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-800 block">{i.productName}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{i.sku}</span>
                      </td>
                      <td className="py-2 px-3 text-center">{i.quantity}</td>
                      <td className="py-2 px-3 text-right">Rs. {i.unitCost.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-semibold">
                        Rs. {(i.quantity * i.unitCost - (i.discount || 0) + (i.tax || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setViewingBill(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
              {viewingBill.amountDue > 0 && (
                <Link
                  href={`/payments/suppliers?supplierId=${viewingBill.supplierId}&billId=${viewingBill.id}`}
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg transition-colors"
                >
                  Pay This Bill
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function SupplierBillsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Supplier Bills Module...
        </div>
      }
    >
      <SupplierBillsContent />
    </Suspense>
  );
}
