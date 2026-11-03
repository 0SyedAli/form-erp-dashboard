'use client';

import React, { useState, useMemo } from 'react';
import {
  ProductVariant,
  CatalogueProduct,
  Brand,
  Category,
  MattressSize,
  MattressThickness,
} from '@/types';
import {
  useGetVariantsQuery,
  useGetProductsQuery,
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetSizesQuery,
  useGetThicknessQuery,
} from '@/store/services/apiSlice';
import EditPriceModal from './EditPriceModal';
import BulkPriceModal from './BulkPriceModal';
import PriceHistoryModal from './PriceHistoryModal';
import VariantStatusModal from './VariantStatusModal';
import VariantGeneratorModal from './VariantGeneratorModal';
import {
  Search,
  RotateCcw,
  Sparkles,
  DollarSign,
  TrendingUp,
  History,
  Power,
  Tag,
} from 'lucide-react';

interface VariantsTabProps {
  canManage: boolean;
  canManagePricing: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  currentUserEmail?: string;
}

export default function VariantsTab({
  canManage,
  canManagePricing,
  onToast,
  currentUserEmail,
}: VariantsTabProps) {
  const { data: variants = [], isLoading } = useGetVariantsQuery();
  const { data: products = [] } = useGetProductsQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: sizes = [] } = useGetSizesQuery();
  const { data: thicknessList = [] } = useGetThicknessQuery();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [thicknessFilter, setThicknessFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals
  const [editPriceVariant, setEditPriceVariant] = useState<ProductVariant | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyTargetSku, setHistoryTargetSku] = useState<string | undefined>(undefined);
  const [statusVariant, setStatusVariant] = useState<ProductVariant | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  // Lookup maps with explicit types
  const productMap = useMemo(() => new Map<string, CatalogueProduct>(products.map((p) => [p.id, p])), [products]);
  const brandMap = useMemo(() => new Map<string, Brand>(brands.map((b) => [b.id, b])), [brands]);
  const categoryMap = useMemo(() => new Map<string, Category>(categories.map((c) => [c.id, c])), [categories]);
  const sizeMap = useMemo(() => new Map<string, MattressSize>(sizes.map((s) => [s.id, s])), [sizes]);
  const thicknessMap = useMemo(() => new Map<string, MattressThickness>(thicknessList.map((t) => [t.id, t])), [thicknessList]);

  // Filtered variants
  const filteredVariants = useMemo(() => {
    return variants.filter((v: ProductVariant) => {
      const prod = productMap.get(v.productId);
      const brand = prod ? brandMap.get(prod.brandId) : null;
      const cat = prod ? categoryMap.get(prod.categoryId) : null;
      const sz = sizeMap.get(v.sizeId);
      const th = thicknessMap.get(v.thicknessId);

      const query = searchQuery.toLowerCase();
      const matchesSearch =
        v.sku.toLowerCase().includes(query) ||
        (prod && prod.name.toLowerCase().includes(query)) ||
        (brand && brand.name.toLowerCase().includes(query)) ||
        (cat && cat.name.toLowerCase().includes(query)) ||
        (sz && sz.displayLabel.toLowerCase().includes(query)) ||
        (th && th.displayLabel.toLowerCase().includes(query));

      const matchesBrand = brandFilter === 'all' || (prod && prod.brandId === brandFilter);
      const matchesCategory = categoryFilter === 'all' || (prod && prod.categoryId === categoryFilter);
      const matchesSize = sizeFilter === 'all' || v.sizeId === sizeFilter;
      const matchesThickness = thicknessFilter === 'all' || v.thicknessId === thicknessFilter;
      const matchesStatus =
        statusFilter === 'all' || v.status.toLowerCase() === statusFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesBrand &&
        matchesCategory &&
        matchesSize &&
        matchesThickness &&
        matchesStatus
      );
    });
  }, [
    variants,
    searchQuery,
    brandFilter,
    categoryFilter,
    sizeFilter,
    thicknessFilter,
    statusFilter,
    productMap,
    brandMap,
    categoryMap,
    sizeMap,
    thicknessMap,
  ]);

  const handleOpenHistory = (sku?: string) => {
    setHistoryTargetSku(sku);
    setIsHistoryOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by SKU, product, size..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
            </div>

            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-hidden focus:border-brand-blue"
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
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-hidden focus:border-brand-blue"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-hidden focus:border-brand-blue"
            >
              <option value="all">All Sizes</option>
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayLabel}
                </option>
              ))}
            </select>

            <select
              value={thicknessFilter}
              onChange={(e) => setThicknessFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-hidden focus:border-brand-blue"
            >
              <option value="all">All Thickness</option>
              {thicknessList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayLabel}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-hidden focus:border-brand-blue"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {(searchQuery ||
              brandFilter !== 'all' ||
              categoryFilter !== 'all' ||
              sizeFilter !== 'all' ||
              thicknessFilter !== 'all' ||
              statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setBrandFilter('all');
                  setCategoryFilter('all');
                  setSizeFilter('all');
                  setThicknessFilter('all');
                  setStatusFilter('all');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenHistory()}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            >
              <History className="w-4 h-4 text-gray-500" />
              <span>Price Audit</span>
            </button>

            {canManagePricing && (
              <button
                onClick={() => setIsBulkOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span>Bulk Pricing</span>
              </button>
            )}

            {canManage && (
              <button
                onClick={() => setGeneratorOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Variants</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Variants Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">SKU Code</th>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Brand / Category</th>
                <th className="py-3.5 px-4">Size (Dimensions)</th>
                <th className="py-3.5 px-4">Thickness</th>
                <th className="py-3.5 px-4 text-right">Retail Price</th>
                <th className="py-3.5 px-4 text-right">Wholesale Price</th>
                <th className="py-3.5 px-4 text-right text-purple-900">Distributor Price</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-gray-400">
                    Loading variants catalogue...
                  </td>
                </tr>
              ) : filteredVariants.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center">
                    <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No variants found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {searchQuery || brandFilter !== 'all' || sizeFilter !== 'all'
                        ? 'Try clearing the filters above'
                        : 'Click "Generate Variants" to create combinations'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVariants.map((v, idx) => {
                  const prod = productMap.get(v.productId);
                  const brand = prod ? brandMap.get(prod.brandId) : null;
                  const cat = prod ? categoryMap.get(prod.categoryId) : null;
                  const sz = sizeMap.get(v.sizeId);
                  const th = thicknessMap.get(v.thicknessId);

                  return (
                    <tr key={v.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-4 text-center text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-brand-blue text-xs">
                        <span className="px-2 py-1 rounded-md bg-blue-50 border border-blue-100">
                          {v.sku}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-900 text-sm">
                        {prod?.name || 'Unknown Product'}
                      </td>
                      <td className="py-4 px-4 text-xs text-gray-600">
                        <div className="font-medium text-gray-800">{brand?.name || '—'}</div>
                        <div className="text-gray-400">{cat?.name || '—'}</div>
                      </td>
                      <td className="py-4 px-4 text-sm font-medium text-gray-800">
                        {sz ? sz.displayLabel : '—'}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {th ? th.displayLabel : '—'}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900 text-sm">
                        Rs. {v.retailPrice.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-600 text-sm">
                        Rs. {v.wholesalePrice.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-purple-700 text-sm">
                        Rs. {(v.distributorPrice ?? Math.round(v.wholesalePrice * 0.88)).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            v.status.toLowerCase() === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {v.status.toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500">
                          {canManagePricing && (
                            <button
                              onClick={() => setEditPriceVariant(v)}
                              className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                              title="Edit Price"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenHistory(v.sku)}
                            className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title="View SKU Price History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {canManage && (
                            <button
                              onClick={() => setStatusVariant(v)}
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                v.status.toLowerCase() === 'active'
                                  ? 'hover:text-amber-600 hover:bg-amber-50'
                                  : 'hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={v.status.toLowerCase() === 'active' ? 'Deactivate Variant' : 'Activate Variant'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
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
            Showing {filteredVariants.length} of {variants.length} saleable SKU variants
          </span>
        </div>
      </div>

      {/* Edit Single Variant Price Modal */}
      <EditPriceModal
        isOpen={!!editPriceVariant}
        variant={editPriceVariant}
        currentUserEmail={currentUserEmail}
        onClose={() => setEditPriceVariant(null)}
        onSuccess={(updated) => {
          onToast(`Updated prices for ${updated.sku}`, 'success');
        }}
      />

      {/* Bulk Price Modal */}
      <BulkPriceModal
        isOpen={isBulkOpen}
        currentUserEmail={currentUserEmail}
        onClose={() => setIsBulkOpen(false)}
        onSuccess={(count) => {
          onToast(`Bulk pricing successfully adjusted for ${count} variants!`, 'success');
        }}
      />

      {/* Price History Modal */}
      <PriceHistoryModal
        isOpen={isHistoryOpen}
        targetSku={historyTargetSku}
        onClose={() => {
          setIsHistoryOpen(false);
          setHistoryTargetSku(undefined);
        }}
      />

      {/* Variant Status Modal */}
      <VariantStatusModal
        isOpen={!!statusVariant}
        variant={statusVariant}
        onClose={() => setStatusVariant(null)}
        onSuccess={(updated) => {
          onToast(
            `SKU ${updated.sku} is now ${updated.status}`,
            updated.status === 'active' ? 'success' : 'info'
          );
        }}
      />

      {/* Variant Generator Modal */}
      <VariantGeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onSuccess={(count) => {
          onToast(`Generated ${count} product variants!`, 'success');
        }}
      />
    </div>
  );
}
