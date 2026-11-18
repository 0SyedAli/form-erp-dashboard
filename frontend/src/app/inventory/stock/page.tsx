'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import { useGetStockBalancesQuery } from '@/store/services/inventoryApi';
import { useGetBrandsQuery } from '@/store/services/catalogueApi';
import {
  Boxes,
  Search,
  AlertTriangle,
  SlidersHorizontal,
  RefreshCw,
  Plus,
} from 'lucide-react';

export default function StockBalancesPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const activeBranchId = currentUser?.assignedBranchId;

  const { data: brands = [] } = useGetBrandsQuery();

  // Filter States
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const {
    data: rawBalances = [],
    isLoading,
  } = useGetStockBalancesQuery(
    activeBranchId ? { branchId: activeBranchId } : undefined,
    { refetchOnMountOrArgChange: false }
  );

  // Filter items cleanly
  const filteredBalances = useMemo(() => {
    return rawBalances.filter((item: any) => {
      const v = item.variant;
      const bName = v?.productId?.brandId?.name || item.brandName || '';
      if (brandFilter !== 'all' && bName !== brandFilter) return false;

      const avail = item.available ?? (item.onHand - (item.reserved || 0));
      const reorder = item.reorderLevel ?? 1;
      if (lowStockOnly && avail > reorder) return false;

      return true;
    });
  }, [rawBalances, brandFilter, lowStockOnly]);

  return (
    <AppLayout title="Stock Balances" subtitle="Live store inventory balances and availability">
      <InventoryNavTabs branchId={activeBranchId} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Stock Balances
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live stock in hand. Formula: <span className="font-semibold text-slate-700">Available = On Hand − Reserved</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/inventory/receiving"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-semibold rounded-xl shadow-2xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stock (Inward)</span>
            </Link>
            <Link
              href="/inventory/adjustments"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-medium rounded-xl shadow-2xs transition-all"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>Adjust Stock</span>
            </Link>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search SKU or Product Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900"
              />
            </div>

            {/* Brand Filter */}
            <div>
              <select
                aria-label="Filter by brand"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900 font-medium"
              >
                <option value="all">All Brands</option>
                {brands.map((br) => (
                  <option key={br.id} value={br.name}>
                    {br.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filter & Count */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="rounded-sm text-brand-blue focus:ring-brand-blue/30 w-4 h-4 border-slate-300"
              />
              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Show Low / Out of Stock Only
              </span>
            </label>

            <div className="flex items-center gap-3">
              {(search || brandFilter !== 'all' || lowStockOnly) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setBrandFilter('all');
                    setLowStockOnly(false);
                  }}
                  className="text-xs text-brand-blue hover:underline font-semibold"
                >
                  Clear Filters
                </button>
              )}
              <span className="text-slate-500 font-medium">
                Showing <strong className="text-slate-900">{filteredBalances.length}</strong> items
              </span>
            </div>
          </div>
        </div>

        {/* Stock Balances Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">SKU Code</th>
                  <th className="py-3.5 px-4">Product Details</th>
                  <th className="py-3.5 px-4">Brand</th>
                  <th className="py-3.5 px-3 text-center">On Hand</th>
                  <th className="py-3.5 px-3 text-center">Reserved</th>
                  <th className="py-3.5 px-3 text-center">Available</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-blue" />
                      Loading live stock balances...
                    </td>
                  </tr>
                ) : filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No stock items found.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((item: any) => {
                    const variant = item.variant;
                    const productName =
                      variant?.productId?.name ||
                      variant?.product?.name ||
                      item.productName ||
                      item.sku;
                    const posDisplayName =
                      variant?.productId?.posDisplayName ||
                      variant?.posDisplayName;
                    const brandName =
                      variant?.productId?.brandId?.name || item.brandName || 'MoltyFoam';
                    const sizeLabel =
                      variant?.sizeId?.displayLabel || item.sizeLabel || 'Standard';
                    const thicknessLabel =
                      variant?.thicknessId?.displayLabel ||
                      (variant?.thicknessId?.value ? `${variant.thicknessId.value}"` : '');

                    const onHand = item.onHand ?? 0;
                    const reserved = item.reserved ?? 0;
                    const available = item.available ?? Math.max(0, onHand - reserved);
                    const reorderLevel = item.reorderLevel ?? 1;

                    return (
                      <tr key={item._id || item.id} className="hover:bg-blue-50/20 transition-colors">
                        {/* SKU */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 text-xs">
                          {item.sku}
                        </td>

                        {/* Product & Spec */}
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900 text-sm">{productName}</p>
                          {posDisplayName && (
                            <p className="text-xs text-brand-blue font-medium">{posDisplayName}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-0.5">
                            Size: <span className="text-slate-700 font-medium">{sizeLabel}</span>
                            {thicknessLabel ? ` • Thickness: ${thicknessLabel}` : ''}
                          </p>
                        </td>

                        {/* Brand */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                            {brandName}
                          </span>
                        </td>

                        {/* On Hand */}
                        <td className="py-3.5 px-3 text-center font-bold text-slate-900 text-sm">
                          {onHand}
                        </td>

                        {/* Reserved */}
                        <td className="py-3.5 px-3 text-center text-slate-500 text-xs font-medium">
                          {reserved}
                        </td>

                        {/* Available */}
                        <td className="py-3.5 px-3 text-center font-bold">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              available <= 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : available <= reorderLevel
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {available}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center">
                          {available <= 0 ? (
                            <span className="text-xs font-semibold text-rose-600">Out of Stock</span>
                          ) : available <= reorderLevel ? (
                            <span className="text-xs font-semibold text-amber-600">Low Stock</span>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-600">In Stock</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/inventory/receiving?sku=${encodeURIComponent(item.sku)}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-brand-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Stock</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
