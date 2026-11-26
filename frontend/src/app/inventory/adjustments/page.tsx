'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetStockBalancesQuery,
  useCreateAdjustmentsMutation,
} from '@/store/services/inventoryApi';
import { useGetSkusQuery, useGetBranchesQuery } from '@/store/services/catalogueApi';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  SlidersHorizontal,
  CheckCircle2,
  Boxes,
  ArrowRight,
  Building2,
} from 'lucide-react';

export default function StockAdjustmentsPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Optimized branch query for Super Admin
  const { data: allBranches = [] } = useGetBranchesQuery(undefined, { skip: !isSuperAdmin });

  const duraBranch = React.useMemo(() => {
    return (
      allBranches.find(
        (b: any) =>
          b.name?.toLowerCase().includes('dura') ||
          b.code?.toLowerCase().includes('312')
      ) || allBranches[0]
    );
  }, [allBranches]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentUser?.assignedBranchId || ''
  );

  useEffect(() => {
    if (isSuperAdmin && !selectedBranchId && duraBranch?.id) {
      setSelectedBranchId(duraBranch.id);
    }
  }, [isSuperAdmin, selectedBranchId, duraBranch]);

  const effectiveBranchId = isSuperAdmin
    ? selectedBranchId || duraBranch?.id
    : currentUser?.assignedBranchId;

  // Balances and SKUs strictly scoped to the active branch
  const { data: stockBalances = [], isLoading: isBalancesLoading, refetch: refetchBalances } = useGetStockBalancesQuery(
    effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
    { skip: isSuperAdmin && !effectiveBranchId }
  );
  const { data: skusData, refetch: refetchSkus } = useGetSkusQuery(
    {
      all: true,
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    },
    { skip: isSuperAdmin && !effectiveBranchId }
  );
  const allSkus = useMemo(() => {
    if (Array.isArray(skusData?.data)) return skusData.data;
    if (Array.isArray((skusData as any)?.items)) return (skusData as any).items;
    return [];
  }, [skusData]);

  // Form State
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<
    'PHYSICAL_COUNT' | 'DAMAGE_WRITE_OFF' | 'ADMINISTRATIVE'
  >('PHYSICAL_COUNT');
  const [newPhysicalQty, setNewPhysicalQty] = useState<number | ''>(0);
  const [reason, setReason] = useState<string>('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Auto-select first SKU when branch or SKU list changes
  useEffect(() => {
    if (allSkus.length > 0) {
      const exists = allSkus.some((s: any) => s.sku === selectedSku);
      if (!exists) {
        setSelectedSku(allSkus[0].sku);
      }
    } else {
      setSelectedSku('');
    }
  }, [allSkus, effectiveBranchId]);

  // Active current stock
  const currentBalance = stockBalances.find((b: any) => b.sku === selectedSku);
  const currentQuantity = currentBalance?.onHand ?? 0;

  // Sync newPhysicalQty default when SKU changes
  useEffect(() => {
    setNewPhysicalQty(currentQuantity);
  }, [selectedSku, currentQuantity]);

  const finalQty = typeof newPhysicalQty === 'number' ? newPhysicalQty : 0;
  const qtyDifference = finalQty - currentQuantity;

  // Mutation
  const [createAdjustments, { isLoading: isSubmitting }] = useCreateAdjustmentsMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSku) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'SKU Required',
        message: 'Please select an item to adjust.',
      });
      return;
    }

    if (!reason.trim()) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Reason Mandatory',
        message: 'A brief explanation is required for every stock adjustment.',
      });
      return;
    }

    if (finalQty < 0) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Invalid Quantity',
        message: 'Physical quantity cannot be negative.',
      });
      return;
    }

    if (qtyDifference === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'No Quantity Change',
        message: 'New physical quantity matches current stock. No adjustment needed.',
      });
      return;
    }

    try {
      await createAdjustments({
        branchId: effectiveBranchId,
        items: [
          {
            sku: selectedSku,
            newPhysicalQuantity: Number(newPhysicalQty),
            adjustmentType,
            reason: reason.trim(),
          },
        ],
      }).unwrap();

      // Silently refetch balances and SKUs immediately
      refetchBalances();
      refetchSkus();

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Stock Adjusted Successfully',
        message: `SKU ${selectedSku} balance updated from ${currentQuantity} to ${newPhysicalQty} units.`,
      });

      setReason('');
    } catch (err: unknown) {
      const msg =
        (err as any)?.data?.error?.message ||
        (err as any)?.data?.message ||
        (err as Error).message ||
        'Failed to adjust stock';
      setToast({
        id: 'adj-error',
        type: 'error',
        title: 'Adjustment Failed',
        message: msg,
      });
    }
  };

  return (
    <AppLayout
      title="Stock Adjustments"
      subtitle="Physical count corrections, damage write-offs, and audit adjustments"
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Stock Adjustments & Reconciliation
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Correct physical inventory discrepancies or record write-offs with audit tracking.
            </p>
          </div>

          <Link
            href="/inventory/stock"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-sm font-semibold rounded-xl shadow-2xs transition-all shrink-0"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            <span>View Stock Balances</span>
          </Link>
        </div>

        {/* Main Adjustment Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          {/* Target Branch Selector for Super Admin */}
          {isSuperAdmin && allBranches.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <label
                htmlFor="adj-branch-select"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Adjusting Stock For Branch *</span>
              </label>
              <select
                id="adj-branch-select"
                value={effectiveBranchId || ''}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-slate-900 shadow-2xs cursor-pointer"
              >
                {allBranches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* SKU Selection & Current Balance Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="adj-sku-select"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Select Product / SKU *
              </label>
              <select
                id="adj-sku-select"
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-slate-900 shadow-2xs"
              >
                {allSkus.map((sku: any) => {
                  const display =
                    sku.posDisplayName ||
                    `${sku.productName || sku.sku} (${sku.sizeLabel || ''} ${sku.thicknessInches ? sku.thicknessInches + '"' : ''
                    })`;
                  return (
                    <option key={sku.id || sku.sku} value={sku.sku}>
                      {display} — [{sku.sku}]
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Current Balance Display */}
            <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 flex flex-col justify-center items-center sm:items-start shadow-2xs">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                Current On-Hand Stock
              </span>
              <span className="text-2xl font-extrabold text-brand-blue mt-0.5">
                {currentQuantity} units
              </span>
            </div>
          </div>

          {/* Adjustment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="adj-type-select"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Adjustment Type *
              </label>
              <select
                id="adj-type-select"
                value={adjustmentType}
                onChange={(e) =>
                  setAdjustmentType(
                    e.target.value as 'PHYSICAL_COUNT' | 'DAMAGE_WRITE_OFF' | 'ADMINISTRATIVE'
                  )
                }
                className="w-full px-3.5 py-2.5 text-sm font-medium bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900 shadow-2xs"
              >
                <option value="PHYSICAL_COUNT">Physical Count Correction</option>
                <option value="DAMAGE_WRITE_OFF">Damaged Stock Write-Off</option>
                <option value="ADMINISTRATIVE">Administrative / Audit Entry</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="new-qty-input"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                New Physical Count *
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="new-qty-input"
                  type="number"
                  min="0"
                  value={newPhysicalQty}
                  onChange={(e) => {
                    if (e.target.value === '') {
                      setNewPhysicalQty('');
                      return;
                    }
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setNewPhysicalQty(Math.max(0, val));
                    }
                  }}
                  onBlur={() => {
                    if (newPhysicalQty === '') {
                      setNewPhysicalQty(0);
                    }
                  }}
                  className="w-full px-3.5 py-2 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900 shadow-2xs"
                />
                <span
                  className={`text-xs font-bold whitespace-nowrap px-3 py-2 rounded-xl border ${qtyDifference > 0
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : qtyDifference < 0
                      ? 'text-rose-700 bg-rose-50 border-rose-200'
                      : 'text-slate-500 bg-slate-50 border-slate-200'
                    }`}
                >
                  {qtyDifference > 0 ? `+${qtyDifference}` : qtyDifference} diff
                </span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label
              htmlFor="adj-reason-input"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
            >
              Adjustment Reason *
            </label>
            <input
              id="adj-reason-input"
              type="text"
              placeholder="e.g. Monthly stock count audit verification / Transit tear inspection"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/inventory/stock"
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-hover rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Adjustment...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Post Adjustment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
}
