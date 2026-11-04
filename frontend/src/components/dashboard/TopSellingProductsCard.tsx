'use client';

import React from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';

export interface TopProductRow {
  rank: number;
  name: string;
  totalSold: number;
  revenue: string;
}

interface TopSellingProductsCardProps {
  products?: TopProductRow[];
}

export default function TopSellingProductsCard({ products = [] }: TopSellingProductsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Top Selling Products
        </h3>
        <Link
          href="/products"
          className="text-xs font-semibold text-brand-blue hover:underline"
        >
          View All
        </Link>
      </div>

      {/* Table or Clean Empty State */}
      {products.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-700">No sales recorded yet</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Top-selling products will populate as sales invoices are generated.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold text-[11px]">
                <th className="py-2.5 px-4 w-10">#</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4 text-center">Total Sold</th>
                <th className="py-2.5 px-4 text-right">Revenue (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {products.map((item) => (
                <tr key={item.rank} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 text-gray-400 font-medium">
                    {item.rank}
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {item.name}
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-gray-700">
                    {item.totalSold}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">
                    {item.revenue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
