'use client';

import React from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';

interface ProductItem {
  name: string;
  sold: number;
}

const TOP_PRODUCTS: ProductItem[] = [
  { name: 'Ortho Mattress 78x72 (6)', sold: 42 },
  { name: 'Supreme Mattress 78x72 (6)', sold: 36 },
  { name: 'Dura Luxury 78x72 (6)', sold: 28 },
  { name: 'Dura Cool Air 78x66 (6)', sold: 24 },
  { name: 'Ultra Slim 78x60 (5)', sold: 18 },
];

export default function BranchTopProductsCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Top Products (This Month)
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
              <th className="py-2.5 px-4">Product</th>
              <th className="py-2.5 px-4 text-right">Sold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-700">
            {TOP_PRODUCTS.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue font-bold shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-gray-900">
                      {item.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">
                  {item.sold}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
