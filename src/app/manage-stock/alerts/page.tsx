'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector } from '@/store';
import {
  useGetInventoryBalancesQuery,
  useGetBranchesQuery,
  useGetStockLocationsQuery,
} from '@/store/services/apiSlice';
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Boxes,
} from 'lucide-react';

function StockAlertsContent() {
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(currentUser?.assignedBranchId || 'ALL');

  // Queries
  const { data: balances = [], isLoading } = useGetInventoryBalancesQuery();
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: stockLocations = [] } = useGetStockLocationsQuery();

  const locationMap = useMemo(() => new Map(stockLocations.map((l) => [l.id, l])), [stockLocations]);
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  // Aggregate Alert Metrics
  const metrics = useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let healthy = 0;

    balances.forEach((b) => {
      if (b.onHand <= 0) {
        outOfStock++;
      } else if (b.onHand <= b.reorderLevel) {
        lowStock++;
      } else {
        healthy++;
      }
    });

    return {
      outOfStock,
      lowStock,
      healthy,
      total: balances.length,
    };
  }, [balances]);

  // Filtered Alert Items
  const alertItems = useMemo(() => {
    return balances.filter((b) => {
      const loc = locationMap.get(b.stockLocationId);
      const branchId = b.branchId || loc?.branchId;

      const matchesBranch = branchFilter === 'ALL' || branchId === branchFilter;

      const isOut = b.onHand <= 0;
      const isLow = b.onHand > 0 && b.onHand <= b.reorderLevel;

      let matchesStatus = true;
      if (statusFilter === 'OUT_OF_STOCK') matchesStatus = isOut;
      else if (statusFilter === 'LOW_STOCK') matchesStatus = isLow;
      else matchesStatus = isOut || isLow; // Default to showing items needing attention

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.sku.toLowerCase().includes(q) ||
        (b.productName && b.productName.toLowerCase().includes(q)) ||
        (b.brandName && b.brandName.toLowerCase().includes(q));

      return matchesBranch && matchesStatus && matchesSearch;
    });
  }, [balances, branchFilter, statusFilter, searchQuery, locationMap]);

  return (
    <AppLayout>
      <div className="space-y-6 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/manage-stock"
              className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-600 transition-colors cursor-pointer"
              title="Back to Manage Stock"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Inventory Stock Alerts
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-normal">
                Real-time surveillance of stockouts, critical deficits and items below minimum reorder levels
              </p>
            </div>
          </div>

          <Link
            href="/manage-stock"
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Boxes className="w-4 h-4" />
            <span>Reconcile / Update Stock</span>
          </Link>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800">Critical Stockouts</span>
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-2xl font-extrabold text-rose-700 font-mono mt-2 block">
              {metrics.outOfStock} <span className="text-xs font-normal text-rose-500">SKUs</span>
            </span>
            <p className="text-[11px] text-rose-600 mt-1">Zero inventory available in branch stockrooms</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800">Low Stock Threshold</span>
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-2xl font-extrabold text-amber-700 font-mono mt-2 block">
              {metrics.lowStock} <span className="text-xs font-normal text-amber-500">SKUs</span>
            </span>
            <p className="text-[11px] text-amber-600 mt-1">Quantity is below minimum safe reorder level</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800">Adequate Stock</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-2xl font-extrabold text-emerald-700 font-mono mt-2 block">
              {metrics.healthy} <span className="text-xs font-normal text-emerald-500">SKUs</span>
            </span>
            <p className="text-[11px] text-emerald-600 mt-1">Inventory levels meet standard buffer requirements</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Warning Items</option>
              <option value="OUT_OF_STOCK">Out of Stock Only</option>
              <option value="LOW_STOCK">Low Stock Only</option>
            </select>

            {currentUser?.role === 'SUPER_ADMIN' && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {(searchQuery || statusFilter !== 'ALL' || branchFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setBranchFilter('ALL');
                }}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-600">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Product SKU</th>
                  <th className="py-3 px-4">Product Specification</th>
                  <th className="py-3 px-4">Branch / Location</th>
                  <th className="py-3 px-4 text-right">Available Stock</th>
                  <th className="py-3 px-4 text-right">Min Stock Limit</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400">
                      Scanning inventory levels...
                    </td>
                  </tr>
                ) : alertItems.length > 0 ? (
                  alertItems.map((item) => {
                    const loc = locationMap.get(item.stockLocationId);
                    const branch = branchMap.get(item.branchId);
                    const isOutOfStock = item.onHand <= 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          {item.sku}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-gray-900 text-xs">
                            {item.productName || item.brandName}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {item.sizeLabel} {item.thicknessInches ? `| ${item.thicknessInches} inch` : ''}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-gray-700">
                          <div className="font-semibold">{branch?.name || 'Main Branch'}</div>
                          <div className="text-[10px] text-gray-400">{loc?.name || 'Stockroom'}</div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                          <span className={isOutOfStock ? 'text-rose-600' : 'text-amber-700'}>
                            {item.onHand}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-gray-700">
                          {item.reorderLevel}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Link
                            href="/manage-stock"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-brand-blue rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <span>Manage Stock</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-500">
                      No low stock or out of stock items found. All monitored inventory meets safe buffer levels!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function StockAlertsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Loading Stock Alerts...</div>}>
      <StockAlertsContent />
    </Suspense>
  );
}
