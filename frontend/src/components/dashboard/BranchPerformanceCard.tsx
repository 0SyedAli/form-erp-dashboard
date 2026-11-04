'use client';

import React from 'react';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { useGetBranchesQuery } from '@/store/services/catalogueApi';

interface BranchPerformanceRow {
  id: string;
  name: string;
  revenue: string;
  orders: number;
  growth: string;
}

export default function BranchPerformanceCard() {
  const { data: branches = [] } = useGetBranchesQuery();

  const performanceRows: BranchPerformanceRow[] = branches.map((b) => ({
    id: b.id,
    name: b.name,
    revenue: 'Rs. 0',
    orders: 0,
    growth: '0%',
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Branch Performance
        </h3>
        <Link
          href="/admin/branches"
          className="text-xs font-semibold text-brand-blue hover:underline"
        >
          View All
        </Link>
      </div>

      {/* Table or Clean Empty State */}
      {performanceRows.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-700">No branches configured</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Configure branches in Admin &gt; Branches to monitor real-time performance.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold text-[11px]">
                <th className="py-2.5 px-4">Branch</th>
                <th className="py-2.5 px-4 text-right">Revenue</th>
                <th className="py-2.5 px-4 text-center">Orders</th>
                <th className="py-2.5 px-4 text-right">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {performanceRows.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {item.name}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">
                    {item.revenue}
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-gray-700">
                    {item.orders}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-500">
                    {item.growth}
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
