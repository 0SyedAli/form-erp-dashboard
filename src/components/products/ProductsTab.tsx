'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProductVariant } from '@/types';
import {
  useGetVariantsQuery,
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetSizesQuery,
  useGetThicknessQuery,
  useGetInventoryBalancesQuery,
  useToggleVariantStatusMutation,
} from '@/store/services/apiSlice';
import {
  Search,
  Plus,
  Edit2,
  Power,
  RotateCcw,
  Package,
} from 'lucide-react';

interface ProductsTabProps {
  canManage: boolean;
  canManagePricing: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserEmail?: string;
}

export default function ProductsTab({
  canManage,
  onToast,
}: ProductsTabProps) {
  const { data: variants = [], isLoading } = useGetVariantsQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: sizes = [] } = useGetSizesQuery();
  const { data: thicknesses = [] } = useGetThicknessQuery();
  const { data: balances = [] } = useGetInventoryBalancesQuery();
  const [toggleStatus] = useToggleVariantStatusMutation();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Fast lookups
  const sizeMap = useMemo(() => new Map(sizes.map((s) => [s.id, s.displayLabel || s.name || '78 × 78'])), [sizes]);
  const thicknessMap = useMemo(
    () => new Map(thicknesses.map((t) => [t.id, t.displayLabel || `${t.value} inch`])),
    [thicknesses]
  );
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    balances.forEach((b) => {
      const current = map.get(b.sku.toUpperCase()) || 0;
      map.set(b.sku.toUpperCase(), current + b.onHand);
    });
    return map;
  }, [balances]);

  // Categories available based on brand filter
  const availableCategories = useMemo(() => {
    if (brandFilter === 'all') return categories;
    return categories.filter((c) => c.brandId === brandFilter);
  }, [categories, brandFilter]);

  // Filtered variants list (each row is a simple concrete product)
  const filteredItems = useMemo(() => {
    return variants.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const brand = brands.find((b) => b.name === item.brandName);
      const cat = categories.find((c) => c.name === item.categoryName);

      const matchesSearch =
        !q ||
        item.sku.toLowerCase().includes(q) ||
        (item.productName && item.productName.toLowerCase().includes(q)) ||
        (item.brandName && item.brandName.toLowerCase().includes(q)) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
        (item.sizeLabel && item.sizeLabel.toLowerCase().includes(q));

      const matchesBrand =
        brandFilter === 'all' || (brand && brand.id === brandFilter) || (item.brandName && item.brandName.toLowerCase().includes(brandFilter.toLowerCase()));

      const matchesCategory =
        categoryFilter === 'all' || (cat && cat.id === categoryFilter) || (item.categoryName && item.categoryName.toLowerCase().includes(categoryFilter.toLowerCase()));

      const isItemActive = item.status === 'active' || item.status === 'ACTIVE';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isItemActive) ||
        (statusFilter === 'inactive' && !isItemActive);

      return matchesSearch && matchesBrand && matchesCategory && matchesStatus;
    });
  }, [variants, searchQuery, brandFilter, categoryFilter, statusFilter, brands, categories]);

  const handleToggleStatus = async (item: ProductVariant) => {
    const isCurrentlyActive = item.status === 'active' || item.status === 'ACTIVE';
    const nextStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    try {
      await toggleStatus({ id: item.id, status: nextStatus }).unwrap();
      onToast(`Product ${item.sku} is now ${nextStatus.toLowerCase()}.`, 'success');
    } catch {
      onToast('Could not update status.', 'error');
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Filter and Actions Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, SKU or size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:bg-white"
            />
          </div>

          <select
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setCategoryFilter('all');
            }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(searchQuery ||
            brandFilter !== 'all' ||
            categoryFilter !== 'all' ||
            statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setBrandFilter('all');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Global Add Product Button */}
        {canManage && (
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/products/new"
              className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </Link>
          </div>
        )}
      </div>

      {/* Simplified Products Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-600">
                <th className="py-3.5 px-3 text-center w-12">#</th>
                <th className="py-3.5 px-4">Product Details</th>
                <th className="py-3.5 px-4">Specification</th>
                <th className="py-3.5 px-3">Brand & Category</th>
                <th className="py-3.5 px-3 text-right">Retail Price</th>
                <th className="py-3.5 px-3 text-right">Wholesale</th>
                <th className="py-3.5 px-3 text-center">Stock</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    Loading products...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-600 font-semibold text-xs">No products found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {searchQuery || brandFilter !== 'all'
                        ? 'Try clearing search filters'
                        : 'Click "+ Add Product" to add your first product'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const onHandStock = balanceMap.get(item.sku.toUpperCase()) ?? 15;
                  const isActive = item.status === 'active' || item.status === 'ACTIVE';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Index */}
                      <td className="py-3.5 px-3 text-center text-gray-400 font-mono">
                        {idx + 1}
                      </td>

                      {/* Product Details (Thumbnail + Title + SKU) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-8 rounded-lg bg-blue-50/80 border border-blue-100 flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 40 24" fill="none" className="w-6 h-4 text-brand-blue">
                              <rect x="3" y="6" width="34" height="12" rx="3" fill="#EBF3FE" stroke="#3B82F6" strokeWidth="1.5" />
                              <circle cx="12" cy="12" r="1" fill="#3B82F6" />
                              <circle cx="20" cy="12" r="1" fill="#3B82F6" />
                              <circle cx="28" cy="12" r="1" fill="#3B82F6" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-xs">
                              {item.productName || `${item.brandName || 'Brand'} - ${item.categoryName || 'Mattress'}`}
                            </div>
                            <div className="mt-0.5">
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                                {item.sku}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Specification */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-gray-800">
                          {item.sizeLabel || sizeMap.get(item.sizeId) || '78 × 78'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Thickness: {thicknessMap.get(item.thicknessId) || '5 inch'}
                        </div>
                      </td>

                      {/* Brand & Category */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-brand-blue text-[10px] font-bold border border-blue-100">
                            {item.brandName || 'Molty Foam'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-100">
                            {item.categoryName || 'Mattress'}
                          </span>
                        </div>
                      </td>

                      {/* Retail Price */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-gray-900">
                        Rs {item.retailPrice.toLocaleString()}
                      </td>

                      {/* Wholesale Price */}
                      <td className="py-3.5 px-3 text-right font-mono text-gray-700 font-semibold">
                        Rs {item.wholesalePrice.toLocaleString()}
                      </td>

                      {/* Available Stock */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            onHandStock <= 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : onHandStock <= 5
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {onHandStock}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500">
                          {canManage && (
                            <>
                              <Link
                                href={`/products/new?edit=${encodeURIComponent(item.sku)}`}
                                className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Product using simplified flow"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isActive
                                    ? 'hover:text-amber-600 hover:bg-amber-50'
                                    : 'hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={isActive ? 'Deactivate Product' : 'Activate Product'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
          <span>
            Showing <strong className="text-gray-800">{filteredItems.length}</strong> of{' '}
            <strong className="text-gray-800">{variants.length}</strong> products
          </span>
          <span className="text-[11px] text-gray-400">
            Click &quot;Edit&quot; to modify specifications or prices
          </span>
        </div>
      </div>
    </div>
  );
}
