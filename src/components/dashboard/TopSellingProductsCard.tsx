'use client';

import React from 'react';
import Link from 'next/link';

interface ProductRow {
  rank: number;
  name: string;
  totalSold: number;
  revenue: string;
}

const PRODUCTS_DATA: ProductRow[] = [
  { rank: 1, name: 'MollyFoam Ortho 78x72 (6)', totalSold: 152, revenue: 'Rs. 6,840,000' },
  { rank: 2, name: 'MollyFoam Supreme 78x72 (6)', totalSold: 118, revenue: 'Rs. 4,720,000' },
  { rank: 3, name: 'Dura Luxury 78x72 (6)', totalSold: 96, revenue: 'Rs. 3,840,000' },
  { rank: 4, name: 'Dura Cool Air 78x66 (6)', totalSold: 84, revenue: 'Rs. 3,120,000' },
  { rank: 5, name: 'MollyFoam Ultra Slim 78x60 (5)', totalSold: 72, revenue: 'Rs. 2,160,000' },
];

export default function TopSellingProductsCard() {
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

      {/* Table */}
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
            {PRODUCTS_DATA.map((item) => (
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
    </div>
  );
}
