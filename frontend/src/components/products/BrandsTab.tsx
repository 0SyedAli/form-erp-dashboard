'use client';

import React, { useState, useMemo } from 'react';
import { Brand } from '@/types';
import {
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetProductsQuery,
} from '@/store/services/apiSlice';
import BrandModal from './BrandModal';
import BrandStatusModal from './BrandStatusModal';
import {
  Search,
  Plus,
  Edit2,
  Power,
  RotateCcw,
  Award,
  Layers,
  Package,
} from 'lucide-react';

interface BrandsTabProps {
  canManage: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function BrandsTab({ canManage, onToast }: BrandsTabProps) {
  const { data: brands = [], isLoading } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: products = [] } = useGetProductsQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusModalBrand, setStatusModalBrand] = useState<Brand | null>(null);

  // Filtered brands
  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      const matchesSearch =
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brand.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (brand.description && brand.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' || brand.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [brands, searchQuery, statusFilter]);

  const handleEdit = (brand: Brand) => {
    setSelectedBrand(brand);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedBrand(null);
    setIsModalOpen(true);
  };

  const handleStatusToggle = (brand: Brand) => {
    setStatusModalBrand(brand);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search brands by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-hidden focus:border-brand-blue"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
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
            <span>Add Brand</span>
          </button>
        )}
      </div>

      {/* Brands Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-center">Categories</th>
                <th className="py-3.5 px-4 text-center">Products</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Loading brands...
                  </td>
                </tr>
              ) : filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <Award className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No brands found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try clearing search filters'
                        : 'Click "Add Brand" to create the first brand'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBrands.map((brand, idx) => {
                  const brandCategories = categories.filter((c) => c.brandId === brand.id);
                  const brandProducts = products.filter((p) => p.brandId === brand.id);

                  return (
                    <tr key={brand.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-4 text-center text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {brand.logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={brand.logo}
                                alt={brand.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Award className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{brand.name}</div>
                            <span className="text-xs text-gray-400">ID: {brand.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs font-semibold text-brand-blue">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100">
                          {brand.code}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-600 text-xs max-w-xs truncate">
                        {brand.description || '—'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          <Layers className="w-3 h-3 text-gray-500" />
                          <span>{brandCategories.length}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          <Package className="w-3 h-3 text-gray-500" />
                          <span>{brandProducts.length}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            brand.status.toLowerCase() === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {brand.status.toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500">
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleEdit(brand)}
                                className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                title="Edit Brand"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStatusToggle(brand)}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  brand.status.toLowerCase() === 'active'
                                    ? 'hover:text-amber-600 hover:bg-amber-50'
                                    : 'hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={brand.status.toLowerCase() === 'active' ? 'Deactivate Brand' : 'Activate Brand'}
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
            Showing {filteredBrands.length} of {brands.length} brands
          </span>
        </div>
      </div>

      {/* Add / Edit Brand Modal */}
      <BrandModal
        isOpen={isModalOpen}
        brand={selectedBrand}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBrand(null);
        }}
        onSuccess={(saved) => {
          onToast(
            selectedBrand
              ? `Brand "${saved.name}" updated successfully`
              : `Brand "${saved.name}" created successfully`,
            'success'
          );
        }}
      />

      {/* Status Confirmation Modal */}
      <BrandStatusModal
        isOpen={!!statusModalBrand}
        brand={statusModalBrand}
        onClose={() => setStatusModalBrand(null)}
        onSuccess={(updated) => {
          onToast(
            `Brand "${updated.name}" is now ${updated.status}`,
            updated.status === 'active' ? 'success' : 'info'
          );
        }}
      />
    </div>
  );
}
