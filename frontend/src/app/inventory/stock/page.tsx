'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector, RootState } from '@/store';
import { useGetSkusQuery, useGetBrandsQuery } from '@/store/services/catalogueApi';
import { Pagination } from '@/components/common/Pagination';
import {
  Boxes,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  X,
  Package,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function StockBalancesPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const activeBranchId = currentUser?.assignedBranchId;

  const { data: brands = [] } = useGetBrandsQuery();

  // Filter States
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Google-Style Autocomplete Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Pagination state (default 10 items for high performance)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // 250ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, brandFilter, stockStatusFilter]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Server-Side Dynamic Query with full multi-dimensional catalogue search
  const {
    data: skusResponse,
    isLoading,
    isFetching,
  } = useGetSkusQuery({
    page: currentPage,
    limit: pageSize,
    search: debouncedSearch.trim() || undefined,
    brandId: brandFilter !== 'all' ? brandFilter : undefined,
    stockStatus:
      stockStatusFilter === 'in_stock'
        ? 'IN_STOCK'
        : stockStatusFilter === 'out_of_stock'
          ? 'OUT_OF_STOCK'
          : stockStatusFilter === 'low_stock'
            ? 'LOW_STOCK'
            : undefined,
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
  });

  const rawBalances = useMemo(() => {
    if (Array.isArray(skusResponse?.data)) return skusResponse.data;
    if (Array.isArray((skusResponse as any)?.items)) return (skusResponse as any).items;
    return [];
  }, [skusResponse]);

  const totalItems = skusResponse?.pagination?.total ?? rawBalances.length;

  // Normalized balance records for high-speed client rendering
  const normalizedBalances = useMemo(() => {
    return rawBalances.map((item: any) => {
      const productName =
        item.productName ||
        item.product?.name ||
        item.productId?.name ||
        item.sku;
      const posDisplayName =
        item.posDisplayName ||
        item.productId?.posDisplayName ||
        '';
      const brandName =
        item.brand?.name ||
        item.brandName ||
        item.productId?.brandId?.name ||
        'MoltyFoam';
      const sizeLabel =
        item.size?.displayLabel ||
        item.sizeLabel ||
        (item.size?.length && item.size?.width ? `${item.size.length} × ${item.size.width}` : 'Standard');
      const thicknessLabel =
        item.thickness?.displayLabel ||
        item.thicknessLabel ||
        (item.thickness?.value ? `${item.thickness.value}"` : '');

      const onHand = Number(item.onHand ?? item.stock ?? 0);
      const reserved = Number(item.reserved ?? 0);
      const available = item.available !== undefined ? Number(item.available) : Math.max(0, onHand - reserved);
      const reorderLevel = Number(item.reorderLevel ?? item.minimumStock ?? 1);

      let statusKey: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (available <= 0) {
        statusKey = 'out_of_stock';
      } else if (available <= reorderLevel) {
        statusKey = 'low_stock';
      }

      return {
        ...item,
        productName,
        posDisplayName,
        brandName,
        sizeLabel,
        thicknessLabel,
        onHand,
        reserved,
        available,
        reorderLevel,
        statusKey,
      };
    });
  }, [rawBalances]);

  // Google-Style Search Suggestions (Top 8 matching items from live data)
  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return normalizedBalances.slice(0, 8);
  }, [normalizedBalances, search]);

  const handleSelectSuggestion = (item: any) => {
    setSearch(item.sku);
    setDebouncedSearch(item.sku);
    setIsDropdownOpen(false);
  };

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    setIsDropdownOpen(false);
  };

  return (
    <AppLayout title="Stock Balances" subtitle="Live store inventory balances and availability">
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Stock Balances
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live stock in hand. Formula:{' '}
              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                Available = On Hand − Reserved
              </span>
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

        {/* Google-Style Instant Search Box with Auto-Suggest Dropdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div ref={searchContainerRef} className="relative w-full">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products by Name, SKU, Brand, or Size (e.g. Comm, 78x42, Molty)..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => {
                  if (search.trim()) setIsDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsDropdownOpen(false);
                  } else if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  }
                }}
                className="w-full pl-12 pr-12 py-3.5 text-sm sm:text-base bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
              />
              {isFetching && (
                <div className="absolute right-11 pointer-events-none">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-blue" />
                </div>
              )}
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Google-Style Dropdown Suggestions List */}
            {isDropdownOpen && search.trim() && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden transition-all animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500 font-semibold px-4">
                  <span>Matching Products ({searchSuggestions.length})</span>
                  <span className="text-[11px] text-slate-400">Click to select or press Enter</span>
                </div>
                {searchSuggestions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    <Package className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                    No products matching &quot;<strong className="text-slate-800">{search}</strong>&quot;
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {searchSuggestions.map((item: any) => (
                      <li key={item._id || item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full text-left p-3.5 px-4 hover:bg-blue-50/60 transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-brand-blue flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-blue">
                                {item.productName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                <span className="font-mono text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {item.sku}
                                </span>
                                <span>•</span>
                                <span>{item.sizeLabel}</span>
                                {item.thicknessLabel && (
                                  <>
                                    <span>•</span>
                                    <span>{item.thicknessLabel}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                item.statusKey === 'out_of_stock'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : item.statusKey === 'low_stock'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {item.available} in stock
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-blue transition-colors" />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Quick Filters Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" />
                Filter:
              </span>

              {/* Status Pills */}
              <button
                type="button"
                onClick={() => setStockStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                All Stock
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('in_stock')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                }`}
              >
                In Stock
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('low_stock')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'low_stock'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                }`}
              >
                Low Stock
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                }`}
              >
                Out of Stock
              </button>

              {/* Brand Filter */}
              <select
                aria-label="Filter by brand"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-brand-blue"
              >
                <option value="all">All Brands</option>
                {brands.map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              {(search || brandFilter !== 'all' || stockStatusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    handleClearSearch();
                    setBrandFilter('all');
                    setStockStatusFilter('all');
                  }}
                  className="text-xs text-brand-blue hover:underline font-semibold"
                >
                  Clear Filters
                </button>
              )}
              <span className="text-slate-500 font-medium">
                Found <strong className="text-slate-900">{totalItems}</strong> items
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
                ) : normalizedBalances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No stock items found matching current filters.
                    </td>
                  </tr>
                ) : (
                  normalizedBalances.map((item: any) => {
                    return (
                      <tr key={item._id || item.id} className="hover:bg-blue-50/20 transition-colors">
                        {/* SKU */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 text-xs">
                          {item.sku}
                        </td>

                        {/* Product & Spec */}
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900 text-sm">{item.productName}</p>
                          {item.posDisplayName && (
                            <p className="text-xs text-brand-blue font-medium">{item.posDisplayName}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-0.5">
                            Size: <span className="text-slate-700 font-medium">{item.sizeLabel}</span>
                            {item.thicknessLabel ? ` • Thickness: ${item.thicknessLabel}` : ''}
                          </p>
                        </td>

                        {/* Brand */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                            {item.brandName}
                          </span>
                        </td>

                        {/* On Hand */}
                        <td className="py-3.5 px-3 text-center font-bold text-slate-900 text-sm">
                          {item.onHand}
                        </td>

                        {/* Reserved */}
                        <td className="py-3.5 px-3 text-center text-slate-500 text-xs font-medium">
                          {item.reserved}
                        </td>

                        {/* Available */}
                        <td className="py-3.5 px-3 text-center font-bold">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              item.statusKey === 'out_of_stock'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : item.statusKey === 'low_stock'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {item.available}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center">
                          {item.statusKey === 'out_of_stock' ? (
                            <span className="text-xs font-semibold text-rose-600">Out of Stock</span>
                          ) : item.statusKey === 'low_stock' ? (
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

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemName="items"
          />

          {totalItems > 0 && (
            <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
              <span>
                Showing <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="text-slate-800">{Math.min(totalItems, currentPage * pageSize)}</strong> of{' '}
                <strong className="text-slate-800">{totalItems}</strong> items
              </span>
              <span className="text-[11px] text-slate-400">
                Click &quot;Add Stock&quot; to receive more units for a SKU
              </span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
