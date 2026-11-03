'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useGetBranchesQuery } from '@/store/services/apiSlice';

interface BranchPerformanceRow {
  id: string;
  name: string;
  revenue: string;
  orders: number;
  growth: string;
}

const DEFAULT_METRICS: Record<string, { revenue: string; orders: number; growth: string }> = {
  'BR-MAIN-01': { revenue: 'Rs. 4,250,000', orders: 420, growth: '+15%' },
  'BR-DISP-02': { revenue: 'Rs. 3,230,000', orders: 310, growth: '+12%' },
  'BR-WS-03': { revenue: 'Rs. 2,180,000', orders: 210, growth: '+8%' },
  'BR-ORTH-04': { revenue: 'Rs. 1,720,000', orders: 185, growth: '+20%' },
  'BR-EXPR-05': { revenue: 'Rs. 1,070,000', orders: 120, growth: '+6%' },
};

export default function BranchPerformanceCard() {
  const { data: branches = [] } = useGetBranchesQuery();

  const performanceRows: BranchPerformanceRow[] = branches.map((b) => {
    const metric = DEFAULT_METRICS[b.id] || {
      revenue: 'Rs. 0',
      orders: 0,
      growth: '0%',
    };
    return {
      id: b.id,
      name: b.name,
      revenue: metric.revenue,
      orders: metric.orders,
      growth: metric.growth,
    };
  });

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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 font-semibold text-[11px]">
              <th className="py-2.5 px-4">Branch</th>
              <th className="py-2.5 px-4">Revenue</th>
              <th className="py-2.5 px-4 text-center">Orders</th>
              <th className="py-2.5 px-4 text-right">Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-700">
            {performanceRows.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="py-3 px-4 font-semibold text-gray-900">
                  <Link
                    href={`/branch/dashboard?branchId=${item.id}`}
                    className="hover:text-brand-blue transition-colors"
                  >
                    {item.name}
                  </Link>
                </td>
                <td className="py-3 px-4 font-bold text-gray-900">
                  {item.revenue}
                </td>
                <td className="py-3 px-4 text-center font-medium text-gray-700">
                  {item.orders}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                    {item.growth}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
