'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useCreateStockReceiptMutation,
  useGetStockBalancesQuery,
} from '@/store/services/inventoryApi';
import { useGetSkusQuery, useGetBranchesQuery } from '@/store/services/catalogueApi';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  PackagePlus,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Boxes,
  Tag,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ReceivingItem {
  id: string;
  sku: string;
  quantity: number;
  unitCost?: number;
}

function StockReceivingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSku = searchParams.get('sku') || '';

  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  // Auto-resolve user branch without showing dropdown
  const { data: allBranches = [] } = useGetBranchesQuery();
  const activeBranchId =
    currentUser?.assignedBranchId ||
    (currentUser?.role === 'SUPER_ADMIN' ? allBranches[0]?.id : undefined);

  // Load real catalogue SKUs
  const { data: skusData, isLoading: isCatalogueLoading } = useGetSkusQuery({ limit: 300 });
  const catalogueSkus = useMemo(() => skusData?.data || [], [skusData]);

  // Live stock balances for current branch to show "Current Stock" preview
  const { data: liveBalances = [] } = useGetStockBalancesQuery(
    activeBranchId ? { branchId: activeBranchId } : undefined
  );

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    liveBalances.forEach((b: any) => {
      map.set(b.sku, b.onHand ?? 0);
    });
    return map;
  }, [liveBalances]);

  // Form State
  const [items, setItems] = useState<ReceivingItem[]>([
    { id: '1', sku: paramSku, quantity: 5 },
  ]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Auto-select SKU when loaded
  useEffect(() => {
    if (paramSku) {
      setItems([{ id: '1', sku: paramSku, quantity: 5 }]);
    } else if (catalogueSkus.length > 0 && !items[0]?.sku) {
      setItems([{ id: '1', sku: catalogueSkus[0].sku, quantity: 5 }]);
    }
  }, [paramSku, catalogueSkus]);

  // Mutation
  const [createStockReceipt, { isLoading: isSubmitting }] = useCreateStockReceiptMutation();

  // Add Item
  const handleAddItem = () => {
    const defaultSku = catalogueSkus[0]?.sku || '';
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sku: defaultSku,
        quantity: 5,
      },
    ]);
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Minimum 1 Item',
        message: 'Aap ko kam az kam aik product add karna lazmi hai.',
      });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Update Item SKU
  const handleSkuChange = (id: string, newSku: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, sku: newSku } : item))
    );
  };

  // Update Item Quantity
  const handleQuantityChange = (id: string, newQty: number) => {
    const safeQty = Math.max(1, isNaN(newQty) ? 1 : newQty);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: safeQty } : item))
    );
  };

  // Quick increment/decrement
  const stepQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = Math.max(1, (item.quantity || 1) + delta);
          return { ...item, quantity: next };
        }
        return item;
      })
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Koi item add nahi kiya',
        message: 'Stock add karne k liye kam az kam aik product select karein.',
      });
      return;
    }

    for (const item of items) {
      if (!item.sku) {
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Product Select Karein',
          message: 'Tamam rows me product select hona zaroori hai.',
        });
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Invalid Quantity',
          message: `Product ${item.sku} ki quantity kam az kam 1 honi chaiye.`,
        });
        return;
      }
    }

    try {
      const payload = {
        branchId: activeBranchId,
        supplierReference: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          sku: i.sku,
          quantityReceived: Number(i.quantity),
          unitCost: i.unitCost && i.unitCost > 0 ? Number(i.unitCost) * 100 : undefined,
        })),
      };

      const res = await createStockReceipt(payload).unwrap();

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Stock Added Successfully!',
        message: `Total ${totalUnits} units stock me kamyabi se shamil ho gaye hain.`,
      });

      // Reset to 1 fresh item
      setReferenceNumber('');
      setNotes('');
      setItems([{ id: Date.now().toString(), sku: catalogueSkus[0]?.sku || '', quantity: 5 }]);
    } catch (err: unknown) {
      const msg =
        (err as any)?.data?.error?.message ||
        (err as any)?.data?.message ||
        (err as Error).message ||
        'Stock add karne me error aaya';
      setToast({
        id: 'rcv-error',
        type: 'error',
        title: 'Stock Addition Failed',
        message: msg,
      });
    }
  };

  const totalUnits = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  return (
    <AppLayout
      title="Add Stock"
      subtitle="Quickly add new stock to your branch inventory"
    >
      <InventoryNavTabs branchId={activeBranchId} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Add Stock to Inventory
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Select products, enter quantities, and confirm. Stock updates instantly with full audit trail.
              </p>
            </div>
          </div>

          <Link
            href="/inventory/stock"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-sm font-semibold rounded-xl shadow-2xs transition-all shrink-0"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            <span>View Stock Balances</span>
          </Link>
        </div>

        {/* Main Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Items List Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Card Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Products to Add
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-brand-blue">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-hover rounded-lg shadow-2xs transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Product</span>
              </button>
            </div>

            {/* Items Rows */}
            <div className="p-5 space-y-4">
              {isCatalogueLoading && catalogueSkus.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto mb-2" />
                  Loading product catalogue...
                </div>
              ) : (
                items.map((item, index) => {
                  const selectedSkuObj = catalogueSkus.find((s: any) => s.sku === item.sku) as any;
                  const currentStockOnHand = stockMap.get(item.sku) ?? 0;
                  const newStockPreview = currentStockOnHand + (Number(item.quantity) || 0);

                  const displayName =
                    selectedSkuObj?.posDisplayName ||
                    selectedSkuObj?.productName ||
                    item.sku ||
                    'Select Product';

                  const sizeText = selectedSkuObj?.sizeLabel || '';
                  const thickText = selectedSkuObj?.thicknessInches
                    ? `${selectedSkuObj.thicknessInches}"`
                    : '';
                  const priceText = selectedSkuObj?.listPrice
                    ? `Rs. ${selectedSkuObj.listPrice.toLocaleString()}`
                    : '';

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Number badge & Product Selector */}
                        <div className="flex items-start sm:items-center gap-3 flex-1">
                          <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                            {index + 1}
                          </span>

                          <div className="flex-1 min-w-0">
                            <label
                              htmlFor={`item-sku-${item.id}`}
                              className="block text-xs font-semibold text-slate-600 mb-1"
                            >
                              Select Product *
                            </label>
                            <select
                              id={`item-sku-${item.id}`}
                              value={item.sku}
                              onChange={(e) => handleSkuChange(item.id, e.target.value)}
                              className="w-full px-3.5 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-slate-900 shadow-2xs"
                            >
                              {catalogueSkus.map((sku: any) => {
                                const label =
                                  sku.posDisplayName ||
                                  `${sku.productName || sku.sku} (${sku.sizeLabel || ''} ${
                                    sku.thicknessInches ? sku.thicknessInches + '"' : ''
                                  })`;
                                return (
                                  <option key={sku.id || sku.sku} value={sku.sku}>
                                    {label} — [{sku.sku}]
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                          <div>
                            <span className="block text-xs font-semibold text-slate-600 mb-1 text-center">
                              Quantity *
                            </span>
                            <div className="flex items-center border border-slate-300 rounded-xl bg-white shadow-2xs overflow-hidden">
                              <button
                                type="button"
                                onClick={() => stepQuantity(item.id, -1)}
                                className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                title="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                                }
                                className="w-16 py-2 text-center text-sm font-bold text-slate-900 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => stepQuantity(item.id, 1)}
                                className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                title="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Remove button */}
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="mt-5 p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Product Preview Card / Stock Insights */}
                      {selectedSkuObj && (
                        <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                          {/* Specs */}
                          <div className="flex flex-wrap items-center gap-2 text-slate-600">
                            <span className="font-semibold text-slate-800">{displayName}</span>
                            {(sizeText || thickText) && (
                              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium">
                                {sizeText} {thickText ? `• ${thickText}` : ''}
                              </span>
                            )}
                            {priceText && (
                              <span className="font-semibold text-slate-700">{priceText}</span>
                            )}
                          </div>

                          {/* Live Stock Comparison */}
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-500">
                              Current: <strong className="text-slate-700">{currentStockOnHand}</strong>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              After: {newStockPreview} units
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Optional Details (Invoice Ref & Notes) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              Optional Details (Challan / Invoice / Notes)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="receiving-ref-input"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Invoice / Challan Reference #
                </label>
                <input
                  id="receiving-ref-input"
                  type="text"
                  placeholder="e.g. FACTORY-CHALLAN-9021"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="receiving-notes-input"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Notes / Remarks
                </label>
                <input
                  id="receiving-notes-input"
                  type="text"
                  placeholder="e.g. Direct factory delivery verified"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Bottom Confirmation Bar */}
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center font-bold text-base shrink-0">
                {totalUnits}
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total Items to Inward</span>
                <span className="text-sm font-bold text-slate-900">
                  {totalUnits} {totalUnits === 1 ? 'unit' : 'units'} across {items.length} {items.length === 1 ? 'product' : 'products'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => router.push('/inventory/stock')}
                className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-hover rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Adding to Stock...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Add to Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
}

export default function StockReceivingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 font-medium">
          Loading Add Stock page...
        </div>
      }
    >
      <StockReceivingContent />
    </Suspense>
  );
}
