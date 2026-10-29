'use client';

import React, { useState, useMemo } from 'react';
import {
  useGetPricingHistoryQuery,
  useGetVariantsQuery,
  useGetProductsQuery,
} from '@/store/services/apiSlice';
import { X, History, Search, ArrowRight, User } from 'lucide-react';

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSku?: string;
}

export default function PriceHistoryModal({
  isOpen,
  onClose,
  targetSku,
}: PriceHistoryModalProps) {
  const { data: history = [], isLoading } = useGetPricingHistoryQuery();
  const { data: variants = [] } = useGetVariantsQuery();
  const { data: products = [] } = useGetProductsQuery();

  const [searchQuery, setSearchQuery] = useState(targetSku || '');

  const variantMap = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      const variant = variantMap.get(h.variantId);
      const sku = variant?.sku || '';
      const prod = variant ? productMap.get(variant.productId) : null;
      const prodName = prod?.name || '';

      const reasonText = h.changeReason || h.reason || '';
      const query = searchQuery.toLowerCase();
      return (
        sku.toLowerCase().includes(query) ||
        prodName.toLowerCase().includes(query) ||
        h.changedBy.toLowerCase().includes(query) ||
        reasonText.toLowerCase().includes(query)
      );
    });
  }, [history, searchQuery, variantMap, productMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]"
        role="dialog"
        aria-labelledby="price-history-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue font-semibold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 id="price-history-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                Catalogue Pricing Audit History
              </h2>
              <p className="text-xs text-gray-500">
                Immutable chronological log of all retail and wholesale price revisions
              </p>
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

        {/* Filter bar */}
        <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by SKU, product or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue"
            />
          </div>
          <span className="text-xs text-gray-500">
            {filteredHistory.length} audit records
          </span>
        </div>

        {/* Audit List Table */}
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading audit history...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No price change logs match your search.
            </div>
          ) : (
            <div className="border border-gray-200/80 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Variant SKU</th>
                    <th className="py-3 px-3">Retail Revision</th>
                    <th className="py-3 px-3">Wholesale Revision</th>
                    <th className="py-3 px-3">Changed By</th>
                    <th className="py-3 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredHistory.map((item) => {
                    const variant = variantMap.get(item.variantId);
                    const prod = variant ? productMap.get(variant.productId) : null;
                    const dateString = item.createdAt || item.timestamp;
                    const dateFormatted = dateString ? new Date(dateString).toLocaleString() : '—';

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-900">
                          <div className="font-mono text-brand-blue font-semibold">
                            {variant?.sku || 'SKU'}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate max-w-[150px]">
                            {prod?.name}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="text-gray-400 line-through">
                              Rs. {item.oldRetailPrice.toLocaleString()}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="text-emerald-700 font-bold">
                              Rs. {item.newRetailPrice.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="text-gray-400 line-through">
                              Rs. {item.oldWholesalePrice.toLocaleString()}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="text-blue-700 font-bold">
                              Rs. {item.newWholesalePrice.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-400" />
                            <span>{item.changedBy}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-600 max-w-[200px] truncate">
                          {item.changeReason || item.reason || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end shrink-0">
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
