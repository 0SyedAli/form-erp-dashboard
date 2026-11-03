'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetInventoryBalancesQuery,
  useGetBranchesQuery,
  useGetInventoryDashboardKPIsQuery,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import {
  DollarSign,
  AlertTriangle,
  History,
  Printer,
} from 'lucide-react';

export default function InventoryReportsPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? 'all' : (currentUser?.assignedBranchId || 'all')
  );

  const [activeReportTab, setActiveReportTab] = useState<'valuation' | 'lowstock' | 'movement'>(
    'valuation'
  );

  const activeBranchFilter = selectedBranchId === 'all' ? undefined : selectedBranchId;
  const { data: balances = [] } = useGetInventoryBalancesQuery({
    branchId: activeBranchFilter,
  });
  const { data: kpis } = useGetInventoryDashboardKPIsQuery(activeBranchFilter);

  // Valuation computations
  const valuedBalances = balances.filter((b) => b.unitCost !== undefined && b.unitCost > 0);
  const unvaluedBalances = balances.filter((b) => !b.unitCost || b.unitCost <= 0);
  const totalValuation = valuedBalances.reduce((s, b) => s + (b.unitCost! * b.onHand), 0);

  // Low stock list
  const lowStockItems = balances.filter((b) => b.stockStatus === 'LOW_STOCK' || b.stockStatus === 'OUT_OF_STOCK');

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout title="Inventory Reports" subtitle="Valuation, Stockout Risk & Movement Turnover Intelligence">
      <InventoryNavTabs branchId={activeBranchFilter} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs print:hidden">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Inventory & Valuation Intelligence Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Compliant asset reporting based strictly on verified procurement unit costs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Branch selector */}
            <select
              aria-label="Filter report by branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-hidden focus:border-brand-blue"
            >
              {isSuperAdmin && <option value="all">Consolidated (All Branches)</option>}
              {authorizedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-gray-500" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Report Category Switcher */}
        <div className="flex border-b border-gray-200 bg-white px-5 pt-3 rounded-t-xl border border-gray-200/80 shadow-2xs print:hidden">
          <button
            onClick={() => setActiveReportTab('valuation')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeReportTab === 'valuation'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Inventory Valuation Report</span>
          </button>

          <button
            onClick={() => setActiveReportTab('lowstock')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeReportTab === 'lowstock'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Stockout Risk & Reorder Analysis</span>
          </button>

          <button
            onClick={() => setActiveReportTab('movement')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeReportTab === 'movement'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Turnover & Movement Frequency</span>
          </button>
        </div>

        {/* Report Content */}
        {activeReportTab === 'valuation' && (
          <div className="space-y-6">
            {/* Valuation Metric Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  Total Valuation (Asset Cost)
                </span>
                <span className="text-2xl font-bold text-gray-900 mt-2 block">
                  PKR {Math.round(totalValuation).toLocaleString()}
                </span>
                <p className="text-xs text-gray-500 mt-1">Computed from recorded procurement cost</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  Valued Inventory Units
                </span>
                <span className="text-2xl font-bold text-emerald-600 mt-2 block">
                  {valuedBalances.reduce((s, b) => s + b.onHand, 0).toLocaleString()} units
                </span>
                <p className="text-xs text-gray-500 mt-1">{valuedBalances.length} active SKUs with unit costs</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  Unvalued Units (Missing Cost Data)
                </span>
                <span className="text-2xl font-bold text-amber-600 mt-2 block">
                  {unvaluedBalances.reduce((s, b) => s + b.onHand, 0).toLocaleString()} units
                </span>
                <p className="text-xs text-amber-700 mt-1">Excluded to prevent fictional asset inflation</p>
              </div>
            </div>

            {/* Valuation Breakdown Table */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">SKU-Wise Asset Valuation Schedule</h3>
                <span className="text-xs text-gray-500">{balances.length} SKU items in scope</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4">Product Name & Spec</th>
                      <th className="py-2.5 px-4">Brand</th>
                      <th className="py-2.5 px-3 text-center">On Hand Units</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost (PKR)</th>
                      <th className="py-2.5 px-4 text-right">Total Asset Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {balances.map((item) => {
                      const hasCost = item.unitCost !== undefined && item.unitCost > 0;
                      const lineValue = hasCost ? item.unitCost! * item.onHand : null;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-4 font-mono font-bold text-gray-900 text-xs">{item.sku}</td>
                          <td className="py-2.5 px-4">
                            <p className="font-semibold text-gray-800 text-xs">{item.productName}</p>
                            <p className="text-[11px] text-gray-500">{item.sizeLabel} ({item.thicknessInches}&quot;)</p>
                          </td>
                          <td className="py-2.5 px-4 text-xs font-semibold text-gray-700">{item.brandName}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-gray-900">{item.onHand}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-gray-700">
                            {hasCost ? `PKR ${item.unitCost!.toLocaleString()}` : (
                              <span className="text-xs text-amber-600 italic">Unavailable</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                            {lineValue !== null ? `PKR ${Math.round(lineValue).toLocaleString()}` : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Low Stock Risk Report */}
        {activeReportTab === 'lowstock' && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-amber-50/50 border-b border-amber-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-amber-900 text-sm">Replenishment Priority Schedule</h3>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Items currently requiring purchase orders or stock transfers from Wholesale Depot.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
                {lowStockItems.length} at risk
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-3 text-center">On Hand</th>
                    <th className="py-3 px-3 text-center">Reorder Level</th>
                    <th className="py-3 px-3 text-center">Deficit</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No SKUs are currently below reorder levels.
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((item) => {
                      const deficit = Math.max(0, item.reorderLevel - item.onHand);
                      return (
                        <tr key={item.id} className="hover:bg-amber-50/20">
                          <td className="py-3 px-4 font-mono font-bold text-gray-900 text-xs">{item.sku}</td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-gray-900 text-xs">{item.productName}</p>
                            <p className="text-[11px] text-gray-500">{item.sizeLabel}</p>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-red-600">{item.onHand}</td>
                          <td className="py-3 px-3 text-center font-semibold text-gray-700">{item.reorderLevel}</td>
                          <td className="py-3 px-3 text-center font-bold text-amber-700">+{deficit} needed</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                                item.stockStatus === 'OUT_OF_STOCK'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.stockStatus.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Movement Turnover Report */}
        {activeReportTab === 'movement' && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm">Frequently Moving Mattress SKUs</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Top products ranked by cumulative ledger transactions and physical velocity.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {kpis?.frequentlyMovingSKUs && kpis.frequentlyMovingSKUs.length > 0 ? (
                kpis.frequentlyMovingSKUs.map((item, index) => (
                  <div key={item.sku} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-brand-blue font-bold text-xs flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-mono font-bold text-gray-900 text-sm">{item.sku}</p>
                        <p className="text-xs text-gray-500">{item.productName}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-brand-blue text-sm">
                        {item.movementCount} transactions
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.totalQuantityMoved} units moved
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-gray-500 text-sm">
                  No movement velocity data available.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
