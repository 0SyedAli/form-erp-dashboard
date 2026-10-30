'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetSuppliersQuery,
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetProductVariantsQuery,
  useGetCatalogueProductsQuery,
  useCreatePurchaseOrderMutation,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import {
  Plus,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Send,
} from 'lucide-react';

interface POItemRow {
  variantId: string;
  orderedQuantity: number;
  unitCost: number;
  lineDiscount: number;
  taxAmount: number;
}

function CreatePurchaseOrderContent() {
  const router = useRouter();
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: stockLocations = [] } = useGetStockLocationsQuery();
  const { data: variants = [] } = useGetProductVariantsQuery();
  const { data: products = [] } = useGetCatalogueProductsQuery();

  const [createPOMutation, { isLoading: isSubmitting }] = useCreatePurchaseOrderMutation();

  // Form State
  const [supplierId, setSupplierId] = useState<string>('');
  const [destinationBranchId, setDestinationBranchId] = useState<string>(
    authorizedBranches[0]?.id || 'BR-MAIN-01'
  );
  const [destinationLocationId, setDestinationLocationId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Line Items
  const [items, setItems] = useState<POItemRow[]>([
    {
      variantId: '',
      orderedQuantity: 1,
      unitCost: 0,
      lineDiscount: 0,
      taxAmount: 0,
    },
  ]);

  // Filter locations for selected branch
  const branchLocations = useMemo(() => {
    return stockLocations.filter(
      (loc) => loc.branchId === destinationBranchId && loc.isActive
    );
  }, [stockLocations, destinationBranchId]);

  const effectiveLocationId =
    destinationLocationId && branchLocations.some((l) => l.id === destinationLocationId)
      ? destinationLocationId
      : branchLocations[0]?.id || '';

  // Add Item Row
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        variantId: '',
        orderedQuantity: 1,
        unitCost: 0,
        lineDiscount: 0,
        taxAmount: 0,
      },
    ]);
  };

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      alert('A purchase order must contain at least one SKU.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update Item Field
  const handleItemChange = (index: number, field: keyof POItemRow, val: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };

      if (field === 'variantId') {
        item.variantId = String(val);
        const selectedVariant = variants.find((v) => v.id === val);
        if (selectedVariant) {
          // Pre-populate unit cost with actual variant wholesale price / wholesale reference as cost baseline
          item.unitCost = selectedVariant.wholesalePrice ? Math.round(selectedVariant.wholesalePrice * 0.75) : 15000;
        }
      } else {
        item[field] = Number(val) as never;
      }

      next[index] = item;
      return next;
    });
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const lineSub = item.orderedQuantity * item.unitCost;
      const d = item.lineDiscount || 0;
      const t = item.taxAmount || 0;
      subtotal += lineSub;
      totalDiscount += d;
      totalTax += t;
    });

    const grandTotal = Math.max(0, subtotal - totalDiscount + totalTax);
    return { subtotal, totalDiscount, totalTax, grandTotal };
  }, [items]);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }

    if (!destinationBranchId || !effectiveLocationId) {
      setErrorMsg('Please select a destination branch and receiving stock location.');
      return;
    }

    if (items.some((i) => !i.variantId)) {
      setErrorMsg('Please select a variant for all line items.');
      return;
    }

    if (items.some((i) => i.orderedQuantity <= 0)) {
      setErrorMsg('All ordered quantities must be greater than zero.');
      return;
    }

    if (items.some((i) => i.unitCost < 0)) {
      setErrorMsg('Unit costs cannot be negative.');
      return;
    }

    try {
      const createdPO = await createPOMutation({
        supplierId,
        destinationBranchId,
        destinationLocationId: effectiveLocationId,
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || new Date().toISOString().slice(0, 10),
        notes: notes.trim() || undefined,
        createdBy: currentUser?.name || 'Procurement Officer',
        createdByName: currentUser?.name || 'Procurement Officer',
        items: items.map((i) => ({
          variantId: i.variantId,
          orderedQuantity: Number(i.orderedQuantity),
          unitCost: Number(i.unitCost),
          lineDiscount: Number(i.lineDiscount || 0),
          taxAmount: Number(i.taxAmount || 0),
        })),
      }).unwrap();

      router.push(`/purchases/orders/${createdPO.id}`);
    } catch (err: unknown) {
      setErrorMsg((err as { data?: string })?.data || 'Failed to create purchase order.');
    }
  };

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Back Link & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/purchases/orders"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Purchase Order</h1>
              <p className="text-sm text-slate-500">
                Issue a new purchase requisition to a mattress manufacturer or supplier
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PO Header Details Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Order Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Supplier Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier <span className="text-rose-600">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              >
                <option value="">Select Supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) — {s.paymentTerms || 'Net 30'}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Branch */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Branch <span className="text-rose-600">*</span>
              </label>
              <select
                value={destinationBranchId}
                onChange={(e) => setDestinationBranchId(e.target.value)}
                disabled={!isSuperAdmin && authorizedBranches.length === 1}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy disabled:opacity-75"
              >
                {authorizedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Receiving Stock Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receiving Location <span className="text-rose-600">*</span>
              </label>
              <select
                value={effectiveLocationId}
                onChange={(e) => setDestinationLocationId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              >
                {branchLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            {/* Order Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              />
            </div>

            {/* Expected Delivery Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Notes</label>
              <input
                type="text"
                placeholder="Special delivery instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              />
            </div>
          </div>
        </div>

        {/* Line Items Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Line Items & Quantities</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-burgundy hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add SKU</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3 min-w-[280px]">Mattress SKU / Variant</th>
                  <th className="py-2.5 px-3 w-28 text-center">Quantity</th>
                  <th className="py-2.5 px-3 w-32 text-right">Unit Cost (PKR)</th>
                  <th className="py-2.5 px-3 w-28 text-right">Discount (Rs)</th>
                  <th className="py-2.5 px-3 w-32 text-right">Line Total</th>
                  <th className="py-2.5 px-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((row, idx) => {
                  const lineTotal = Math.max(
                    0,
                    row.orderedQuantity * row.unitCost - (row.lineDiscount || 0) + (row.taxAmount || 0)
                  );

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {/* Variant Selection */}
                      <td className="py-2.5 px-3">
                        <select
                          value={row.variantId}
                          onChange={(e) => handleItemChange(idx, 'variantId', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                        >
                          <option value="">Select SKU...</option>
                          {variants.map((v) => {
                            const prod = products.find((p) => p.id === v.productId);
                            return (
                              <option key={v.id} value={v.id}>
                                {v.sku} — {prod?.name || 'Mattress'} ({v.sizeLabel || 'Standard'} / {v.thicknessLabel || ''})
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min={1}
                          value={row.orderedQuantity}
                          onChange={(e) =>
                            handleItemChange(idx, 'orderedQuantity', Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-20 px-2 py-1.5 text-xs text-center bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                        />
                      </td>

                      {/* Unit Cost */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          value={row.unitCost}
                          onChange={(e) =>
                            handleItemChange(idx, 'unitCost', Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-28 px-2 py-1.5 text-xs text-right bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                        />
                      </td>

                      {/* Discount */}
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          value={row.lineDiscount}
                          onChange={(e) =>
                            handleItemChange(idx, 'lineDiscount', Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-24 px-2 py-1.5 text-xs text-right bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                        />
                      </td>

                      {/* Line Total */}
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        Rs. {lineTotal.toLocaleString()}
                      </td>

                      {/* Delete */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col sm:flex-row justify-end items-end gap-3 pt-4 border-t border-slate-100">
            <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-medium">Rs. {calculations.subtotal.toLocaleString()}</span>
              </div>
              {calculations.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Total Discount:</span>
                  <span className="font-medium">-Rs. {calculations.totalDiscount.toLocaleString()}</span>
                </div>
              )}
              {calculations.totalTax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax:</span>
                  <span className="font-medium">Rs. {calculations.totalTax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-brand-burgundy">Rs. {calculations.grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/purchases/orders"
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Submitting...' : 'Submit Purchase Order'}</span>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

export default function CreatePurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Create Purchase Order...
        </div>
      }
    >
      <CreatePurchaseOrderContent />
    </Suspense>
  );
}
