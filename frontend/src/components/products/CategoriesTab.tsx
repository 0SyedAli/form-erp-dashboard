'use client';

import React, { useState, useMemo } from 'react';
import { Category } from '@/types';
import {
  useGetCategoriesQuery,
  useGetBrandsQuery,
  useGetProductsQuery,
} from '@/store/services/apiSlice';
import CategoryModal from './CategoryModal';
import CategoryStatusModal from './CategoryStatusModal';
import {
  Search,
  Plus,
  Edit2,
  Power,
  RotateCcw,
  Layers,
  Package,
} from 'lucide-react';

interface CategoriesTabProps {
  canManage: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function CategoriesTab({ canManage, onToast }: CategoriesTabProps) {
  const { data: categories = [], isLoading } = useGetCategoriesQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: products = [] } = useGetProductsQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusModalCategory, setStatusModalCategory] = useState<Category | null>(null);

  // Map brands for fast lookup
  const brandMap = useMemo(() => {
    return new Map(brands.map((b) => [b.id, b]));
  }, [brands]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesBrand = brandFilter === 'all' || cat.brandId === brandFilter;
      const matchesStatus =
        statusFilter === 'all' || cat.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesBrand && matchesStatus;
    });
  }, [categories, searchQuery, brandFilter, statusFilter]);

  const handleEdit = (cat: Category) => {
    setSelectedCategory(cat);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedCategory(null);
    setIsModalOpen(true);
  };

  const handleStatusToggle = (cat: Category) => {
    setStatusModalCategory(cat);
  };

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
          </div>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-hidden focus:border-brand-blue"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                Brand: {b.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-hidden focus:border-brand-blue"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(searchQuery || brandFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setBrandFilter('all');
                setStatusFilter('all');
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {canManage && (
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Category Name</th>
                <th className="py-3.5 px-4">Parent Brand</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-center">Products</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Loading categories...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No categories found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {searchQuery || brandFilter !== 'all' || statusFilter !== 'all'
                        ? 'Try clearing category filters'
                        : 'Click "Add Category" to create brand-specific categories'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, idx) => {
                  const parentBrand = brandMap.get(cat.brandId);
                  const catProducts = products.filter((p) => p.categoryId === cat.id);

                  return (
                    <tr key={cat.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-4 text-center text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-medium shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{cat.name}</div>
                            <span className="text-xs text-gray-400">ID: {cat.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-brand-blue border border-blue-100">
                          {parentBrand?.name || 'Unknown Brand'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs font-semibold text-gray-700">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
                          {cat.code}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-600 text-xs max-w-xs truncate">
                        {cat.description || '—'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          <Package className="w-3 h-3 text-gray-500" />
                          <span>{catProducts.length}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            cat.status.toLowerCase() === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {cat.status.toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500">
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleEdit(cat)}
                                className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                title="Edit Category"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStatusToggle(cat)}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  cat.status.toLowerCase() === 'active'
                                    ? 'hover:text-amber-600 hover:bg-amber-50'
                                    : 'hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={cat.status.toLowerCase() === 'active' ? 'Deactivate Category' : 'Activate Category'}
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
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
          <span>
            Showing {filteredCategories.length} of {categories.length} categories
          </span>
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        category={selectedCategory}
        defaultBrandId={brandFilter !== 'all' ? brandFilter : undefined}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCategory(null);
        }}
        onSuccess={(saved) => {
          onToast(
            selectedCategory
              ? `Category "${saved.name}" updated successfully`
              : `Category "${saved.name}" created for brand`,
            'success'
          );
        }}
      />

      {/* Status Modal */}
      <CategoryStatusModal
        isOpen={!!statusModalCategory}
        category={statusModalCategory}
        onClose={() => setStatusModalCategory(null)}
        onSuccess={(updated) => {
          onToast(
            `Category "${updated.name}" is now ${updated.status}`,
            updated.status === 'active' ? 'success' : 'info'
          );
        }}
      />
    </div>
  );
}
