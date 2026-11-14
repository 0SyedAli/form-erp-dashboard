'use client';

import React, { useState, useMemo } from 'react';
import { ProductLine } from '@/types';
import {
  useGetProductLinesQuery,
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetProductsQuery,
  useDeleteProductLineMutation,
  useToggleProductLineStatusMutation,
} from '@/store/services/catalogueApi';
import { useClientPagination } from '@/components/common/Pagination';
import ProductLineModal from './ProductLineModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import {
  Search,
  Plus,
  Edit2,
  Power,
  Trash2,
  RotateCcw,
  Network,
  Package,
} from 'lucide-react';

interface ProductLinesTabProps {
  canManage: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function ProductLinesTab({ canManage, onToast }: ProductLinesTabProps) {
  const { data: rawProductLines = [], isLoading: isLinesLoading } = useGetProductLinesQuery();
  const { data: rawBrands = [] } = useGetBrandsQuery();
  const { data: rawCategories = [] } = useGetCategoriesQuery();
  const { data: rawProducts = [] } = useGetProductsQuery({ limit: 100 });

  const [deleteProductLineMutation, { isLoading: isDeleting }] = useDeleteProductLineMutation();
  const [toggleStatusMutation] = useToggleProductLineStatusMutation();

  const productLines: ProductLine[] = useMemo(() => {
    return (Array.isArray(rawProductLines) ? rawProductLines : []).map((pl: any) => ({
      ...pl,
      id: String(pl.id || pl._id || ''),
      brandId: String(pl.brandId?._id || pl.brandId || ''),
      categoryId: String(pl.categoryId?._id || pl.categoryId || ''),
      brandName: pl.brandId?.name || pl.brandName || '',
      categoryName: pl.categoryId?.name || pl.categoryName || '',
      status: pl.status || 'ACTIVE',
    }));
  }, [rawProductLines]);

  const brands = useMemo(() => {
    return (Array.isArray(rawBrands) ? rawBrands : []).map((b: any) => ({
      ...b,
      id: String(b.id || b._id || ''),
    }));
  }, [rawBrands]);

  const categories = useMemo(() => {
    return (Array.isArray(rawCategories) ? rawCategories : []).map((c: any) => ({
      ...c,
      id: String(c.id || c._id || ''),
    }));
  }, [rawCategories]);

  const products = useMemo(() => {
    const list = Array.isArray(rawProducts)
      ? rawProducts
      : (rawProducts as any)?.data || (rawProducts as any)?.items || [];
    return list.map((p: any) => ({
      ...p,
      id: String(p.id || p._id || ''),
      productLineId: String(p.productLineId?._id || p.productLineId || ''),
    }));
  }, [rawProducts]);

  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProductLine, setSelectedProductLine] = useState<ProductLine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lineToDelete, setLineToDelete] = useState<ProductLine | null>(null);

  // Map brands & categories for fast lookup
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Count products linked to each product line
  const productCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p: any) => {
      if (p.productLineId) {
        counts.set(p.productLineId, (counts.get(p.productLineId) || 0) + 1);
      }
    });
    return counts;
  }, [products]);

  // Available categories based on selected brand filter
  const availableCategories = useMemo(() => {
    if (brandFilter === 'all') return categories;
    return categories.filter((c) => (c.brandId || c.brand?._id) === brandFilter);
  }, [categories, brandFilter]);

  // Filtering
  const filteredLines = useMemo(() => {
    return productLines.filter((pl) => {
      const q = searchQuery.toLowerCase().trim();
      const brand = brandMap.get(pl.brandId);
      const cat = categoryMap.get(pl.categoryId);

      const matchesSearch =
        !q ||
        pl.name.toLowerCase().includes(q) ||
        pl.code.toLowerCase().includes(q) ||
        brand?.name.toLowerCase().includes(q) ||
        cat?.name.toLowerCase().includes(q);

      const matchesBrand = brandFilter === 'all' || pl.brandId === brandFilter;
      const matchesCategory = categoryFilter === 'all' || pl.categoryId === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (pl.status === 'ACTIVE' || pl.status === 'active')) ||
        (statusFilter === 'inactive' && (pl.status === 'INACTIVE' || pl.status === 'inactive'));

      return matchesSearch && matchesBrand && matchesCategory && matchesStatus;
    });
  }, [productLines, searchQuery, brandFilter, categoryFilter, statusFilter, brandMap, categoryMap]);

  // Pagination
  const { paginatedItems: paginatedLines, PaginationComponent: ProductLinesPagination } =
    useClientPagination(filteredLines, 15, 'product lines');

  const handleToggleStatus = async (pl: ProductLine) => {
    const nextStatus = pl.status === 'ACTIVE' || pl.status === 'active' ? 'INACTIVE' : 'ACTIVE';
    try {
      await toggleStatusMutation({ id: pl.id, status: nextStatus }).unwrap();
      onToast(`Product line "${pl.name}" marked as ${nextStatus}`, 'success');
    } catch (err: any) {
      onToast(err?.data?.message || err?.message || 'Failed to update status', 'error');
    }
  };

  const handleDeleteLine = async () => {
    if (!lineToDelete) return;
    try {
      await deleteProductLineMutation(lineToDelete.id).unwrap();
      onToast(`Product line "${lineToDelete.name}" deleted successfully`, 'success');
      setLineToDelete(null);
    } catch (err: any) {
      onToast(err?.data?.message || err?.message || 'Failed to delete product line', 'error');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setBrandFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters =
    searchQuery !== '' || brandFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search & Filters */}
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product lines..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Brand Filter */}
            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setCategoryFilter('all');
              }}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-gray-700"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Main Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-gray-700"
            >
              <option value="all">All Main Categories</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-gray-700"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Reset filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action: Add Product Line */}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setSelectedProductLine(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-blue hover:bg-blue-700 rounded-xl shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product Line
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-gray-500 font-semibold border-b border-gray-200/70">
              <tr>
                <th className="py-3 px-4 w-12 text-center font-mono">#</th>
                <th className="py-3 px-4">Product Line (Sub-Category)</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Main Category</th>
                <th className="py-3 px-4 text-center">Products</th>
                <th className="py-3 px-4 text-center">Status</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {isLinesLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Loading product lines...
                  </td>
                </tr>
              ) : filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Network className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-600 font-semibold text-xs">No product lines found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {hasActiveFilters
                        ? 'Try clearing search or filter selections'
                        : 'Click "+ Add Product Line" to create your first sub-category'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLines.map((pl, idx) => {
                  const brand = brandMap.get(pl.brandId);
                  const category = categoryMap.get(pl.categoryId);
                  const prodCount = productCountMap.get(pl.id) || 0;
                  const isActive = pl.status === 'ACTIVE' || pl.status === 'active';

                  return (
                    <tr key={pl.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Index */}
                      <td className="py-3 px-4 text-center text-gray-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={pl.imageUrl || '/assets/mattress/foam1.png'}
                              alt={pl.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.src = '/assets/mattress/foam1.png';
                              }}
                            />
                          </div>
                          <div>
                            <span>{pl.name}</span>
                            {pl.description && (
                              <div className="text-[11px] text-gray-400 font-normal line-clamp-1">
                                {pl.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3 px-4 font-mono font-semibold text-gray-600">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">
                          {pl.code}
                        </span>
                      </td>

                      {/* Brand */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-brand-blue text-[10px] font-bold border border-blue-100">
                          {pl.brandName || brand?.name || '—'}
                        </span>
                      </td>

                      {/* Main Category */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-100">
                          {pl.categoryName || category?.name || '—'}
                        </span>
                      </td>

                      {/* Products Count */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-gray-600 font-semibold bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
                          <Package className="w-3 h-3 text-gray-400" />
                          {prodCount}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductLine(pl);
                                setIsModalOpen(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit product line"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(pl)}
                              className={`p-1 rounded-lg transition-colors ${
                                isActive
                                  ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setLineToDelete(pl)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete product line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {ProductLinesPagination}
      </div>

      {/* Modals */}
      <ProductLineModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productLine={selectedProductLine}
        defaultBrandId={brandFilter !== 'all' ? brandFilter : undefined}
        defaultCategoryId={categoryFilter !== 'all' ? categoryFilter : undefined}
        onSuccess={(saved) => {
          onToast(
            `Product line "${saved.name}" ${selectedProductLine ? 'updated' : 'created'} successfully`,
            'success'
          );
        }}
      />

      <DeleteConfirmModal
        isOpen={!!lineToDelete}
        title="Delete Product Line"
        entityName={lineToDelete ? `${lineToDelete.name} (${lineToDelete.code})` : ''}
        warningText="Deleting this product line will remove all associated products and configurations from the catalogue."
        isLoading={isDeleting}
        onConfirm={handleDeleteLine}
        onClose={() => setLineToDelete(null)}
      />
    </div>
  );
}
