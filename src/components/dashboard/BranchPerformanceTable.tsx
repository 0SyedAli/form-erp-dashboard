'use client';

import React from 'react';
import Link from 'next/link';
import { BranchPerformanceMetric } from '@/types';
import { formatPKR } from '@/utils/formatters';
import { Building2, ArrowUpRight } from 'lucide-react';

interface BranchPerformanceTableProps {
  branches: BranchPerformanceMetric[];
  isLoading?: boolean;
}

export default function BranchPerformanceTable({
  branches,
  isLoading = false,
}: BranchPerformanceTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs animate-pulse">
        <div className="h-4 bg-gray-200 rounded-sm w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
      {/* Table Header */}
      <div className="p-5 sm:p-6 border-b border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-base">Branch Performance Matrix</h3>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              5 Active Nodes
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-0.5 font-normal">
            Comparative revenue delivery, sales targets, and channel split across branch hubs
          </p>
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-[13px] font-semibold text-gray-600">
              <th className="py-3.5 px-4 sm:px-6">Branch Hub</th>
              <th className="py-3.5 px-4">Net Revenue</th>
              <th className="py-3.5 px-4">Retail / Wholesale</th>
              <th className="py-3.5 px-4">Monthly Target</th>
              <th className="py-3.5 px-4">Target %</th>
              <th className="py-3.5 px-4 text-center">Invoices</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Drilldown</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm font-normal text-gray-700">
            {branches.map((b) => {
              const isOverTarget = b.achievementPercentage >= 100;

              return (
                <tr
                  key={b.branchId}
                  className="hover:bg-gray-50/70 transition-colors"
                >
                  {/* Branch Details */}
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-semibold shrink-0">
                        <Building2 className="w-4 h-4 text-brand-navy" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-1.5 text-sm">
                          {b.branchName}
                        </div>
                        <span className="text-[13px] text-gray-500 font-normal">
                          {b.branchCode} • {b.city}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Net Revenue */}
                  <td className="py-4 px-4 font-semibold text-gray-900 text-sm">
                    {formatPKR(b.netSales)}
                  </td>

                  {/* Channel Split */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 text-[13px] font-normal">
                      <span className="text-brand-red font-medium" title="Retail">
                        R: {formatPKR(b.retailSales, true)}
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-brand-navy font-medium" title="Wholesale">
                        W: {formatPKR(b.wholesaleSales, true)}
                      </span>
                    </div>
                  </td>

                  {/* Monthly Target */}
                  <td className="py-4 px-4 text-gray-600 font-normal text-sm">
                    {formatPKR(b.targetMonthlySales, true)}
                  </td>

                  {/* Target Achievement Bar */}
                  <td className="py-4 px-4 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(b.achievementPercentage, 100)}%` }}
                          className={`h-full rounded-full transition-all ${
                            isOverTarget
                              ? 'bg-emerald-500'
                              : b.achievementPercentage > 60
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          isOverTarget ? 'text-emerald-700' : 'text-gray-700'
                        }`}
                      >
                        {b.achievementPercentage}%
                      </span>
                    </div>
                  </td>

                  {/* Invoices Count */}
                  <td className="py-4 px-4 text-center font-medium text-gray-800 text-sm">
                    {b.invoiceCount}
                  </td>

                  {/* Action Link */}
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <Link
                      href={`/branch/dashboard?branchId=${b.branchId}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-medium text-brand-navy bg-slate-100 hover:bg-brand-navy hover:text-white transition-colors cursor-pointer"
                      title={`Open ${b.branchName} dashboard`}
                    >
                      <span>Drilldown</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
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
