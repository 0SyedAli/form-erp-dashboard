'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Pagination } from '@/components/common/Pagination';
import { ProductVariant } from '@/types';
import { useAppSelector, RootState } from '@/store';
import {
  useGetVariantsQuery,
  useGetBrandsQuery as useGetDemoBrandsQuery,
  useGetCategoriesQuery as useGetDemoCategoriesQuery,
  useToggleVariantStatusMutation,
  useGetBranchesQuery,
} from '@/store/services/apiSlice';
import {
  useGetSkusQuery as useGetBackendSkusQuery,
  useGetBrandsQuery as useGetBackendBrandsQuery,
  useGetCategoriesQuery as useGetBackendCategoriesQuery,
  useGetProductLinesQuery as useGetBackendProductLinesQuery,
  useToggleSkuStatusMutation,
} from '@/store/services/catalogueApi';
import { rankSearchResults } from '@/utils/searchRanker';
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
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const assignedBranchId = currentUser?.assignedBranchId;

  // Branch filter
  const [branchFilter, setBranchFilter] = useState<string>(!isSuperAdmin && assignedBranchId ? assignedBranchId : 'all');
  const effectiveBranchId = !isSuperAdmin ? assignedBranchId : (branchFilter !== 'all' ? branchFilter : undefined);

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [productLineFilter, setProductLineFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  // Server-side Pagination state (Default 10 items for high-performance instant loading)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // 350ms Debounce on Search Query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 whenever any search or filter criteria change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, brandFilter, categoryFilter, productLineFilter, statusFilter, stockFilter, branchFilter]);

  const isBackendMode = process.env.NEXT_PUBLIC_DATA_MODE === 'backend';

  const { data: branches = [] } = useGetBranchesQuery(undefined, { skip: !isSuperAdmin });
  const { data: demoVariants = [], isLoading: isDemoLoading } = useGetVariantsQuery(undefined, { skip: isBackendMode });

  // High-Performance In-Memory Catalogue Query (Loaded once, Zero API calls during search!)
  const {
    data: backendSkusResponse,
    isLoading: isBackendLoading,
    isFetching: isBackendFetching,
  } = useGetBackendSkusQuery({
    all: true,
    ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
  });

  const { data: backendBrands = [] } = useGetBackendBrandsQuery();
  const { data: demoBrands = [] } = useGetDemoBrandsQuery(undefined, { skip: isBackendMode });
  const { data: backendCategories = [] } = useGetBackendCategoriesQuery();
  const { data: demoCategories = [] } = useGetDemoCategoriesQuery(undefined, { skip: isBackendMode });
  const { data: backendProductLines = [] } = useGetBackendProductLinesQuery();
  const [toggleStatus] = useToggleVariantStatusMutation();
  const [toggleBackendSkuStatus] = useToggleSkuStatusMutation();

  const isLoading = isBackendMode ? isBackendLoading : isDemoLoading;

  const brands = useMemo(() => {
    return backendBrands.length > 0 ? backendBrands : demoBrands;
  }, [backendBrands, demoBrands]);

  const categories = useMemo(() => {
    return backendCategories.length > 0 ? backendCategories : demoCategories;
  }, [backendCategories, demoCategories]);

  const rawBackendSkus = useMemo(() => {
    if (Array.isArray(backendSkusResponse?.data)) return backendSkusResponse.data;
    if (Array.isArray(backendSkusResponse)) return backendSkusResponse;
    if (Array.isArray((backendSkusResponse as any)?.items)) return (backendSkusResponse as any).items;
    return [];
  }, [backendSkusResponse]);

  const allVariants: ProductVariant[] = useMemo(() => {
    if (rawBackendSkus.length > 0) {
      return rawBackendSkus.map((v: any) => ({
        id: v.id || v._id || '',
        productId: v.productId || v._id || '',
        branchId: v.branchId || v.product?.branchId || (typeof v.productId === 'object' ? v.productId?.branchId : '') || '',
        sku: v.sku,
        productName: v.productName || `${v.brand?.name || ''} - ${v.category?.name || ''}`,
        posDisplayName: v.posDisplayName || v.productId?.posDisplayName || '',
        brandId: v.brandId || v.brand?._id || v.brand?.id || '',
        brandName: v.brandName || v.brand?.name || '',
        categoryId: v.categoryId || v.category?._id || v.category?.id || '',
        categoryName: v.categoryName || v.category?.name || '',
        productLineId: v.productLineId || v.product?.productLineId || '',
        productLineName: v.productLineName || v.productLine?.name || (typeof v.productLineId === 'object' ? v.productLineId?.name : '') || '',
        sizeId: v.sizeId || v.size?._id || v.size?.id || '',
        sizeLabel: v.sizeLabel || v.size?.displayLabel || (v.size ? `${v.size.length} × ${v.size.width}` : ''),
        thicknessId: v.thicknessId || v.thickness?._id || v.thickness?.id || '',
        thicknessLabel: v.thicknessLabel || v.thickness?.displayLabel || (v.thickness ? `${v.thickness.value} inch` : ''),
        listPrice: v.listPrice || 0,
        purchasePrice: v.purchasePrice || 0,
        retailPrice: v.retailPrice || 0,
        wholesalePrice: v.wholesalePrice || 0,
        distributorPrice: v.distributorPrice || 0,
        stock: v.stock !== undefined ? v.stock : v.onHand !== undefined ? v.onHand : 0,
        status: (v.status || 'ACTIVE'),
      }));
    }
    if (!backendSkusResponse && demoVariants.length > 0) {
      return demoVariants;
    }
    return [];
  }, [rawBackendSkus, demoVariants, backendSkusResponse]);

  // High-performance 0ms In-Memory Multi-Filter & Search with posDisplayName + productLineName First Priority!
  const filteredVariants = useMemo(() => {
    let list = allVariants;

    if (brandFilter !== 'all') {
      list = list.filter((v) => String(v.brandId) === String(brandFilter));
    }
    if (categoryFilter !== 'all') {
      list = list.filter((v) => String(v.categoryId) === String(categoryFilter));
    }
    if (productLineFilter !== 'all') {
      list = list.filter((v) => String(v.productLineId) === String(productLineFilter));
    }
    if (statusFilter === 'active') {
      list = list.filter((v) => v.status === 'active' || v.status === 'ACTIVE');
    } else if (statusFilter === 'inactive') {
      list = list.filter((v) => v.status === 'inactive' || v.status === 'INACTIVE');
    }
    if (stockFilter === 'in_stock') {
      list = list.filter((v) => (v.stock ?? 0) > 0);
    } else if (stockFilter === 'out_of_stock') {
      list = list.filter((v) => (v.stock ?? 0) <= 0);
    }

    if (searchQuery.trim()) {
      list = rankSearchResults(list, searchQuery);
    }

    return list;
  }, [allVariants, brandFilter, categoryFilter, productLineFilter, statusFilter, stockFilter, searchQuery]);

  // Total items matching current search and filters
  const totalItems = filteredVariants.length;

  // Paginated slice for current page
  const variants = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredVariants.slice(startIndex, startIndex + pageSize);
  }, [filteredVariants, page, pageSize]);

  const productLines: Array<{ id: string; name: string; brandId: string; categoryId: string }> = useMemo(() => {
    return (Array.isArray(backendProductLines) ? backendProductLines : (backendProductLines as any)?.data || []).map((pl: any) => ({
      id: String(pl.id || pl._id || ''),
      name: pl.name || '',
      brandId: String(pl.brandId?._id || pl.brandId || ''),
      categoryId: String(pl.categoryId?._id || pl.categoryId || ''),
    }));
  }, [backendProductLines]);

  // Categories available based on brand filter
  const availableCategories = useMemo(() => {
    if (brandFilter === 'all') return categories;
    return categories.filter((c) => (c.brandId || (c as any).brand?._id) === brandFilter);
  }, [categories, brandFilter]);

  // Product Lines available based on brand and category filter
  const availableProductLines = useMemo(() => {
    return productLines.filter((pl) => {
      const matchesBrand = brandFilter === 'all' || pl.brandId === brandFilter;
      const matchesCategory = categoryFilter === 'all' || pl.categoryId === categoryFilter;
      return matchesBrand && matchesCategory;
    });
  }, [productLines, brandFilter, categoryFilter]);

  const handleToggleStatus = async (item: ProductVariant) => {
    const isCurrentlyActive = item.status === 'active' || item.status === 'ACTIVE';
    const nextStatus: 'ACTIVE' | 'INACTIVE' = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    const skuId = item.id || (item as any)._id || item.sku;
    try {
      await toggleBackendSkuStatus({ id: skuId, status: nextStatus }).unwrap();
      try {
        await toggleStatus({ id: item.id, status: nextStatus });
      } catch {
        // Ignore demo cache error
      }
      onToast(`Product ${item.sku} is now ${nextStatus.toLowerCase()}.`, 'success');
    } catch {
      // Fallback for demo repository if offline
      try {
        await toggleStatus({ id: item.id, status: nextStatus }).unwrap();
        onToast(`Product ${item.sku} is now ${nextStatus.toLowerCase()}.`, 'success');
      } catch {
        onToast('Could not update status.', 'error');
      }
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Filter and Actions Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap flex-col gap-3 flex-1">
          <div className="relative flex-1 w-[100%]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, SKU, brand, category, or size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-blue focus:bg-white"
            />
            {isBackendFetching && variants.length === 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <RotateCcw className="w-3.5 h-3.5 text-brand-blue animate-spin" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 flex-1">
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
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setProductLineFilter('all');
              }}
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
              value={productLineFilter}
              onChange={(e) => setProductLineFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Product Lines</option>
              {availableProductLines.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
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

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as 'all' | 'in_stock' | 'out_of_stock')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>

            {isSuperAdmin && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            )}

            {(searchQuery ||
              brandFilter !== 'all' ||
              categoryFilter !== 'all' ||
              productLineFilter !== 'all' ||
              statusFilter !== 'all' ||
              stockFilter !== 'all' ||
              (isSuperAdmin && branchFilter !== 'all')) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setBrandFilter('all');
                    setCategoryFilter('all');
                    setProductLineFilter('all');
                    setStatusFilter('all');
                    setStockFilter('all');
                    if (isSuperAdmin) setBranchFilter('all');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
          </div>
        </div>
      </div>

      {/* Simplified Products Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-600">
                <th className="py-3.5 px-3 text-center w-12">S#</th>
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
              {isLoading && variants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RotateCcw className="w-4 h-4 animate-spin text-brand-blue" />
                      <span>Loading products catalogue...</span>
                    </div>
                  </td>
                </tr>
              ) : variants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-600 font-semibold text-xs">No products found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {searchQuery || brandFilter !== 'all' || categoryFilter !== 'all'
                        ? 'Try adjusting or clearing your search filters'
                        : 'Click "+ Add Product" to add your first product'}
                    </p>
                  </td>
                </tr>
              ) : (
                variants.map((item, idx) => {
                  const onHandStock = item.stock ?? 0;
                  const isActive = item.status === 'active' || item.status === 'ACTIVE';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Index */}
                      <td className="py-3.5 px-3 text-center text-gray-400 font-mono">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      {/* Product Details (Thumbnail + Title + SKU) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {/* <div className="w-10 h-8 rounded-lg bg-blue-50/80 border border-blue-100 flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 40 24" fill="none" className="w-6 h-4 text-brand-blue">
                              <rect x="3" y="6" width="34" height="12" rx="3" fill="#EBF3FE" stroke="#3B82F6" strokeWidth="1.5" />
                              <circle cx="12" cy="12" r="1" fill="#3B82F6" />
                              <circle cx="20" cy="12" r="1" fill="#3B82F6" />
                              <circle cx="28" cy="12" r="1" fill="#3B82F6" />
                            </svg>
                          </div> */}
                          <div>
                            <div className="font-bold text-gray-900 text-xs text-nowrap">
                              {item.productName || `${item.brandName || 'Brand'} - ${item.categoryName || 'Mattress'}`}
                            </div>
                            {/* <div className="mt-0.5">
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                                {item.sku}
                              </span>
                            </div> */}
                          </div>
                        </div>
                      </td>

                      {/* Specification */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-gray-800">
                          {item.sizeLabel || '78 × 78'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Thickness: {item.thicknessLabel || '5 inch'}
                        </div>
                      </td>

                      {/* Brand, Category & Product Line */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-brand-blue text-[10px] font-bold border border-blue-100">
                            {item.brandName || 'Brand'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-100">
                            {item.categoryName || 'Category'}
                          </span>
                          {/* {(item.productLineName || item.productName) && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200">
                              Line: {item.productLineName || item.productName}
                            </span>
                          )} */}
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
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${onHandStock <= 0
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
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive
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
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isActive
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

        {/* Server-Side Pagination Controls */}
        <Pagination
          currentPage={page}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          itemName="products"
        />

        {totalItems <= 10 && (
          <div className="p-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
            <span>
              Showing <strong className="text-gray-800">{variants.length}</strong> of{' '}
              <strong className="text-gray-800">{totalItems}</strong> products
            </span>
            <span className="text-[11px] text-gray-400">
              Click &quot;Edit&quot; to modify specifications or prices
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
