'use client';

import React, { useState, useMemo } from 'react';
import { CatalogueProduct, ProductVariant } from '@/types';
import {
  useGetProductsQuery,
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetVariantsQuery,
} from '@/store/services/apiSlice';
import ProductModal from './ProductModal';
import ProductStatusModal from './ProductStatusModal';
import ProductDetailModal from './ProductDetailModal';
import VariantGeneratorModal from './VariantGeneratorModal';
import EditPriceModal from './EditPriceModal';
import {
  Search,
  Plus,
  Edit2,
  Power,
  RotateCcw,
  Package,
  Eye,
  Sparkles,
  Boxes,
} from 'lucide-react';

interface ProductsTabProps {
  canManage: boolean;
  canManagePricing: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserEmail?: string;
}

export default function ProductsTab({
  canManage,
  canManagePricing,
  onToast,
  currentUserEmail,
}: ProductsTabProps) {
  const { data: products = [], isLoading } = useGetProductsQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: variants = [] } = useGetVariantsQuery();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(null);

  const [detailProduct, setDetailProduct] = useState<CatalogueProduct | null>(null);
  const [statusProduct, setStatusProduct] = useState<CatalogueProduct | null>(null);

  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorTargetProduct, setGeneratorTargetProduct] = useState<CatalogueProduct | null>(null);

  const [priceModalVariant, setPriceModalVariant] = useState<ProductVariant | null>(null);

  // Fast lookups
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Categories available based on brand filter
  const availableCategories = useMemo(() => {
    if (brandFilter === 'all') return categories;
    return categories.filter((c) => c.brandId === brandFilter);
  }, [categories, brandFilter]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const brand = brandMap.get(prod.brandId);
      const cat = categoryMap.get(prod.categoryId);

      const matchesSearch =
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (brand && brand.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cat && cat.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesBrand = brandFilter === 'all' || prod.brandId === brandFilter;
      const matchesCategory = categoryFilter === 'all' || prod.categoryId === categoryFilter;
      const matchesStatus =
        statusFilter === 'all' || prod.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesBrand && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, brandFilter, categoryFilter, statusFilter, brandMap, categoryMap]);

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products or SKU codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
          </div>

          <select
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setCategoryFilter('all');
            }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-hidden focus:border-brand-blue"
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
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-hidden focus:border-brand-blue"
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
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-hidden focus:border-brand-blue"
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
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Global Action Buttons */}
        {canManage && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                setGeneratorTargetProduct(null);
                setGeneratorOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Generate Variants</span>
            </button>

            <button
              onClick={() => {
                setSelectedProduct(null);
                setIsProductModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Product Details</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Configured Variants</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Loading catalogue products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No products found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {searchQuery || brandFilter !== 'all'
                        ? 'Try clearing search filters'
                        : 'Click "Add Product" to create catalogue items'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p, idx) => {
                  const brand = brandMap.get(p.brandId);
                  const category = categoryMap.get(p.categoryId);
                  const productVariants = variants.filter((v) => v.productId === p.id);

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-4 text-center text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue shrink-0 overflow-hidden">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-brand-blue" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                            <span className="font-mono text-xs text-brand-blue font-semibold">
                              {p.code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-700 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-brand-blue text-xs font-medium">
                          {brand?.name || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-700 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-medium">
                          {category?.name || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => setDetailProduct(p)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                          title="Click to view all variants"
                        >
                          <Boxes className="w-3.5 h-3.5 text-gray-500" />
                          <span>{productVariants.length} SKUs</span>
                        </button>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            p.status.toLowerCase() === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {p.status.toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500">
                          <button
                            onClick={() => setDetailProduct(p)}
                            className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title="View Product & Variants"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setGeneratorTargetProduct(p);
                                  setGeneratorOpen(true);
                                }}
                                className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                title="Generate Variants for this product"
                              >
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setIsProductModalOpen(true);
                                }}
                                className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                title="Edit Product"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setStatusProduct(p)}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  p.status.toLowerCase() === 'active'
                                    ? 'hover:text-amber-600 hover:bg-amber-50'
                                    : 'hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={p.status.toLowerCase() === 'active' ? 'Deactivate Product' : 'Activate Product'}
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
            Showing {filteredProducts.length} of {products.length} products
          </span>
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        product={selectedProduct}
        onClose={() => {
          setIsProductModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={(saved) => {
          onToast(
            selectedProduct
              ? `Product "${saved.name}" updated successfully`
              : `Product "${saved.name}" created successfully`,
            'success'
          );
        }}
      />

      {/* Product Details Modal */}
      <ProductDetailModal
        isOpen={!!detailProduct}
        product={detailProduct}
        canManage={canManage}
        onClose={() => setDetailProduct(null)}
        onGenerateVariants={(prod) => {
          setGeneratorTargetProduct(prod);
          setGeneratorOpen(true);
        }}
        onEditVariantPrice={(v) => {
          if (canManagePricing) {
            setPriceModalVariant(v);
          } else {
            onToast('You do not have permission to modify pricing', 'error');
          }
        }}
      />

      {/* Status Modal */}
      <ProductStatusModal
        isOpen={!!statusProduct}
        product={statusProduct}
        onClose={() => setStatusProduct(null)}
        onSuccess={(updated) => {
          onToast(
            `Product "${updated.name}" is now ${updated.status}`,
            updated.status === 'active' ? 'success' : 'info'
          );
        }}
      />

      {/* Variant Generator Modal */}
      <VariantGeneratorModal
        isOpen={generatorOpen}
        preselectedProduct={generatorTargetProduct}
        onClose={() => {
          setGeneratorOpen(false);
          setGeneratorTargetProduct(null);
        }}
        onSuccess={(count) => {
          onToast(`Successfully created ${count} product variants!`, 'success');
        }}
      />

      {/* Edit Single Variant Price Modal */}
      <EditPriceModal
        isOpen={!!priceModalVariant}
        variant={priceModalVariant}
        currentUserEmail={currentUserEmail}
        onClose={() => setPriceModalVariant(null)}
        onSuccess={(updated) => {
          onToast(`Pricing updated for ${updated.sku}`, 'success');
        }}
      />
    </div>
  );
}
