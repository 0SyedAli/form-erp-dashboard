'use client';

import React, { useState, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector, RootState } from '@/store';
import {
  DatePreset,
  useGetSalesSummaryQuery,
  useGetSalesTrendsQuery,
  useGetSalesByBranchQuery,
  useGetReceivablesSummaryQuery,
  useGetReceivablesAgingQuery,
  useGetCollectionsSummaryQuery,
  useGetInventorySummaryQuery,
  useGetInventoryLowStockQuery,
  useGetInventoryValuationQuery,
  useGetPurchasingSummaryQuery,
  useGetPayablesSummaryQuery,
  useGetPayablesAgingQuery,
  useGetReconciliationAuditQuery,
} from '@/store/services/reportsApi';
import { useGetBranchesQuery } from '@/store/services/catalogueApi';
import {
  Banknote,
  ShoppingCart,
  Receipt,
  Calendar,
  ChevronDown,
  Truck,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileText,
  BarChart3,
  ShieldCheck,
  Building2,
  DollarSign,
  Package,
  Layers,
  ArrowDownToLine,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#881337', '#0284c7', '#16a34a', '#d97706', '#9333ea', '#64748b'];

function ReportsDashboardContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'receivables' | 'inventory' | 'purchasing' | 'reconciliation'>('sales');
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('thisMonth');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: branches = [] } = useGetBranchesQuery(undefined, { skip: !mounted });

  const queryParams = {
    preset: selectedPreset,
    branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
  };

  // Queries
  const { data: salesSummary, isLoading: salesLoading, refetch: refetchSales } = useGetSalesSummaryQuery(queryParams, { skip: !mounted });
  const { data: salesTrends } = useGetSalesTrendsQuery(queryParams, { skip: !mounted });
  const { data: branchSales } = useGetSalesByBranchQuery(queryParams, { skip: !mounted || !isSuperAdmin });

  const { data: receivablesSummary, isLoading: recLoading, refetch: refetchRec } = useGetReceivablesSummaryQuery(undefined, { skip: !mounted });
  const { data: receivablesAging } = useGetReceivablesAgingQuery(undefined, { skip: !mounted });
  const { data: collectionsSummary } = useGetCollectionsSummaryQuery(queryParams, { skip: !mounted });

  const { data: inventorySummary, isLoading: invLoading, refetch: refetchInv } = useGetInventorySummaryQuery(queryParams, { skip: !mounted });
  const { data: lowStockData } = useGetInventoryLowStockQuery(queryParams, { skip: !mounted });
  const { data: valuationData } = useGetInventoryValuationQuery(undefined, { skip: !mounted || !isSuperAdmin });

  const { data: purchasingSummary, isLoading: purLoading, refetch: refetchPurchasing } = useGetPurchasingSummaryQuery(queryParams, { skip: !mounted });
  const { data: payablesSummary } = useGetPayablesSummaryQuery(queryParams, { skip: !mounted || !isSuperAdmin });
  const { data: payablesAging } = useGetPayablesAgingQuery(queryParams, { skip: !mounted || !isSuperAdmin });

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useGetReconciliationAuditQuery(undefined, {
    skip: !mounted || !isSuperAdmin || activeTab !== 'reconciliation',
  });

  const handleRefreshAll = () => {
    refetchSales();
    refetchRec();
    refetchInv();
    refetchPurchasing();
    if (isSuperAdmin) refetchAudit();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-50 text-rose-800">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight font-sans">
                Business Reports & Financial Intelligence
              </h1>
            </div>
            <p className="text-sm text-gray-500 mt-1 font-sans">
              Real-time multi-branch operational analytics & verified ledger reconciliations
            </p>
          </div>

          {/* Controls: Date Range & Branch Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Preset Selector */}
            <div className="relative">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value as DatePreset)}
                className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-hidden cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="all">All Time</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Branch Selector (Super Admin only) */}
            {isSuperAdmin && (
              <div className="relative">
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.name} ({b.shopNumber || b.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleRefreshAll}
              title="Refresh reports"
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 shadow-2xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-1 overflow-x-auto text-sm font-medium">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'sales'
                ? 'bg-rose-900 text-white font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Banknote className="w-4 h-4" />
            Sales & Revenue
          </button>

          <button
            onClick={() => setActiveTab('receivables')}
            className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'receivables'
                ? 'bg-rose-900 text-white font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Receivables & Collections
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-rose-900 text-white font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Package className="w-4 h-4" />
            Inventory & Valuation
          </button>

          <button
            onClick={() => setActiveTab('purchasing')}
            className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'purchasing'
                ? 'bg-rose-900 text-white font-semibold shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            Purchasing & Payables
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'reconciliation'
                  ? 'bg-rose-900 text-white font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Reconciliation Audit
            </button>
          )}
        </div>

        {/* ========================================================
            TAB 1: SALES & REVENUE
           ======================================================== */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            {/* Sales KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Net Revenue</span>
                <span className="text-2xl font-bold text-gray-900 block mt-1">
                  Rs. {(salesSummary?.netSales || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  Gross: Rs. {(salesSummary?.grossSales || 0).toLocaleString()} (Discounts: Rs. {(salesSummary?.discounts || 0).toLocaleString()})
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Invoices Count</span>
                <span className="text-2xl font-bold text-blue-900 block mt-1">
                  {(salesSummary?.invoiceCount || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  Average Ticket: Rs. {(salesSummary?.averageInvoiceValue || 0).toLocaleString()}
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Collected at POS</span>
                <span className="text-2xl font-bold text-emerald-800 block mt-1">
                  Rs. {(salesSummary?.collectedAmount || 0).toLocaleString()}
                </span>
                <span className="text-xs text-emerald-600 font-medium block mt-1">Immediate cash & bank collections</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Credit Created</span>
                <span className="text-2xl font-bold text-rose-700 block mt-1">
                  Rs. {(salesSummary?.outstandingCredit || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 block mt-1">Credit sales awaiting recovery</span>
              </div>
            </div>

            {/* Sales Trends Chart */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <h3 className="text-base font-bold text-gray-900 mb-4 font-sans flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-800" />
                Revenue Trend Over Period
              </h3>
              <div className="h-72 w-full">
                {salesTrends?.trends && salesTrends.trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesTrends.trends} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `Rs. ${(val / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(val: any) => [`Rs. ${Number(val).toLocaleString()}`, 'Net Sales']}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Bar dataKey="netSales" fill="#881337" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    No sales data recorded for the selected period
                  </div>
                )}
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            {salesSummary?.paymentMethods && salesSummary.paymentMethods.length > 0 && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <h3 className="text-base font-bold text-gray-900 mb-4 font-sans">Payment Methods Distribution</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {salesSummary.paymentMethods.map((pm: any) => (
                    <div key={pm.method} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-xs font-semibold text-gray-600 block uppercase">{pm.method}</span>
                      <span className="text-lg font-bold text-gray-900 block mt-1">
                        Rs. {(pm.totalAmount || 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500 block">{pm.count} transactions</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: RECEIVABLES & COLLECTIONS
           ======================================================== */}
        {activeTab === 'receivables' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Customer Receivables</span>
                <span className="text-2xl font-bold text-gray-900 block mt-1">
                  Rs. {(receivablesSummary?.totalOutstanding || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 block mt-1">Across all authorized customers</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Recoveries</span>
                <span className="text-2xl font-bold text-emerald-800 block mt-1">
                  Rs. {(collectionsSummary?.totalCollected || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  {collectionsSummary?.paymentsCount || 0} collection payments confirmed
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Overdue Invoices</span>
                <span className="text-2xl font-bold text-rose-700 block mt-1">
                  Rs. {(receivablesSummary?.totalOverdueAmount || 0).toLocaleString()}
                </span>
                <span className="text-xs text-rose-600 font-medium block mt-1">
                  {receivablesSummary?.overdueInvoicesCount || 0} invoices past due date
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Credit Limit Utilization</span>
                <span className="text-2xl font-bold text-blue-900 block mt-1">
                  {receivablesSummary?.creditUtilizationPercentage || 0}%
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  Total Limit: Rs. {(receivablesSummary?.totalCreditLimit || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Receivables Aging Schedule */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <h3 className="text-base font-bold text-gray-900 mb-4 font-sans flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-800" />
                Customer Receivables Aging Schedule
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {receivablesAging?.buckets?.map((b: any) => (
                  <div key={b.label} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 block">{b.label}</span>
                    <span className="text-lg font-bold text-gray-900 block mt-1">
                      Rs. {(b.amount || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500 block mt-0.5">{b.count} invoices</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: INVENTORY & VALUATION
           ======================================================== */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Stock On Hand</span>
                <span className="text-2xl font-bold text-gray-900 block mt-1">
                  {(inventorySummary?.totalOnHand || 0).toLocaleString()} Units
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  Available: {(inventorySummary?.totalAvailable || 0).toLocaleString()} Units
                </span>
              </div>

              {isSuperAdmin && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Verified Inventory Valuation</span>
                  <span className="text-2xl font-bold text-emerald-800 block mt-1">
                    Rs. {(valuationData?.totalValuation || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-emerald-700 font-medium block mt-1">
                    Basis: {valuationData?.costBasisMethod || 'PURCHASE_PRICE'} ({valuationData?.valuationStatus || 'VERIFIED'})
                  </span>
                </div>
              )}

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Low Stock Alerts</span>
                <span className="text-2xl font-bold text-amber-700 block mt-1">
                  {(lowStockData?.lowStockCount || 0).toLocaleString()} SKUs
                </span>
                <span className="text-xs text-amber-600 font-medium block mt-1">Threshold: &lt; 5 available units</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Out of Stock</span>
                <span className="text-2xl font-bold text-rose-700 block mt-1">
                  {(inventorySummary?.outOfStockCount || 0).toLocaleString()} SKUs
                </span>
                <span className="text-xs text-rose-600 font-medium block mt-1">Zero units remaining</span>
              </div>
            </div>

            {/* Low Stock Table */}
            {lowStockData?.items && lowStockData.items.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-base font-bold text-gray-900 font-sans">Low Stock Reorder Recommendations</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-semibold tracking-wider">
                      <tr>
                        <th className="px-5 py-3">SKU</th>
                        <th className="px-5 py-3">Branch</th>
                        <th className="px-5 py-3">On Hand</th>
                        <th className="px-5 py-3">Reserved</th>
                        <th className="px-5 py-3">Available</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lowStockData.items.slice(0, 10).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/80">
                          <td className="px-5 py-3 font-mono text-xs font-medium text-gray-900">{item.sku}</td>
                          <td className="px-5 py-3 text-gray-700">{item.branchName || 'All'}</td>
                          <td className="px-5 py-3 text-gray-900 font-medium">{item.onHand}</td>
                          <td className="px-5 py-3 text-gray-500">{item.reserved}</td>
                          <td className="px-5 py-3 text-rose-700 font-bold">{item.available}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                item.available <= 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.available <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 4: PURCHASING & PAYABLES
           ======================================================== */}
        {activeTab === 'purchasing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Billed Purchases</span>
                <span className="text-2xl font-bold text-gray-900 block mt-1">
                  Rs. {(purchasingSummary?.totalBillAmount || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  {purchasingSummary?.postedBillsCount || 0} posted supplier bills
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Supplier Payments</span>
                <span className="text-2xl font-bold text-emerald-800 block mt-1">
                  Rs. {(purchasingSummary?.totalPaidAmount || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  {purchasingSummary?.supplierPaymentsCount || 0} payments disbursed
                </span>
              </div>

              {isSuperAdmin && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Outstanding Payables</span>
                  <span className="text-2xl font-bold text-purple-900 block mt-1">
                    Rs. {(payablesSummary?.totalOutstandingPayables || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500 block mt-1">
                    Net liability: Rs. {(payablesSummary?.netPayableLiability || 0).toLocaleString()}
                  </span>
                </div>
              )}

              {isSuperAdmin && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Overdue Payables</span>
                  <span className="text-2xl font-bold text-rose-700 block mt-1">
                    Rs. {(payablesSummary?.overduePayablesAmount || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-rose-600 font-medium block mt-1">
                    {payablesSummary?.overdueBillsCount || 0} supplier bills past due
                  </span>
                </div>
              )}
            </div>

            {/* Payables Aging Schedule (Super Admin) */}
            {isSuperAdmin && payablesAging?.buckets && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <h3 className="text-base font-bold text-gray-900 mb-4 font-sans flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-800" />
                  Supplier Accounts Payable Aging Schedule
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {payablesAging.buckets.map((b: any) => (
                    <div key={b.label} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 block">{b.label}</span>
                      <span className="text-lg font-bold text-gray-900 block mt-1">
                        Rs. {(b.amount || 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500 block mt-0.5">{b.count} bills</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 5: FINANCIAL RECONCILIATION AUDIT (Super Admin)
           ======================================================== */}
        {activeTab === 'reconciliation' && isSuperAdmin && (
          <div className="space-y-6">
            {/* Status Summary Banner */}
            <div
              className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                auditData?.summary?.overallStatus === 'RECONCILED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : auditData?.summary?.overallStatus === 'ATTENTION_REQUIRED'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`p-3 rounded-xl ${
                    auditData?.summary?.overallStatus === 'RECONCILED'
                      ? 'bg-emerald-600 text-white'
                      : auditData?.summary?.overallStatus === 'ATTENTION_REQUIRED'
                      ? 'bg-amber-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  <ShieldCheck className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-lg font-bold font-sans">
                    System Financial Health: {auditData?.summary?.overallStatus || 'RECONCILED'}
                  </h3>
                  <p className="text-xs mt-0.5 opacity-90">
                    Audit evaluated {auditData?.summary?.totalChecks || 0} cross-module checks across Sales, Inventory,
                    Collections, Receivables, Purchases, and Payables.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="px-3 py-1.5 rounded-lg bg-white/80 border border-gray-200/50">
                  Passed: {auditData?.summary?.passedChecks || 0}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/80 border border-gray-200/50">
                  Warnings: {auditData?.summary?.warningsCount || 0}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/80 border border-gray-200/50">
                  Critical: {auditData?.summary?.criticalCount || 0}
                </span>
              </div>
            </div>

            {/* Discrepancy Checks Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 font-sans">
                  Detailed Financial Integrity Verification Checks
                </h3>
                <span className="text-xs text-gray-400">Never auto-mutates accounting ledgers</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Reference / Scope</th>
                      <th className="px-5 py-3">Expected (Calculated)</th>
                      <th className="px-5 py-3">Actual (Stored)</th>
                      <th className="px-5 py-3">Difference</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditData?.checks && auditData.checks.length > 0 ? (
                      auditData.checks.map((chk, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80">
                          <td className="px-5 py-3 font-semibold text-gray-800 text-xs">{chk.category}</td>
                          <td className="px-5 py-3 font-mono text-xs text-gray-700">{chk.recordReference}</td>
                          <td className="px-5 py-3 font-mono text-xs">Rs. {chk.expectedValue.toLocaleString()}</td>
                          <td className="px-5 py-3 font-mono text-xs">Rs. {chk.actualValue.toLocaleString()}</td>
                          <td className="px-5 py-3 font-mono text-xs font-bold">
                            Rs. {chk.difference.toLocaleString()}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                chk.severity === 'OK'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : chk.severity === 'WARNING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {chk.severity}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-600">{chk.message}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-sm">
                          {auditLoading ? 'Running cross-module audit...' : 'All ledgers perfectly reconciled with zero discrepancies.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default ReportsDashboardContent;

