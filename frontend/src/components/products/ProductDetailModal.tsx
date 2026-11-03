'use client';

import React, { useMemo } from 'react';
import { CatalogueProduct, ProductVariant } from '@/types';
import {
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetVariantsQuery,
  useGetSizesQuery,
  useGetThicknessQuery,
} from '@/store/services/apiSlice';
import { X, Package, Sparkles, Tag } from 'lucide-react';

interface ProductDetailModalProps {
  product: CatalogueProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateVariants: (product: CatalogueProduct) => void;
  onEditVariantPrice: (variant: ProductVariant) => void;
  canManage: boolean;
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onGenerateVariants,
  onEditVariantPrice,
  canManage,
}: ProductDetailModalProps) {
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: variants = [] } = useGetVariantsQuery();
  const { data: sizes = [] } = useGetSizesQuery();
  const { data: thicknessList = [] } = useGetThicknessQuery();

  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const sizeMap = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const thicknessMap = useMemo(() => new Map(thicknessList.map((t) => [t.id, t])), [thicknessList]);

  if (!isOpen || !product) return null;

  const brand = brandMap.get(product.brandId);
  const category = categoryMap.get(product.categoryId);
  const productVariants = variants.filter((v) => v.productId === product.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="product-detail-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue font-semibold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 id="product-detail-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                {product.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-50 text-brand-blue font-semibold">
                  {product.code}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">{brand?.name || 'Brand'}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">{category?.name || 'Category'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Info Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-200/80 text-sm">
            <div>
              <span className="text-xs text-gray-500 block">Brand</span>
              <span className="font-semibold text-gray-900">{brand?.name || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Category</span>
              <span className="font-semibold text-gray-900">{category?.name || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Status</span>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  product.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {product.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Total Generated Variants</span>
              <span className="font-semibold text-gray-900 text-base">
                {productVariants.length} SKUs
              </span>
            </div>
          </div>

          {product.description && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Description
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed bg-white p-3 rounded-lg border border-gray-100">
                {product.description}
              </p>
            </div>
          )}

          {/* Variants Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Configured Product Variants</h3>
                <p className="text-xs text-gray-500">
                  Matrix of sizes, thicknesses, SKUs and price points
                </p>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGenerateVariants(product);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Variants</span>
                </button>
              )}
            </div>

            {productVariants.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-200/80">
                <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">No variants generated yet</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Click &ldquo;Generate Variants&rdquo; to create mattress combinations with SKUs and pricing.
                </p>
              </div>
            ) : (
              <div className="border border-gray-200/80 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Dimensions (Size)</th>
                      <th className="py-2.5 px-3">Thickness</th>
                      <th className="py-2.5 px-3 text-right">Retail Price</th>
                      <th className="py-2.5 px-3 text-right">Wholesale Price</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      {canManage && <th className="py-2.5 px-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {productVariants.map((v) => {
                      const sz = sizeMap.get(v.sizeId);
                      const th = thicknessMap.get(v.thicknessId);

                      return (
                        <tr key={v.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-semibold text-brand-blue">
                            {v.sku}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-gray-900">
                            {sz ? sz.displayLabel : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">
                            {th ? th.displayLabel : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-gray-900">
                            Rs. {v.retailPrice.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-gray-600">
                            Rs. {v.wholesalePrice.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                v.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {v.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {canManage && (
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => {
                                  onClose();
                                  onEditVariantPrice(v);
                                }}
                                className="text-brand-blue hover:underline font-medium text-xs cursor-pointer"
                              >
                                Edit Price
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
