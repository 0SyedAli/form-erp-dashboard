'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetInventoryBalancesQuery,
  useGetStockLocationsQuery,
  useGetBranchesQuery,
  useGetBrandsQuery,
  useSetReorderLevelMutation,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import { InventoryBalance, StockStatus } from '@/types';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  Boxes,
  Search,
  AlertTriangle,
  History,
  ArrowDownToLine,
  ArrowLeftRight,
  SlidersHorizontal,
  Settings2,
  Eye,
  X,
  RefreshCw,
} from 'lucide-react';

export default function StockBalancesPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);

  const { data: brands = [] } = useGetBrandsQuery();
  const { data: stockLocations = [] } = useGetStockLocationsQuery();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const defaultBranchId = isSuperAdmin ? 'all' : (currentUser?.assignedBranchId || 'all');

  // Filter States
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState(defaultBranchId);
  const [locationFilter, setLocationFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy] = useState<'sku' | 'productName' | 'onHand' | 'available' | 'brand'>('productName');
  const [sortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<InventoryBalance | null>(null);
  const [reorderModalItem, setReorderModalItem] = useState<InventoryBalance | null>(null);
  const [newReorderLevel, setNewReorderLevel] = useState<number>(5);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Mutations
  const [setReorderLevelMutation, { isLoading: isSettingReorder }] = useSetReorderLevelMutation();

  const {
    data: balances = [],
    isLoading,
  } = useGetInventoryBalancesQuery({
    branchId: branchFilter === 'all' ? undefined : branchFilter,
    stockLocationId: locationFilter === 'all' ? undefined : locationFilter,
    search: search.trim() || undefined,
    stockStatus: statusFilter === 'all' ? undefined : statusFilter,
    lowStockOnly: lowStockOnly || undefined,
    sortBy,
    sortOrder,
  });

  // Client-side additional filtering for Brand and Category
  const filteredBalances = useMemo(() => {
    return balances.filter((b) => {
      if (brandFilter !== 'all' && b.brandName !== brandFilter) return false;
      if (categoryFilter !== 'all' && b.categoryName !== categoryFilter) return false;
      return true;
    });
  }, [balances, brandFilter, categoryFilter]);

  // Handle Set Reorder Level
  const handleSaveReorderLevel = async () => {
    if (!reorderModalItem) return;
    try {
      await setReorderLevelMutation({
        stockLocationId: reorderModalItem.stockLocationId,
        sku: reorderModalItem.sku,
        reorderLevel: newReorderLevel,
      }).unwrap();

      setToast({
        id: 'reorder-success',
        type: 'success',
        title: 'Reorder Level Updated',
        message: `Reorder threshold for ${reorderModalItem.sku} set to ${newReorderLevel} units.`,
      });
      setReorderModalItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to update reorder level';
      setToast({
        id: 'reorder-error',
        type: 'error',
        title: 'Update Failed',
        message: msg,
      });
    }
  };

  return (
    <AppLayout title="Stock Balances" subtitle="Real-time multi-branch SKU stock ledger">
      <InventoryNavTabs branchId={branchFilter === 'all' ? undefined : branchFilter} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Stock Balances & Availability
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Formula: <span className="font-semibold text-gray-700">Available Stock = On Hand − Reserved</span>. Showing active inventory across shops.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/inventory/receiving"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-medium rounded-lg shadow-2xs transition-colors"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Receive Stock</span>
            </Link>
            <Link
              href="/inventory/transfers"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-2xs transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Transfer Stock</span>
            </Link>
            <Link
              href="/inventory/adjustments"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-medium rounded-lg shadow-2xs transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
              <span>Adjustment</span>
            </Link>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search SKU, mattress name, size..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-gray-900"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Branch Filter */}
            <div>
              <select
                aria-label="Filter by branch"
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setLocationFilter('all');
                }}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue text-gray-900"
              >
                {isSuperAdmin && <option value="all">All Branches</option>}
                {authorizedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Location Filter */}
            <div>
              <select
                aria-label="Filter by stock location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue text-gray-900"
              >
                <option value="all">All Locations</option>
                {stockLocations
                  .filter((l) => branchFilter === 'all' || l.branchId === branchFilter)
                  .map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <select
                aria-label="Filter by brand"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue text-gray-900"
              >
                <option value="all">All Brands</option>
                {brands.map((br) => (
                  <option key={br.id} value={br.name}>
                    {br.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Status Filter */}
            <div>
              <select
                aria-label="Filter by stock status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | StockStatus)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue text-gray-900"
              >
                <option value="all">All Statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Quick Toggle Tags */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="rounded-sm text-brand-blue focus:ring-brand-blue/30 w-4 h-4 border-gray-300"
                />
                <span className="flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Show Low Stock / Reorder Needed Only
                </span>
              </label>

              {(search || brandFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || lowStockOnly) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setBrandFilter('all');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setLowStockOnly(false);
                  }}
                  className="text-xs text-brand-blue hover:underline font-semibold"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="text-gray-500">
              Showing <span className="font-bold text-gray-900">{filteredBalances.length}</span> SKU balance records
            </div>
          </div>
        </div>

        {/* Stock Balances Table */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">SKU / Barcode</th>
                  <th className="py-3 px-4">Product & Specification</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Stock Location</th>
                  <th className="py-3 px-3 text-center">On Hand</th>
                  <th className="py-3 px-3 text-center">Reserved</th>
                  <th className="py-3 px-3 text-center">Available</th>
                  <th className="py-3 px-3 text-center">Reorder Lvl</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-gray-500 text-sm">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-blue" />
                      Loading inventory balances...
                    </td>
                  </tr>
                ) : filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-gray-500 text-sm">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No inventory balances found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((item) => {
                    const location = stockLocations.find((l) => l.id === item.stockLocationId);
                    const isDamaged = location?.type === 'RETURNS_DAMAGED';

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        {/* SKU */}
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-gray-900 text-xs">{item.sku}</p>
                          <span className="text-[11px] text-gray-400">ID: {item.id.slice(0, 10)}</span>
                        </td>

                        {/* Product & Spec */}
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-900 text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">
                            Size: <span className="font-medium text-gray-700">{item.sizeLabel}</span> • Thickness: <span className="font-medium text-gray-700">{item.thicknessInches}&quot;</span>
                          </p>
                        </td>

                        {/* Brand & Category */}
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                            {item.brandName}
                          </span>
                          <p className="text-[11px] text-gray-500 mt-0.5">{item.categoryName}</p>
                        </td>

                        {/* Stock Location */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isDamaged ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            />
                            <span className="text-xs font-medium text-gray-800">
                              {location?.name || item.stockLocationId}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400 block ml-3.5">
                            {location?.code}
                          </span>
                        </td>

                        {/* On Hand */}
                        <td className="py-3 px-3 text-center font-bold text-gray-900 text-sm">
                          {item.onHand}
                        </td>

                        {/* Reserved */}
                        <td className="py-3 px-3 text-center text-gray-500 text-xs font-medium">
                          {item.reserved}
                        </td>

                        {/* Available = onHand - reserved */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              item.available <= 0
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : item.available <= item.reorderLevel
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {item.available}
                          </span>
                        </td>

                        {/* Reorder Level */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => {
                              setReorderModalItem(item);
                              setNewReorderLevel(item.reorderLevel);
                            }}
                            title="Click to change reorder threshold"
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-brand-blue font-medium px-2 py-0.5 rounded hover:bg-gray-100"
                          >
                            <span>{item.reorderLevel}</span>
                            <Settings2 className="w-3 h-3 text-gray-400" />
                          </button>
                        </td>

                        {/* Stock Status Badge */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full ${
                              item.stockStatus === 'IN_STOCK'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.stockStatus === 'LOW_STOCK'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.stockStatus.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View details */}
                            <button
                              onClick={() => setSelectedItemForDetails(item)}
                              title="View Stock Details"
                              className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* View movements */}
                            <Link
                              href={`/inventory/movements?sku=${encodeURIComponent(item.sku)}`}
                              title="View Movement History"
                              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </Link>

                            {/* Transfer stock */}
                            <Link
                              href={`/inventory/transfers?sku=${encodeURIComponent(item.sku)}&sourceLocationId=${item.stockLocationId}`}
                              title="Transfer Stock"
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <ArrowLeftRight className="w-4 h-4" />
                            </Link>

                            {/* Adjust stock */}
                            <Link
                              href={`/inventory/adjustments?sku=${encodeURIComponent(item.sku)}&locationId=${item.stockLocationId}`}
                              title="Adjust Stock"
                              className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <SlidersHorizontal className="w-4 h-4" />
                            </Link>
                          </div>
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

      {/* Stock Details Modal */}
      {selectedItemForDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-brand-blue" />
                <h3 className="font-bold text-gray-900 text-base">SKU Inventory Specification</h3>
              </div>
              <button
                onClick={() => setSelectedItemForDetails(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60">
                <p className="font-mono text-xs font-bold text-brand-blue">{selectedItemForDetails.sku}</p>
                <h4 className="text-base font-bold text-gray-900 mt-1">{selectedItemForDetails.productName}</h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  Brand: {selectedItemForDetails.brandName} • Category: {selectedItemForDetails.categoryName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-gray-500 block">Dimensions & Thickness</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {selectedItemForDetails.sizeLabel} ({selectedItemForDetails.thicknessInches}&quot;)
                  </span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-gray-500 block">Current Location</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {stockLocations.find((l) => l.id === selectedItemForDetails.stockLocationId)?.name}
                  </span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-gray-500 block">On Hand Quantity</span>
                  <span className="font-bold text-gray-900 text-base">{selectedItemForDetails.onHand} units</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-gray-500 block">Available for Dispatch</span>
                  <span className="font-bold text-emerald-600 text-base">
                    {selectedItemForDetails.available} units
                  </span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-gray-500 block">Reorder Alert Threshold</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {selectedItemForDetails.reorderLevel} units
                  </span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-gray-500 block">Recorded Unit Cost</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {selectedItemForDetails.unitCost
                      ? `PKR ${selectedItemForDetails.unitCost.toLocaleString()}`
                      : 'Unavailable (Not recorded)'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center text-xs text-gray-500 border-t border-gray-100">
                <span>Last updated: {new Date(selectedItemForDetails.updatedAt).toLocaleDateString()}</span>
                <Link
                  href={`/inventory/movements?sku=${encodeURIComponent(selectedItemForDetails.sku)}`}
                  className="font-semibold text-brand-blue hover:underline"
                >
                  View complete movement ledger &rarr;
                </Link>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedItemForDetails(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Reorder Level Modal */}
      {reorderModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-brand-blue" />
                <h3 className="font-bold text-gray-900 text-base">Set Reorder Threshold</h3>
              </div>
              <button onClick={() => setReorderModalItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              When physical stock for <span className="font-mono font-bold text-gray-900">{reorderModalItem.sku}</span> drops to or below this level, the ERP will flag a Low Stock replenishment alert.
            </p>

            <div>
              <label htmlFor="reorder-threshold-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Reorder Threshold (Units)
              </label>
              <input
                id="reorder-threshold-input"
                type="number"
                min="0"
                value={newReorderLevel}
                onChange={(e) => setNewReorderLevel(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReorderModalItem(null)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReorderLevel}
                disabled={isSettingReorder}
                className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {isSettingReorder ? 'Saving...' : 'Save Threshold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
