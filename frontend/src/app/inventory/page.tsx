'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetInventoryDashboardKPIsQuery,
  useGetBranchesQuery,
  useGetInventoryBalancesQuery,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import {
  Boxes,
  MapPin,
  AlertTriangle,
  XCircle,
  ArrowLeftRight,
  TrendingUp,
  ShieldAlert,
  DollarSign,
  ArrowDownToLine,
  ChevronRight,
  Clock,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const BRAND_COLORS = ['#1877F2', '#0E1726', '#D32F2F', '#10B981', '#F59E0B', '#8B5CF6'];

export default function InventoryOverviewPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);

  // Super Admin can view all or filter by branch; Branch Managers are scoped to their branch
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const defaultBranchId = isSuperAdmin ? 'all' : (currentUser?.assignedBranchId || 'all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);

  const activeBranchFilter = selectedBranchId === 'all' ? undefined : selectedBranchId;
  const { data: kpis, isLoading: isKPIsLoading } = useGetInventoryDashboardKPIsQuery(activeBranchFilter);
  const { data: lowStockBalances = [] } = useGetInventoryBalancesQuery({
    branchId: activeBranchFilter,
    lowStockOnly: true,
  });

  return (
    <AppLayout title="Inventory Management" subtitle="Multi-Branch Real-Time Stock Tracking & Movements">
      <InventoryNavTabs branchId={activeBranchFilter} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header & Branch Context Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Stock Intelligence Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Consolidated real-time inventory balances, in-transit transfers, and audit logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Selector */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
              <label htmlFor="inventory-branch-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Branch:
              </label>
              <select
                id="inventory-branch-select"
                aria-label="Filter inventory by branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-900 focus:outline-hidden cursor-pointer"
              >
                {isSuperAdmin && <option value="all">Consolidated (All Branches)</option>}
                {authorizedBranches.map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Inward Action */}
            <Link
              href="/inventory/receiving"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-medium rounded-lg shadow-2xs transition-colors"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Receive Stock</span>
            </Link>

            {/* Quick Transfer Action */}
            <Link
              href="/inventory/transfers"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-medium rounded-lg shadow-2xs transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4 text-gray-500" />
              <span>Transfer</span>
            </Link>
          </div>
        </div>

        {/* 8 Primary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Stock Units */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Stock Units
              </span>
              <div className="p-2 bg-blue-50 text-brand-blue rounded-lg">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                {isKPIsLoading ? '...' : (kpis?.totalStockUnits ?? 0).toLocaleString()}
              </span>
              <p className="text-xs text-gray-500 mt-1">Saleable units on hand across locations</p>
            </div>
          </div>

          {/* 2. Stock Locations */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stock Locations
              </span>
              <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                <MapPin className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                {isKPIsLoading ? '...' : (kpis?.totalLocations ?? 0)}
              </span>
              <p className="text-xs text-gray-500 mt-1">Active retail stockrooms & depot bays</p>
            </div>
          </div>

          {/* 3. Low Stock SKUs */}
          <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                Low Stock SKUs
              </span>
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold text-amber-700">
                {isKPIsLoading ? '...' : (kpis?.lowStockSKUs ?? 0)}
              </span>
              <p className="text-xs text-amber-800/80 mt-1">Below defined reorder threshold</p>
            </div>
          </div>

          {/* 4. Out of Stock SKUs */}
          <div className="bg-white p-5 rounded-xl border border-red-200 bg-red-50/20 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                Out of Stock SKUs
              </span>
              <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold text-red-700">
                {isKPIsLoading ? '...' : (kpis?.outOfStockSKUs ?? 0)}
              </span>
              <p className="text-xs text-red-800/80 mt-1">0 balance at selected location</p>
            </div>
          </div>

          {/* 5. Pending Transfers */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Pending Transfers
              </span>
              <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                {isKPIsLoading ? '...' : (kpis?.pendingTransfers ?? 0)}
              </span>
              <p className="text-xs text-gray-500 mt-1">Awaiting dispatch approval</p>
            </div>
          </div>

          {/* 6. Stock Received This Month */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Received This Month
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                {isKPIsLoading ? '...' : (kpis?.stockReceivedThisMonth ?? 0).toLocaleString()}
              </span>
              <p className="text-xs text-gray-500 mt-1">Inward receipts logged</p>
            </div>
          </div>

          {/* 7. Damaged Stock Units */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Damaged / Quarantine
              </span>
              <div className="p-2 bg-rose-50 text-rose-700 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold text-rose-700">
                {isKPIsLoading ? '...' : (kpis?.damagedStockUnits ?? 0).toLocaleString()}
              </span>
              <p className="text-xs text-gray-500 mt-1">Segregated from saleable inventory</p>
            </div>
          </div>

          {/* 8. Inventory Valuation (Section 6 Requirement: based only on reliable cost data) */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Inventory Valuation
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              {kpis?.valuation?.isValuationAvailable && kpis.valuation.totalValue !== null ? (
                <>
                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                    PKR {Math.round(kpis.valuation.totalValue).toLocaleString()}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Based on recorded actual unit costs
                    {kpis.valuation.hasUnvaluedItems && (
                      <span className="text-amber-600 block">
                        ({kpis.valuation.unvaluedUnitsCount} units without recorded cost omitted)
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-lg font-bold text-gray-400">Valuation Unavailable</span>
                  <p className="text-xs text-amber-700 mt-1">
                    Requires recorded procurement unit costs
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Branch Distribution Bar Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Stock Distribution by Branch</h3>
                <p className="text-xs text-gray-500">Total units vs available units per facility</p>
              </div>
              <Link
                href="/inventory/stock"
                className="text-xs font-semibold text-brand-blue hover:underline flex items-center gap-1"
              >
                <span>View Full Matrix</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="h-64 w-full">
              {kpis?.branchDistribution && kpis.branchDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpis.branchDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <XAxis
                      dataKey="branchCode"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip
                      formatter={(val, name) => [`${val} units`, name === 'totalUnits' ? 'On Hand' : 'Available']}
                      labelFormatter={(label) => `Location: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="totalUnits" fill="#1877F2" name="On Hand Units" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="availableUnits" fill="#10B981" name="Available Units" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  No stock distribution data
                </div>
              )}
            </div>
          </div>

          {/* Brand Breakdown Donut Chart */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-gray-900">Stock by Brand</h3>
                <p className="text-xs text-gray-500">Inventory share across brands</p>
              </div>
            </div>

            <div className="h-52 w-full flex items-center justify-center">
              {kpis?.brandDistribution && kpis.brandDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kpis.brandDistribution}
                      dataKey="totalUnits"
                      nameKey="brandName"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {kpis.brandDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name) => [`${val} units`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-gray-400 text-sm">No brand stock data</div>
              )}
            </div>

            {/* Brand Legend list */}
            <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-3">
              {kpis?.brandDistribution?.map((item, index) => (
                <div key={item.brandName} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: BRAND_COLORS[index % BRAND_COLORS.length] }}
                    />
                    <span className="font-medium text-gray-700">{item.brandName}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {item.totalUnits} units ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tables & Activity Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Items Alert Table */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-gray-900">Low Stock Replenishment Alerts</h3>
              </div>
              <Link
                href="/inventory/stock?lowStock=true"
                className="text-xs font-semibold text-brand-blue hover:underline"
              >
                View All Low Stock
              </Link>
            </div>

            {lowStockBalances.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                All inventory levels are above safe reorder thresholds.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-y border-gray-200/60">
                    <tr>
                      <th className="py-2.5 px-3">SKU / Product</th>
                      <th className="py-2.5 px-3 text-center">On Hand</th>
                      <th className="py-2.5 px-3 text-center">Reorder Level</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lowStockBalances.slice(0, 5).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-gray-900 text-xs">{item.sku}</p>
                          <p className="text-[11px] text-gray-500 truncate max-w-[180px]">
                            {item.productName} ({item.sizeLabel})
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-red-50 text-red-700">
                            {item.onHand}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-gray-600">
                          {item.reorderLevel}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={`/inventory/transfers?sku=${encodeURIComponent(item.sku)}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:text-brand-blue-hover"
                          >
                            <span>Request Transfer</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Stock Movements Feed */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                <h3 className="text-base font-bold text-gray-900">Recent Movement Ledger Activity</h3>
              </div>
              <Link
                href="/inventory/movements"
                className="text-xs font-semibold text-brand-blue hover:underline"
              >
                View Full Ledger
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {kpis?.recentMovements && kpis.recentMovements.length > 0 ? (
                kpis.recentMovements.slice(0, 5).map((mov) => {
                  const isPositive =
                    mov.movementType === 'STOCK_RECEIPT' ||
                    mov.movementType === 'TRANSFER_RECEIPT' ||
                    mov.movementType === 'OPENING_BALANCE' ||
                    mov.movementType === 'ADJUSTMENT_IN' ||
                    mov.movementType === 'RETURN_TO_SALEABLE';

                  return (
                    <div key={mov.id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              mov.movementType === 'STOCK_RECEIPT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : mov.movementType === 'DAMAGED_STOCK'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : mov.movementType.includes('TRANSFER')
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {mov.movementType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-bold text-gray-900">{mov.sku}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Ref: <span className="font-mono text-gray-700">{mov.documentReference}</span> • By {mov.createdBy}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-sm font-bold ${
                            isPositive ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? `+${mov.quantity}` : `-${mov.quantity}`} units
                        </span>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(mov.timestamp).toLocaleDateString('en-PK', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-sm text-gray-500">
                  No stock movements recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
