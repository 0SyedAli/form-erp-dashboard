'use client';

import React, { useState, useMemo } from 'react';
import {
  useGetProductsQuery,
  useGetBrandsQuery,
  useGetVariantsQuery,
  useBulkUpdatePricingMutation,
} from '@/store/services/apiSlice';
import { X, TrendingUp } from 'lucide-react';

interface BulkPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  currentUserEmail?: string;
}

export default function BulkPriceModal({
  isOpen,
  onClose,
  onSuccess,
  currentUserEmail = 'admin@moltyfoam.com',
}: BulkPriceModalProps) {
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: products = [] } = useGetProductsQuery();
  const { data: variants = [] } = useGetVariantsQuery();

  const [bulkUpdate, { isLoading }] = useBulkUpdatePricingMutation();

  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [retailPercent, setRetailPercent] = useState<string>('5');
  const [wholesalePercent, setWholesalePercent] = useState<string>('5');
  const [reason, setReason] = useState<string>('Annual catalogue tariff revision');
  const [apiError, setApiError] = useState<string | null>(null);

  // Target variants based on filters
  const targetVariants = useMemo(() => {
    return variants.filter((v) => {
      const prod = products.find((p) => p.id === v.productId);
      if (!prod) return false;

      if (selectedBrandId !== 'all' && prod.brandId !== selectedBrandId) return false;
      if (selectedProductId !== 'all' && prod.id !== selectedProductId) return false;

      return true;
    });
  }, [variants, products, selectedBrandId, selectedProductId]);

  if (!isOpen) return null;

  const handleApply = async () => {
    setApiError(null);
    const rPct = parseFloat(retailPercent) || 0;
    const wPct = parseFloat(wholesalePercent) || 0;

    if (targetVariants.length === 0) {
      setApiError('No variants match the selected brand/product filter.');
      return;
    }

    try {
      const updates = targetVariants.map((v) => {
        const newRetail = Math.max(0, Math.round(v.retailPrice * (1 + rPct / 100)));
        const newWholesale = Math.max(0, Math.round(v.wholesalePrice * (1 + wPct / 100)));

        return {
          variantId: v.id,
          retailPrice: newRetail,
          wholesalePrice: newWholesale,
        };
      });

      const res = await bulkUpdate({
        updates,
        reason: reason.trim() || 'Bulk tariff adjustment',
        changedBy: currentUserEmail,
      }).unwrap();

      onSuccess(res.length);
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to apply bulk pricing';
      setApiError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="bulk-price-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-semibold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 id="bulk-price-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                Bulk Price Adjustment
              </h2>
              <p className="text-xs text-gray-500">
                Apply percentage adjustments across filtered variants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm">
          {apiError && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {apiError}
            </div>
          )}

          {/* Scope Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Target Brand
              </label>
              <select
                value={selectedBrandId}
                onChange={(e) => {
                  setSelectedBrandId(e.target.value);
                  setSelectedProductId('all');
                }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-hidden focus:border-brand-blue"
              >
                <option value="all">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Target Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-hidden focus:border-brand-blue"
              >
                <option value="all">All Products</option>
                {products
                  .filter((p) => selectedBrandId === 'all' || p.brandId === selectedBrandId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Adjustment Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Retail Adjustment (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={retailPercent}
                  onChange={(e) => setRetailPercent(e.target.value)}
                  placeholder="+5"
                  className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                  %
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Use negative for markdown (e.g. -5)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Wholesale Adjustment (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={wholesalePercent}
                  onChange={(e) => setWholesalePercent(e.target.value)}
                  placeholder="+5"
                  className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                  %
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Use negative for markdown</p>
            </div>
          </div>

          {/* Audit Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Audit Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Inflation tariff update"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
          </div>

          {/* Impact preview card */}
          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1 text-xs">
            <div className="flex items-center justify-between font-semibold text-gray-800">
              <span>Matching Variants in Scope:</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-brand-blue font-bold">
                {targetVariants.length} SKUs
              </span>
            </div>
            <p className="text-gray-500 text-[11px] leading-relaxed">
              Applying this batch operation will compute and record separate audit history entries for
              all {targetVariants.length} variants. Historical invoice snapshots will NOT be altered.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isLoading || targetVariants.length === 0}
            className="px-5 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoading ? 'Applying...' : `Update ${targetVariants.length} SKUs`}
          </button>
        </div>
      </div>
    </div>
  );
}
