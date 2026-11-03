'use client';

import React from 'react';
import { Product } from '@/types';
import { formatPKR } from '@/utils/formatters';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface InventorySnapshotCardProps {
  branchId: string;
  branchName: string;
  products: Product[];
  isLoading?: boolean;
}

export default function InventorySnapshotCard({
  branchId,
  branchName,
  products,
  isLoading = false,
}: InventorySnapshotCardProps) {
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
            <h3 className="font-bold text-gray-900 text-base">
              Available Stock Snapshot ({branchName})
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Shared Catalogue
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Physical inventory on floor & back-store ready for retail and wholesale dispatch
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="py-3 px-4 sm:px-6">Product / SKU</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Retail / Wholesale Price</th>
              <th className="py-3 px-4 text-center">In Stock</th>
              <th className="py-3 px-4 text-center">Min Buffer</th>
              <th className="py-3 px-4 sm:px-6 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {products.map((p) => {
              const stock = p.stockByBranch[branchId] ?? 0;
              const isLow = stock <= p.minThreshold;

              return (
                <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-4 sm:px-6">
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <span className="text-[10px] font-mono text-gray-400">
                      {p.sku} • {p.dimensions}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                      {p.category}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="text-[11px]">
                      <span className="text-gray-900 font-semibold">{formatPKR(p.retailPrice)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-blue-700 font-medium">{formatPKR(p.wholesalePrice)}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center font-bold text-gray-900 text-sm">
                    {stock}
                  </td>

                  <td className="py-3 px-4 text-center text-gray-500 font-medium">
                    {p.minThreshold}
                  </td>

                  <td className="py-3 px-4 sm:px-6 text-right">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        LOW STOCK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        IN STOCK
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
