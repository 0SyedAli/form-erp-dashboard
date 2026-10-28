'use client';

import React from 'react';
import { DashboardKPIs } from '@/types';
import { formatPKR } from '@/utils/formatters';
import { ShoppingBag, Building } from 'lucide-react';

interface RetailWholesaleChartProps {
  kpis: DashboardKPIs;
  isLoading?: boolean;
}

export default function RetailWholesaleChart({
  kpis,
  isLoading = false,
}: RetailWholesaleChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs h-80 flex items-center justify-center animate-pulse">
        <div className="text-xs text-gray-400">Loading channel distribution...</div>
      </div>
    );
  }

  const retailPercent = kpis.retailRevenuePercent;
  const wholesalePercent = kpis.wholesaleRevenuePercent;

  const avgRetailOrder =
    kpis.retailInvoicesCount > 0
      ? Math.round(kpis.retailRevenue / kpis.retailInvoicesCount)
      : 0;
  const avgWholesaleOrder =
    kpis.wholesaleInvoicesCount > 0
      ? Math.round(kpis.wholesaleRevenue / kpis.wholesaleInvoicesCount)
      : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Channel Revenue Share</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Comparative analysis of direct retail consumers vs bulk dealer orders
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
            Distribution
          </span>
        </div>

        {/* Visual Dual Progress Bar */}
        <div className="my-5">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="flex items-center gap-1.5 text-brand-red">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-red" />
              Retail ({retailPercent}%)
            </span>
            <span className="flex items-center gap-1.5 text-brand-navy">
              Wholesale ({wholesalePercent}%)
              <span className="w-2.5 h-2.5 rounded-full bg-brand-navy" />
            </span>
          </div>

          <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${retailPercent}%` }}
              className="bg-brand-red h-full transition-all duration-500"
              title={`Retail: ${retailPercent}%`}
            />
            <div
              style={{ width: `${wholesalePercent}%` }}
              className="bg-brand-navy h-full transition-all duration-500"
              title={`Wholesale: ${wholesalePercent}%`}
            />
          </div>
        </div>

        {/* Channel Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-6">
          {/* Retail Box */}
          <div className="p-4 rounded-xl border border-red-100 bg-red-50/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-brand-red" />
                Retail Channel
              </span>
              <span className="text-xs font-semibold text-brand-red bg-white px-2 py-0.5 rounded-md border border-red-200">
                {retailPercent}%
              </span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatPKR(kpis.retailRevenue)}
            </div>
            <div className="mt-3 pt-2.5 border-t border-red-100/80 flex items-center justify-between text-[11px] text-gray-600">
              <span>Invoices: <strong className="text-gray-900 font-semibold">{kpis.retailInvoicesCount}</strong></span>
              <span>Avg: <strong className="text-gray-900 font-semibold">{formatPKR(avgRetailOrder, true)}</strong></span>
            </div>
          </div>

          {/* Wholesale Box */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-brand-navy" />
                Wholesale B2B
              </span>
              <span className="text-xs font-semibold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {wholesalePercent}%
              </span>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatPKR(kpis.wholesaleRevenue)}
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-gray-600">
              <span>Invoices: <strong className="text-gray-900 font-semibold">{kpis.wholesaleInvoicesCount}</strong></span>
              <span>Avg: <strong className="text-gray-900 font-semibold">{formatPKR(avgWholesaleOrder, true)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Insight */}
      <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
        <span>Average Order Value: <strong className="text-gray-800">{formatPKR(kpis.averageOrderValue)}</strong></span>
        <span className="text-slate-400">NTN & tax recorded for B2B orders</span>
      </div>
    </div>
  );
}
