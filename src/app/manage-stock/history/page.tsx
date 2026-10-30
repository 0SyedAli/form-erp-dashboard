'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector } from '@/store';
import {
  useGetStockMovementsQuery,
  useGetBranchesQuery,
  useGetStockLocationsQuery,
} from '@/store/services/apiSlice';
import {
  ArrowLeft,
  Search,
  RotateCcw,
  History,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

function StockHistoryContent() {
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(currentUser?.assignedBranchId || 'ALL');

  // Queries
  const { data: movements = [], isLoading } = useGetStockMovementsQuery();
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: stockLocations = [] } = useGetStockLocationsQuery();

  const locationMap = useMemo(() => new Map(stockLocations.map((l) => [l.id, l])), [stockLocations]);
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const locId = m.destinationLocationId || m.sourceLocationId || '';
      const loc = locationMap.get(locId);
      const branchId = loc?.branchId || m.destinationBranchId || m.sourceBranchId;

      const matchesBranch =
        branchFilter === 'ALL' || branchId === branchFilter;

      const matchesType = typeFilter === 'ALL' || m.movementType === typeFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.sku.toLowerCase().includes(q) ||
        (m.documentReference && m.documentReference.toLowerCase().includes(q)) ||
        (m.notes && m.notes.toLowerCase().includes(q)) ||
        (m.createdBy && m.createdBy.toLowerCase().includes(q));

      return matchesBranch && matchesType && matchesSearch;
    });
  }, [movements, branchFilter, typeFilter, searchQuery, locationMap]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let additions = 0;
    let deductions = 0;
    let audits = 0;

    movements.forEach((m) => {
      if (m.quantity > 0) additions += m.quantity;
      else deductions += Math.abs(m.quantity);

      if (m.movementType.includes('ADJUSTMENT') || m.movementType.includes('AUDIT')) {
        audits++;
      }
    });

    return {
      total: movements.length,
      additions,
      deductions,
      audits,
    };
  }, [movements]);

  const getMovementBadge = (type: string, qty: number) => {
    if (qty > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <TrendingUp className="w-3 h-3" />
          {type.replace(/_/g, ' ')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <TrendingDown className="w-3 h-3" />
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

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
                Stock Movement History
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-normal">
                Immutable audit ledger of physical counts, goods receipts, transfers and sales deductions
              </p>
            </div>
          </div>

          <Link
            href="/manage-stock"
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <History className="w-4 h-4" />
            <span>Manage Stock</span>
          </Link>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-gray-500 block">Total Ledger Entries</span>
            <span className="text-xl font-bold text-gray-900 font-mono mt-1 block">
              {metrics.total}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-600 block">Total Units Added</span>
            <span className="text-xl font-bold text-emerald-700 font-mono mt-1 block">
              +{metrics.additions}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-rose-600 block">Total Units Deducted</span>
            <span className="text-xl font-bold text-rose-700 font-mono mt-1 block">
              -{metrics.deductions}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-blue-600 block">Physical Audits</span>
            <span className="text-xl font-bold text-brand-blue font-mono mt-1 block">
              {metrics.audits}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Movement Types</option>
              <option value="PURCHASE_RECEIPT">Purchase Receipt</option>
              <option value="SALE_DEDUCTION">POS Sale Deduction</option>
              <option value="ADJUSTMENT_IN">Adjustment (In)</option>
              <option value="ADJUSTMENT_OUT">Adjustment (Out)</option>
              <option value="OPENING_BALANCE">Opening Balance</option>
              <option value="TRANSFER_IN">Transfer In</option>
              <option value="TRANSFER_OUT">Transfer Out</option>
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

            {(searchQuery || typeFilter !== 'ALL' || branchFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('ALL');
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

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-600">
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Product SKU</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Stockroom</th>
                  <th className="py-3 px-4">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400">
                      Loading audit movements...
                    </td>
                  </tr>
                ) : filteredMovements.length > 0 ? (
                  filteredMovements.map((m) => {
                    const locId = m.destinationLocationId || m.sourceLocationId || '';
                    const loc = locationMap.get(locId);
                    const branchId = loc?.branchId || m.destinationBranchId || m.sourceBranchId;
                    const branch = branchId ? branchMap.get(branchId) : null;

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">
                          {new Date(m.timestamp).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          {m.sku}
                        </td>

                        <td className="py-3 px-4">
                          {getMovementBadge(m.movementType, m.quantity)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                          <span
                            className={
                              m.quantity > 0
                                ? 'text-emerald-700'
                                : m.quantity < 0
                                ? 'text-rose-700'
                                : 'text-gray-700'
                            }
                          >
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-xs text-gray-600">
                          {m.documentReference || '—'}
                        </td>

                        <td className="py-3 px-4 text-gray-700">
                          <div className="font-semibold">{loc?.name || 'Main Stockroom'}</div>
                          {branch && <div className="text-[10px] text-gray-400">{branch.name}</div>}
                        </td>

                        <td className="py-3 px-4 text-gray-600 font-medium">
                          {m.createdBy || 'System'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-500">
                      No stock movement records found matching your filters.
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

export default function StockHistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Loading Stock History...</div>}>
      <StockHistoryContent />
    </Suspense>
  );
}
