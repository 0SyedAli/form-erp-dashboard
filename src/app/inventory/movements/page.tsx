'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetStockMovementsQuery,
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetProductVariantsQuery,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import { StockMovement, StockMovementType } from '@/types';
import {
  Search,
  ShieldCheck,
  Eye,
  X,
} from 'lucide-react';

export default function StockMovementsPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const { data: stockLocations = [] } = useGetStockLocationsQuery();
  const { data: variants = [] } = useGetProductVariantsQuery();

  // Filters
  const defaultBranchId = isSuperAdmin ? 'all' : (currentUser?.assignedBranchId || 'all');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState(defaultBranchId);
  const [typeFilter, setTypeFilter] = useState<StockMovementType | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedMovementForView, setSelectedMovementForView] = useState<StockMovement | null>(null);

  const { data: movements = [], isLoading } = useGetStockMovementsQuery({
    branchId: branchFilter === 'all' ? undefined : branchFilter,
    movementType: typeFilter === 'all' ? undefined : typeFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: search.trim() || undefined,
  });

  const getMovementBadge = (type: StockMovementType) => {
    switch (type) {
      case 'STOCK_RECEIPT':
        return { label: 'Stock Receipt', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'OPENING_BALANCE':
        return { label: 'Opening Balance', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'TRANSFER_DISPATCH':
        return { label: 'Transfer Out (Dispatch)', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'TRANSFER_RECEIPT':
        return { label: 'Transfer In (Receipt)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'ADJUSTMENT_IN':
        return { label: 'Adjustment (+)', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'ADJUSTMENT_OUT':
        return { label: 'Adjustment (-)', bg: 'bg-orange-50 text-orange-700 border-orange-200' };
      case 'DAMAGED_STOCK':
        return { label: 'Damaged / Write-off', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'RETURN_TO_SALEABLE':
        return { label: 'Return to Saleable', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      default:
        return { label: type, bg: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const isPositiveDirection = (type: StockMovementType) => {
    return (
      type === 'STOCK_RECEIPT' ||
      type === 'TRANSFER_RECEIPT' ||
      type === 'OPENING_BALANCE' ||
      type === 'ADJUSTMENT_IN' ||
      type === 'RETURN_TO_SALEABLE'
    );
  };

  return (
    <AppLayout title="Movement Ledger" subtitle="Auditable historical ledger of all stock transactions">
      <InventoryNavTabs branchId={branchFilter === 'all' ? undefined : branchFilter} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Stock Movement Audit Ledger
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Immutable ledger trail tracking every inward, dispatch, transfer, write-off, and adjustment event.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Immutable Ledger Protection Active</span>
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search SKU, document ref, notes, user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue"
              />
            </div>

            {/* Branch Filter */}
            <div>
              <select
                aria-label="Filter ledger by branch"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue"
              >
                {isSuperAdmin && <option value="all">Consolidated (All Branches)</option>}
                {authorizedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Type Filter */}
            <div>
              <select
                aria-label="Filter by movement type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as StockMovementType | 'all')}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue"
              >
                <option value="all">All Movement Types</option>
                <option value="STOCK_RECEIPT">Stock Receipts (Inward)</option>
                <option value="OPENING_BALANCE">Opening Balances</option>
                <option value="TRANSFER_DISPATCH">Transfer Dispatch</option>
                <option value="TRANSFER_RECEIPT">Transfer Receipt</option>
                <option value="ADJUSTMENT_IN">Adjustment (+)</option>
                <option value="ADJUSTMENT_OUT">Adjustment (-)</option>
                <option value="DAMAGED_STOCK">Damaged Stock</option>
                <option value="RETURN_TO_SALEABLE">Return to Saleable</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-center justify-end">
              {(search || branchFilter !== defaultBranchId || typeFilter !== 'all' || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setBranchFilter(defaultBranchId);
                    setTypeFilter('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-xs font-semibold text-brand-blue hover:underline"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Document Ref / ID</th>
                  <th className="py-3 px-4">SKU & Product</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Location Pathway</th>
                  <th className="py-3 px-3 text-center">Quantity</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      Loading stock ledger...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No stock movement ledger records found.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => {
                    const badge = getMovementBadge(mov.movementType);
                    const isPositive = isPositiveDirection(mov.movementType);
                    const sourceLoc = stockLocations.find((l) => l.id === mov.sourceLocationId);
                    const destLoc = stockLocations.find((l) => l.id === mov.destinationLocationId);
                    const variant = variants.find((v) => v.sku === mov.sku);

                    return (
                      <tr key={mov.id} className="hover:bg-gray-50/50">
                        {/* Timestamp */}
                        <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                          <p className="font-semibold text-gray-900">
                            {new Date(mov.timestamp).toLocaleDateString('en-PK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <span className="text-[11px] text-gray-400">
                            {new Date(mov.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>

                        {/* Document Ref */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-gray-900 text-xs">
                            {mov.documentReference}
                          </span>
                          <span className="text-[11px] text-gray-400 block font-mono">
                            {mov.id.slice(0, 12)}
                          </span>
                        </td>

                        {/* SKU */}
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-gray-800 text-xs">{mov.sku}</p>
                          <p className="text-[11px] text-gray-500 truncate max-w-[180px]">
                            {variant?.productName || 'Mattress Item'}
                          </p>
                        </td>

                        {/* Movement Type Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Locations */}
                        <td className="py-3 px-4 text-xs text-gray-700">
                          {sourceLoc && destLoc ? (
                            <div className="flex items-center gap-1.5">
                              <span>{sourceLoc.name}</span>
                              <span className="text-gray-400">&rarr;</span>
                              <span className="font-semibold text-brand-blue">{destLoc.name}</span>
                            </div>
                          ) : destLoc ? (
                            <span className="font-semibold text-emerald-700">&rarr; {destLoc.name}</span>
                          ) : sourceLoc ? (
                            <span className="font-semibold text-rose-700">&larr; {sourceLoc.name}</span>
                          ) : (
                            <span className="text-gray-400">Internal adjustment</span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block font-bold text-xs px-2.5 py-0.5 rounded-md ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {isPositive ? `+${mov.quantity}` : `-${mov.quantity}`}
                          </span>
                        </td>

                        {/* Created By */}
                        <td className="py-3 px-4 text-xs text-gray-700 font-medium">
                          {mov.createdBy}
                        </td>

                        {/* View Action */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedMovementForView(mov)}
                            className="p-1.5 text-gray-400 hover:text-brand-blue hover:bg-gray-100 rounded-md cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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

      {/* Movement Details Modal */}
      {selectedMovementForView && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200 overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Ledger Entry Audit Record</h3>
                <span className="text-gray-500 font-mono text-[11px]">{selectedMovementForView.id}</span>
              </div>
              <button
                onClick={() => setSelectedMovementForView(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/60 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Document Reference:</span>
                  <span className="font-mono font-bold text-gray-900">{selectedMovementForView.documentReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SKU:</span>
                  <span className="font-mono font-bold text-gray-900">{selectedMovementForView.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Event Type:</span>
                  <span className="font-semibold text-brand-blue">{selectedMovementForView.movementType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quantity Transacted:</span>
                  <span className="font-bold text-gray-900">{selectedMovementForView.quantity} units</span>
                </div>
              </div>

              <div className="space-y-1 text-gray-600">
                <p>Recorded by: <span className="font-semibold text-gray-800">{selectedMovementForView.createdBy}</span></p>
                <p>Timestamp: <span className="font-semibold text-gray-800">{new Date(selectedMovementForView.timestamp).toLocaleString()}</span></p>
                {selectedMovementForView.unitCost && (
                  <p>Procurement Unit Cost: <span className="font-semibold text-gray-800">PKR {selectedMovementForView.unitCost.toLocaleString()}</span></p>
                )}
                {selectedMovementForView.notes && (
                  <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="font-semibold block text-gray-700">Audit Notes:</span>
                    <p className="italic text-gray-600 mt-0.5">{selectedMovementForView.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedMovementForView(null)}
                className="px-4 py-1.5 bg-gray-200 text-gray-800 font-semibold rounded-lg"
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
