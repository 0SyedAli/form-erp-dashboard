'use client';

import React from 'react';
import { TopProductMetric } from '@/types';
import { formatPKR } from '@/utils/formatters';
import { Package, AlertTriangle } from 'lucide-react';

interface TopProductsTableProps {
  products: TopProductMetric[];
  branchName?: string;
  isLoading?: boolean;
}

export default function TopProductsTable({
  products,
  branchName,
  isLoading = false,
}: TopProductsTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs animate-pulse">
        <div className="h-4 bg-gray-200 rounded-sm w-44 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-gray-200/80 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-base">Top Performing Products</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-brand-red border border-red-100">
              Shared Catalogue
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {branchName ? `Best-sellers at ${branchName}` : 'Consolidated sales volume across all product lines'}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="py-3 px-4 sm:px-6">Product / SKU</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-center">Units Sold</th>
              <th className="py-3 px-4">Total Revenue</th>
              <th className="py-3 px-4 sm:px-6 text-right">Stock Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
            {products.slice(0, 6).map((prod, idx) => {
              const isLowStock =
                prod.stockRemainingInBranch !== undefined
                  ? prod.stockRemainingInBranch < 15
                  : prod.totalCatalogueStock < 60;

              return (
                <tr key={prod.productId} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold text-gray-400">
                        #{idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-brand-red flex items-center justify-center font-bold text-xs shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 hover:text-brand-red cursor-pointer">
                          {prod.name}
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">
                          {prod.sku}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                      {prod.category}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center font-bold text-gray-900">
                    {prod.unitsSold}
                  </td>

                  <td className="py-3 px-4 font-bold text-gray-900">
                    {formatPKR(prod.totalRevenue)}
                  </td>

                  <td className="py-3 px-4 sm:px-6 text-right">
                    {prod.stockRemainingInBranch !== undefined ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isLowStock
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                        {prod.stockRemainingInBranch} units in branch
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {prod.totalCatalogueStock} in network
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
