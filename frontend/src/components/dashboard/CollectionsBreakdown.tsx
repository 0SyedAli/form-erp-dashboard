'use client';

import React from 'react';
import { DashboardKPIs } from '@/types';
import { formatPKR } from '@/utils/formatters';
import {
  Banknote,
  Landmark,
  CreditCard,
  FileCheck2,
  Clock,
  ShieldCheck,
  Percent,
  RotateCcw,
} from 'lucide-react';

interface CollectionsBreakdownProps {
  kpis: DashboardKPIs;
  isLoading?: boolean;
}

export default function CollectionsBreakdown({
  kpis,
  isLoading = false,
}: CollectionsBreakdownProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs h-80 animate-pulse">
        <div className="h-4 bg-gray-200 rounded-sm w-44 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-gray-100 rounded-lg" />
          <div className="h-24 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  const collections = kpis.collectionsByMethod;

  const paymentItems = [
    {
      label: 'Cash Collections',
      sub: 'Physical cash received across counters',
      amount: collections.CASH,
      icon: Banknote,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      label: 'Bank Transfer (IBFT/Wire)',
      sub: 'Direct treasury deposit into corporate accounts',
      amount: collections.BANK_TRANSFER,
      icon: Landmark,
      color: 'text-blue-700 bg-blue-50 border-blue-100',
    },
    {
      label: 'PayPak & 1Link Cards',
      sub: 'Debit & credit card POS terminal swipes',
      amount: collections.PAYPAK_CARD,
      icon: CreditCard,
      color: 'text-purple-700 bg-purple-50 border-purple-100',
    },
    {
      label: 'Corporate Cheques',
      sub: 'Cleared crossed cheques from commercial clients',
      amount: collections.CHEQUE,
      icon: FileCheck2,
      color: 'text-slate-700 bg-slate-100 border-slate-200',
    },
    {
      label: '30-Day Credit (Collected Part)',
      sub: 'Commercial trade receivables collected to date',
      amount: collections.CREDIT_30D,
      icon: Clock,
      color: 'text-amber-700 bg-amber-50 border-amber-100',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 sm:p-6 space-y-6">
      {/* SECTION 1: Returns & Discounts Reconciliation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-base">
              Financial Reconciliation: Sales vs Deductions
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Net Revenue = Gross Invoiced - Trade Discounts - Customer Returns
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
            Audit Trail
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Gross */}
          <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Gross Invoiced
            </span>
            <div className="text-base sm:text-lg font-bold text-gray-900">
              {formatPKR(kpis.totalGrossSales)}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 block">Catalogue List Price</span>
          </div>

          {/* Discounts */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Percent className="w-3 h-3 text-amber-600" />
              Discounts Allowed
            </span>
            <div className="text-base sm:text-lg font-bold text-amber-900">
              - {formatPKR(kpis.totalDiscounts)}
            </div>
            <span className="text-[10px] text-amber-700 mt-1 block">Trade & Promotional</span>
          </div>

          {/* Returns */}
          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
            <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider flex items-center gap-1 mb-1">
              <RotateCcw className="w-3 h-3 text-rose-600" />
              Returns Processed
            </span>
            <div className="text-base sm:text-lg font-bold text-rose-900">
              - {formatPKR(kpis.totalReturns)}
            </div>
            <span className="text-[10px] text-rose-700 mt-1 block">Exchanges & Warranty</span>
          </div>

          {/* Net */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1 mb-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Total Net Revenue
            </span>
            <div className="text-base sm:text-lg font-extrabold text-emerald-900">
              {formatPKR(kpis.totalNetSales)}
            </div>
            <span className="text-[10px] text-emerald-700 mt-1 block">Audited Net Realized</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Payment Collections Breakdown */}
      <div className="pt-4 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-base">
                Payment Collections (Cashflow Inflow)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Separated From Sales
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Tracks actual liquidity received vs outstanding credit receivables
            </p>
          </div>

          {/* Pending Receivables Badge */}
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs">
            <span className="text-amber-800 font-medium">Pending Receivables (Credit): </span>
            <strong className="text-amber-900 font-bold">{formatPKR(kpis.pendingReceivables)}</strong>
          </div>
        </div>

        {/* Collections Channels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paymentItems.map((item) => {
            const Icon = item.icon;
            const percentOfCollections =
              kpis.totalCollections > 0
                ? Math.round((item.amount / kpis.totalCollections) * 100)
                : 0;

            return (
              <div
                key={item.label}
                className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-all shadow-2xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg border ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                    {percentOfCollections}%
                  </span>
                </div>
                <div className="text-sm font-bold text-gray-900">{formatPKR(item.amount)}</div>
                <div className="text-xs font-semibold text-gray-700 mt-1">{item.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{item.sub}</div>
              </div>
            );
          })}

          {/* Summary Box */}
          <div className="p-3.5 rounded-xl border border-brand-navy bg-brand-navy text-white flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Total Realized Inflow
              </span>
              <div className="text-xl font-bold mt-1 text-white">
                {formatPKR(kpis.totalCollections)}
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Settled via banks, cards, cheques and cash drawers
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-700/80 text-[10px] text-slate-300 flex items-center justify-between">
              <span>Collection Ratio:</span>
              <strong className="text-emerald-400">
                {kpis.totalNetSales > 0 ? Math.round((kpis.totalCollections / kpis.totalNetSales) * 100) : 0}% of net
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
