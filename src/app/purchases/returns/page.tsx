'use client';

import React, { useState, useMemo, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetPurchaseReturnsQuery,
  useGetSuppliersQuery,
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetProductVariantsQuery,
  useCreatePurchaseReturnMutation,
} from '@/store/services/apiSlice';
import { hasPermission } from '@/lib/permissions';
import { PurchaseReturn } from '@/types';
import {
  Plus,
  Search,
  Eye,
  Printer,
  AlertCircle,
  X,
  Trash2,
} from 'lucide-react';

function PurchaseReturnsContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: returns = [], isLoading: isReturnsLoading } = useGetPurchaseReturnsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: stockLocations = [] } = useGetStockLocationsQuery();
  const { data: variants = [] } = useGetProductVariantsQuery();
  const [createReturnMutation, { isLoading: isSubmitting }] = useCreatePurchaseReturnMutation();

  const canManageReturns = hasPermission(currentUser, 'purchases.returns.manage');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  // New Return Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState('BR-MAIN-01');
  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState('DEFECTIVE');
  const [returnNotes, setReturnNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Line items
  const [items, setItems] = useState<
    { variantId: string; sku: string; quantity: number; unitCost: number }[]
  >([{ variantId: '', sku: '', quantity: 1, unitCost: 0 }]);

  // View Modal
  const [viewingReturn, setViewingReturn] = useState<PurchaseReturn | null>(null);

  // Locations for selected branch
  const branchLocations = useMemo(() => {
    return stockLocations.filter((l) => l.branchId === branchId && l.isActive);
  }, [stockLocations, branchId]);

  const effectiveLocationId =
    locationId && branchLocations.some((l) => l.id === locationId)
      ? locationId
      : branchLocations[0]?.id || '';

  const handleAddItem = () => {
    setItems((prev) => [...prev, { variantId: '', sku: '', quantity: 1, unitCost: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleVariantChange = (index: number, variantId: string) => {
    const v = variants.find((item) => item.id === variantId);
    if (!v) return;

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        variantId: v.id,
        sku: v.sku,
        unitCost: v.wholesalePrice ? Math.round(v.wholesalePrice * 0.75) : 15000,
      };
      return next;
    });
  };

  const totalReturnVal = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      if (supplierFilter !== 'ALL' && r.supplierId !== supplierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          r.returnNumber.toLowerCase().includes(q) ||
          r.debitNoteNumber.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [returns, supplierFilter, searchQuery]);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!supplierId) {
      setFormError('Please select a supplier.');
      return;
    }

    if (!effectiveLocationId) {
      setFormError('Please select a source location.');
      return;
    }

    if (items.some((i) => !i.variantId || i.quantity <= 0 || i.unitCost <= 0)) {
      setFormError('Please verify all items have selected variants, quantities > 0, and valid costs.');
      return;
    }

    try {
      const res = await createReturnMutation({
        supplierId,
        branchId,
        locationId: effectiveLocationId,
        reason: `${reason}${returnNotes ? ': ' + returnNotes.trim() : ''}`,
        createdByName: currentUser?.name || 'Store Manager',
        items: items.map((i) => ({
          sku: i.sku,
          variantId: i.variantId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
        })),
      }).unwrap();

      setIsModalOpen(false);
      setViewingReturn(res);
    } catch (err: unknown) {
      setFormError((err as { data?: string })?.data || 'Failed to process purchase return.');
    }
  };

  const totalDebitNotesAmount = returns.reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Returns & Debit Notes</h1>
            <p className="text-sm text-slate-500 mt-1">
              Issue returns for damaged/defective mattresses, adjust physical inventory, and reduce accounts payable
            </p>
          </div>

          {canManageReturns && (
            <button
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New Return / Debit Note</span>
            </button>
          )}
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Debit Notes Issued
            </span>
            <span className="text-2xl font-bold text-brand-burgundy mt-1 block">
              Rs. {totalDebitNotesAmount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">{returns.length} return transactions</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Accounting Impact
              </span>
              <p className="text-xs text-slate-600 mt-1">
                Debit notes post an immediate DEBIT entry to the supplier ledger, safely reducing accounts payable without affecting revenue.
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
                placeholder="Search Return #, Debit Note #, Supplier..."
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

        {/* Returns Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Debit Note #</th>
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Branch / Location</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Debit Note Value</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {isReturnsLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading purchase returns...
                    </td>
                  </tr>
                ) : filteredReturns.length > 0 ? (
                  filteredReturns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-brand-burgundy">
                        <button
                          onClick={() => setViewingReturn(r)}
                          className="hover:underline text-left font-mono"
                        >
                          {r.debitNoteNumber}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                        {r.returnNumber}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {r.supplierName}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        <span>{r.branchName}</span>
                        <span className="text-slate-400 block mt-0.5">{r.locationName}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                        {r.returnDate}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-xs truncate">
                        {r.reason}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                        -Rs. {r.totalAmount.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setViewingReturn(r)}
                          className="p-1.5 text-slate-500 hover:text-brand-burgundy hover:bg-slate-100 rounded-md transition-colors"
                          title="View / Print Debit Note"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No purchase returns or debit notes recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Return Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Process Purchase Return & Issue Debit Note</h2>
                <p className="text-xs text-slate-500">
                  Deducts inventory from stock and reduces supplier payable
                </p>
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

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Balance: Rs. {s.currentOutstanding.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Return Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="DEFECTIVE">Defective / Manufacturing Fault</option>
                    <option value="DAMAGED">Damaged in Transit</option>
                    <option value="EXCESS_SHIPMENT">Excess Shipment</option>
                    <option value="WRONG_SPECIFICATION">Wrong Size / Spec</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Stock Location <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={effectiveLocationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    {branchLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Remarks / Serial Numbers
                  </label>
                  <input
                    type="text"
                    placeholder="Specific defect description or serial numbers..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>
              </div>

              {/* Items returning */}
              <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-slate-800">Return Items</span>
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
                      <div className="col-span-6">
                        <select
                          value={row.variantId}
                          onChange={(e) => handleVariantChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                        >
                          <option value="">Select SKU...</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.sku} ({v.productName || 'Mattress'} - {v.sizeLabel})
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

                      <div className="col-span-1 text-center">
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
                  <span className="font-semibold text-slate-700">Total Debit Note Amount:</span>
                  <span className="text-sm font-bold text-emerald-700">
                    Rs. {totalReturnVal.toLocaleString()}
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
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Processing...' : 'Issue Debit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Debit Note Modal */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-brand-burgundy">{viewingReturn.debitNoteNumber}</h2>
                <p className="text-xs text-slate-500">Official Debit Note • {viewingReturn.supplierName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                  title="Print Debit Note"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewingReturn(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Date:</span>
                <span className="font-semibold text-slate-800">{viewingReturn.returnDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Issued By:</span>
                <span className="font-semibold text-slate-800">{viewingReturn.createdByName}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Reason:</span>
                <span className="font-semibold text-slate-800">{viewingReturn.reason}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3 text-center">Returned Qty</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-right">Debit Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingReturn.items.map((i, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <span className="font-mono font-semibold text-slate-800">{i.sku}</span>
                        <span className="block text-[11px] text-slate-500">{i.productName}</span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-rose-700">
                        {i.quantity}
                      </td>
                      <td className="py-2 px-3 text-right">Rs. {i.unitCost.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        Rs. {i.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
              <span className="font-semibold">Credited to Vendor Ledger:</span>
              <span className="text-base font-bold text-emerald-700">
                -Rs. {viewingReturn.totalAmount.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingReturn(null)}
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

export default function PurchaseReturnsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Purchase Returns...
        </div>
      }
    >
      <PurchaseReturnsContent />
    </Suspense>
  );
}
