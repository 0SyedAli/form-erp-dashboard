'use client';

import React, { useState, useMemo, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector } from '@/store';
import {
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetInventoryBalancesQuery,
  useGetVariantsQuery,
  useGetSuppliersQuery,
} from '@/store/services/apiSlice';
import {
  inventoryRepository,
} from '@/lib/demo-db';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  ArrowLeft,
  Calendar,
  Building2,
  Warehouse,
  Truck,
  Search,
  Plus,
  Trash2,
  Save,
  X,
  Package,
} from 'lucide-react';

interface StockRowItem {
  id: string; // variantId
  sku: string;
  name: string;
  sizeLabel: string;
  thicknessLabel: string;
  currentStock: number;
  newStock: number;
  minStock: number;
  selected: boolean;
}

function ManageStockContent() {
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  // Queries
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: stockLocations = [] } = useGetStockLocationsQuery();
  const { data: variants = [] } = useGetVariantsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();

  // Branch Selection (Fixed for branch logins, selectable for Super Admin)
  const [selectedBranchIdOverride, setSelectedBranchId] = useState<string>('');

  const selectedBranchId = useMemo(() => {
    if (selectedBranchIdOverride) return selectedBranchIdOverride;
    if (currentUser?.assignedBranchId) return currentUser.assignedBranchId;
    return branches.length > 0 ? branches[0].id : '';
  }, [selectedBranchIdOverride, currentUser, branches]);

  // Target Stockroom for the branch
  const branchLocations = useMemo(() => {
    if (!selectedBranchId) return [];
    return stockLocations.filter((l) => l.branchId === selectedBranchId && l.type !== 'RETURNS_DAMAGED');
  }, [stockLocations, selectedBranchId]);

  const [selectedStockLocationIdOverride, setSelectedStockLocationId] = useState<string>('');

  const selectedStockLocationId = useMemo(() => {
    if (
      selectedStockLocationIdOverride &&
      branchLocations.some((l) => l.id === selectedStockLocationIdOverride)
    ) {
      return selectedStockLocationIdOverride;
    }
    return branchLocations.length > 0 ? branchLocations[0].id : '';
  }, [branchLocations, selectedStockLocationIdOverride]);

  // Query balances for selected location
  const { data: balances = [], refetch: refetchBalances } = useGetInventoryBalancesQuery(
    selectedStockLocationId ? { stockLocationId: selectedStockLocationId } : undefined
  );

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('2025-10-23');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Table items state
  const [customStockRows, setCustomStockRows] = useState<StockRowItem[] | null>(null);

  const defaultStockRows = useMemo(() => {
    if (variants.length === 0) return [];
    const balanceMap = new Map(balances.map((b) => [b.sku.toUpperCase(), b]));

    return variants.slice(0, 8).map((v) => {
      const bal = balanceMap.get(v.sku.toUpperCase());
      const onHand = bal ? bal.onHand : 15;
      const reorder = bal ? bal.reorderLevel : 5;
      const skuParts = v.sku.split('-');
      const thickNum = skuParts.length > 3 ? skuParts[3] : '5';

      return {
        id: v.id,
        sku: v.sku,
        name: v.productName || 'Molty Foam - Ultra Luxury',
        sizeLabel: v.sizeLabel || '78 x 78',
        thicknessLabel: `${thickNum} inch`,
        currentStock: onHand,
        newStock: onHand,
        minStock: reorder,
        selected: false,
      };
    });
  }, [variants, balances]);

  const stockRows = customStockRows ?? defaultStockRows;
  const setStockRows = (updater: React.SetStateAction<StockRowItem[]>) => {
    setCustomStockRows((prev) => {
      const current = prev ?? defaultStockRows;
      if (typeof updater === 'function') {
        return updater(current);
      }
      return updater;
    });
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalSearch, setAddModalSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Handle stock changes in table
  const handleStockChange = (sku: string, value: number) => {
    setStockRows((prev) =>
      prev.map((row) => (row.sku === sku ? { ...row, newStock: Math.max(0, value) } : row))
    );
  };

  const handleMinStockChange = (sku: string, value: number) => {
    setStockRows((prev) =>
      prev.map((row) => (row.sku === sku ? { ...row, minStock: Math.max(0, value) } : row))
    );
  };

  const handleDeleteRow = (sku: string) => {
    setStockRows((prev) => prev.filter((row) => row.sku !== sku));
  };

  const toggleSelectRow = (sku: string) => {
    setStockRows((prev) =>
      prev.map((row) => (row.sku === sku ? { ...row, selected: !row.selected } : row))
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setStockRows((prev) => prev.map((row) => ({ ...row, selected: checked })));
  };

  const isAllSelected = stockRows.length > 0 && stockRows.every((r) => r.selected);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return stockRows;
    const q = searchFilter.toLowerCase();
    return stockRows.filter(
      (r) =>
        r.sku.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.sizeLabel.toLowerCase().includes(q)
    );
  }, [stockRows, searchFilter]);

  const toastCounter = useRef(0);
  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message?: string) => {
    toastCounter.current += 1;
    setToast({
      id: `toast-${toastCounter.current}`,
      type,
      title,
      message,
    });
  }, []);

  // Save Stock Adjustments and Reorder Levels
  const handleSaveStock = async () => {
    if (!selectedStockLocationId) {
      showToast('error', 'Location Required', 'Please select a valid target stockroom.');
      return;
    }

    setIsSaving(true);
    try {
      let adjustmentCount = 0;
      const userName = currentUser?.name || 'Store Manager';

      for (const row of stockRows) {
        const diff = row.newStock - row.currentStock;
        if (diff !== 0) {
          inventoryRepository.adjustStock({
            stockLocationId: selectedStockLocationId,
            sku: row.sku,
            branchId: selectedBranchId,
            quantityDifference: diff,
            adjustmentType: 'PHYSICAL_CORRECTION',
            reason: 'PHYSICAL_AUDIT',
            notes: `Physical reconciliation count on ${deliveryDate}`,
            authorizedBy: userName,
          });
          adjustmentCount++;
        }

        // Update reorder level / minimum stock
        inventoryRepository.setReorderLevel(selectedStockLocationId, row.sku, row.minStock);
      }

      await refetchBalances();

      // Update currentStock in table state to match newStock
      setStockRows((prev) =>
        prev.map((r) => ({ ...r, currentStock: r.newStock }))
      );

      showToast(
        'success',
        'Stock Updated Successfully',
        `Reconciled ${stockRows.length} products (${adjustmentCount} quantity adjustments recorded).`
      );
    } catch (err: unknown) {
      showToast('error', 'Error Saving Stock', (err as Error)?.message || 'Could not update stock.');
    } finally {
      setIsSaving(false);
    }
  };

  // Add Variant from Modal
  const handleAddVariantToTable = (v: (typeof variants)[0]) => {
    if (stockRows.some((r) => r.sku.toUpperCase() === v.sku.toUpperCase())) {
      showToast('info', 'Already in Table', `SKU ${v.sku} is already in the list.`);
      return;
    }

    const bal = balances.find((b) => b.sku.toUpperCase() === v.sku.toUpperCase());
    const onHand = bal ? bal.onHand : 0;
    const reorder = bal ? bal.reorderLevel : 5;
    const skuParts = v.sku.split('-');
    const thickNum = skuParts.length > 3 ? skuParts[3] : '5';

    const newRow: StockRowItem = {
      id: v.id,
      sku: v.sku,
      name: v.productName || 'Molty Foam - Ultra Luxury',
      sizeLabel: v.sizeLabel || '78 x 78',
      thicknessLabel: `${thickNum} inch`,
      currentStock: onHand,
      newStock: onHand,
      minStock: reorder,
      selected: false,
    };

    setStockRows((prev) => [newRow, ...prev]);
    setIsAddModalOpen(false);
    showToast('success', 'Product Added', `${v.sku} added to stock table.`);
  };

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <AppLayout>
      <div className="space-y-5 font-sans pb-10">
        {/* Header matching Screenshot 3 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/inventory"
              className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-600 transition-colors cursor-pointer"
              title="Back to Inventory"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Manage Stock
              </h1>
              <p className="text-xs text-gray-500 font-normal">
                Update stock for your products
              </p>
            </div>
          </div>

          {/* Today Date Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-brand-blue" />
              <span>Today</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-800">Oct 23, 2025</span>
              <span className="text-gray-400 text-[10px]">▼</span>
            </div>
          </div>
        </div>

        {/* Stock Details Card matching Screenshot 3 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">
            Stock Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Destination Branch */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Destination Branch <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Building2 className="w-4 h-4" />
                </div>
                {currentUser?.role === 'SUPER_ADMIN' ? (
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer appearance-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800">
                    {selectedBranch?.name || 'Main Branch'}
                  </div>
                )}
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">
                    ▼
                  </div>
                )}
              </div>
            </div>

            {/* Target Stockroom */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Target Stockroom <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Warehouse className="w-4 h-4" />
                </div>
                <select
                  value={selectedStockLocationId}
                  onChange={(e) => setSelectedStockLocationId(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer appearance-none"
                >
                  {branchLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            {/* Supplier (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Supplier (Optional)
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Truck className="w-4 h-4" />
                </div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer appearance-none"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            {/* Delivery (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Delivery (Optional)
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Products Card & Table matching Screenshot 3 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-4">
          {/* Header Row: Products Title + Search + Add Product */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">
              Products
            </h2>

            <div className="flex items-center gap-3">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by SKU or product name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-600">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        className="rounded text-brand-blue cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">Product Sku</th>
                    <th className="py-3 px-4">Specification</th>
                    <th className="py-3 px-3 w-40">Stock*</th>
                    <th className="py-3 px-3 w-40">Minimum Stock *</th>
                    <th className="py-3 px-3 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => (
                      <tr key={row.sku} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => toggleSelectRow(row.sku)}
                            className="rounded text-brand-blue cursor-pointer"
                          />
                        </td>

                        {/* Product SKU Box */}
                        <td className="py-3 px-3 font-mono font-bold text-gray-800">
                          <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-semibold text-gray-800 inline-block">
                            {row.sku}
                          </div>
                        </td>

                        {/* Specification with Mattress Graphic */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-8 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center justify-center shrink-0">
                              <svg viewBox="0 0 40 24" fill="none" className="w-6 h-4 text-brand-blue">
                                <rect x="3" y="6" width="34" height="12" rx="3" fill="#EBF3FE" stroke="#3B82F6" strokeWidth="1.5" />
                                <circle cx="12" cy="12" r="1" fill="#3B82F6" />
                                <circle cx="20" cy="12" r="1" fill="#3B82F6" />
                                <circle cx="28" cy="12" r="1" fill="#3B82F6" />
                              </svg>
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 text-xs">
                                {row.name}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                Size: {row.sizeLabel} | Thickness: {row.thicknessLabel}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Stock* (New Physical Count) */}
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min="0"
                            value={row.newStock}
                            onChange={(e) => handleStockChange(row.sku, Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue"
                          />
                        </td>

                        {/* Minimum Stock* */}
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min="0"
                            value={row.minStock}
                            onChange={(e) => handleMinStockChange(row.sku, Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue"
                          />
                        </td>

                        {/* Trash Action */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.sku)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove from count"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500 text-xs">
                        No products in the current stock list. Click &quot;+ Add Product&quot; to add SKUs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Action Buttons matching Screenshot 3 */}
          <div className="pt-3 flex items-center justify-between gap-3">
            <Link
              href="/inventory"
              className="px-5 py-2.5 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </Link>

            <button
              type="button"
              onClick={handleSaveStock}
              disabled={isSaving || stockRows.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Stock...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Stock</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add Product Selector Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-blue" />
                <h3 className="font-bold text-gray-900 text-sm">Add Product to Stock Count</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search catalogue by SKU or model..."
                value={addModalSearch}
                onChange={(e) => setAddModalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-blue"
              />
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
              {variants
                .filter(
                  (v) =>
                    !addModalSearch ||
                    v.sku.toLowerCase().includes(addModalSearch.toLowerCase()) ||
                    (v.productName && v.productName.toLowerCase().includes(addModalSearch.toLowerCase()))
                )
                .slice(0, 15)
                .map((v) => (
                  <div
                    key={v.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleAddVariantToTable(v)}
                  >
                    <div>
                      <div className="font-bold text-gray-900 text-xs">{v.sku}</div>
                      <div className="text-[11px] text-gray-500">
                        {v.productName || 'Mattress'} | {v.sizeLabel || 'Standard'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-blue-50 text-brand-blue hover:bg-blue-100 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
}

export default function ManageStockPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Loading Stock Manager...</div>}>
      <ManageStockContent />
    </Suspense>
  );
}
