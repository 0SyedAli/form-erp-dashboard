'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetPurchasingDashboardKPIsQuery,
  useGetBranchesQuery,
  useGetPurchaseOrdersQuery,
  useGetSupplierBillsQuery,
  useGetSuppliersQuery,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import {
  ShoppingCart,
  Receipt,
  ArrowDownToLine,
  RotateCcw,
  Plus,
  CreditCard,
  Building2,
  ChevronRight,
  Clock,
  ArrowUpRight,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PIE_COLORS = ['#881337', '#1e293b', '#0284c7', '#16a34a', '#d97706', '#9333ea'];

function PurchasesOverviewContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const defaultBranchId = isSuperAdmin ? 'all' : (currentUser?.assignedBranchId || 'all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);

  const branchArg = selectedBranchId === 'all' ? undefined : selectedBranchId;
  const { data: kpis } = useGetPurchasingDashboardKPIsQuery(branchArg ? { branchId: branchArg } : undefined);
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery(branchArg ? { branchId: branchArg } : undefined);
  const { data: supplierBills = [] } = useGetSupplierBillsQuery(branchArg ? { branchId: branchArg } : undefined);
  const { data: suppliers = [] } = useGetSuppliersQuery();

  // Pending action items
  const actionablePOs = purchaseOrders
    .filter((po) => po.status === 'PENDING_APPROVAL' || po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED')
    .slice(0, 5);

  const overdueOrUnpaidBills = supplierBills
    .filter((b) => b.amountDue > 0)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  // Supplier payables breakdown for chart
  const supplierPayableData = suppliers
    .filter((s) => s.currentOutstanding > 0)
    .map((s) => ({
      name: s.name.length > 15 ? s.name.slice(0, 14) + '...' : s.name,
      fullName: s.name,
      outstanding: s.currentOutstanding,
    }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5);

  // Status breakdown for POs
  const poStatusBreakdown = [
    { name: 'Pending Approval', count: purchaseOrders.filter((p) => p.status === 'PENDING_APPROVAL').length },
    { name: 'Approved', count: purchaseOrders.filter((p) => p.status === 'APPROVED').length },
    { name: 'Partially Received', count: purchaseOrders.filter((p) => p.status === 'PARTIALLY_RECEIVED').length },
    { name: 'Fully Received', count: purchaseOrders.filter((p) => p.status === 'FULLY_RECEIVED').length },
  ].filter((item) => item.count > 0);

  return (
    <AppLayout>
      <PurchasesNavTabs branchId={branchArg} />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header & Location Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Procurement & Purchases</h1>
            <p className="text-sm text-slate-500 mt-1">
              Multi-branch supplier management, purchase orders, goods receipts, and accounts payable
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                <Building2 className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="text-sm font-medium bg-transparent border-none text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Branches (Consolidated)</option>
                  {authorizedBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Link
              href="/purchases/orders/new"
              className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase Order</span>
            </Link>
          </div>
        </div>

        {/* Top KPI Cards (Financial & Operations Separation) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Billed Purchases */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Billed Purchases
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-[28px] font-bold text-slate-900 leading-tight">
                Rs. {(kpis?.totalPurchasesValue || 0).toLocaleString()}
              </span>
              <p className="text-xs text-slate-500 mt-1">Total posted vendor bills</p>
            </div>
          </div>

          {/* Accounts Payable (Liability) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Accounts Payable (Due)
              </span>
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-brand-burgundy flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-[28px] font-bold text-rose-700 leading-tight">
                Rs. {(kpis?.totalSupplierPayables || 0).toLocaleString()}
              </span>
              <div className="flex items-center gap-1 text-xs text-rose-600 mt-1">
                <span>{kpis?.overdueBillsCount || 0} bills overdue</span>
                <span>(Rs. {(kpis?.overdueBillsAmount || 0).toLocaleString()})</span>
              </div>
            </div>
          </div>

          {/* Open Purchase Orders */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Open Purchase Orders
              </span>
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-[28px] font-bold text-slate-900 leading-tight">
                {kpis?.pendingPurchaseOrdersCount || 0}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                {kpis?.totalPurchaseOrdersCount || 0} total purchase orders
              </p>
            </div>
          </div>

          {/* Pending Goods Receipts */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Goods Receipt
              </span>
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-[28px] font-bold text-slate-900 leading-tight">
                {kpis?.pendingGoodsReceiptsCount || 0}
              </span>
              <p className="text-xs text-slate-500 mt-1">Approved orders waiting for stock</p>
            </div>
          </div>
        </div>

        {/* Action Shortcuts Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/purchases/orders/new"
            className="flex items-center gap-3 p-3.5 bg-white rounded-lg border border-slate-200 hover:border-brand-burgundy/50 hover:shadow-xs transition-all text-slate-700 hover:text-brand-burgundy group"
          >
            <div className="w-8 h-8 rounded-md bg-rose-50 text-brand-burgundy flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Create PO</span>
          </Link>

          <Link
            href="/purchases/receiving"
            className="flex items-center gap-3 p-3.5 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all text-slate-700 hover:text-blue-700 group"
          >
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Receive Goods</span>
          </Link>

          <Link
            href="/purchases/bills"
            className="flex items-center gap-3 p-3.5 bg-white rounded-lg border border-slate-200 hover:border-emerald-400 hover:shadow-xs transition-all text-slate-700 hover:text-emerald-700 group"
          >
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Vendor Bills</span>
          </Link>

          <Link
            href="/payments/suppliers"
            className="flex items-center gap-3 p-3.5 bg-white rounded-lg border border-slate-200 hover:border-purple-400 hover:shadow-xs transition-all text-slate-700 hover:text-purple-700 group"
          >
            <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Pay Supplier</span>
          </Link>

          <Link
            href="/purchases/returns"
            className="flex items-center gap-3 p-3.5 bg-white rounded-lg border border-slate-200 hover:border-amber-400 hover:shadow-xs transition-all text-slate-700 hover:text-amber-700 group"
          >
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <RotateCcw className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Debit Notes</span>
          </Link>

          <Link
            href="/purchases/reports"
            className="flex items-center gap-3 p-3.5 bg-white rounded-lg border border-slate-200 hover:border-slate-400 hover:shadow-xs transition-all text-slate-700 hover:text-slate-900 group"
          >
            <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Reports</span>
          </Link>
        </div>

        {/* Charts & Analytical Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Supplier Payables Bar Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Outstanding Payables by Supplier</h2>
                <p className="text-xs text-slate-500">Highest current vendor credit balances</p>
              </div>
              <Link
                href="/suppliers"
                className="text-xs font-medium text-brand-burgundy hover:underline flex items-center gap-1"
              >
                <span>View Directory</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="h-64 w-full">
              {supplierPayableData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierPayableData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(val) => `Rs. ${(val / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val) => [`Rs. ${Number(val).toLocaleString()}`, 'Outstanding Balance']}
                    />
                    <Bar dataKey="outstanding" fill="#881337" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No supplier outstanding balances.
                </div>
              )}
            </div>
          </div>

          {/* PO Status Breakdown Pie Chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">PO Status Breakdown</h2>
              <p className="text-xs text-slate-500">Pipeline of all purchase orders</p>
            </div>
            <div className="h-48 w-full my-auto">
              {poStatusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={poStatusBreakdown}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {poStatusBreakdown.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No purchase order records.
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
              {poStatusBreakdown.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="truncate">{item.name}</span>
                  <span className="font-semibold text-slate-800 ml-auto">({item.count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Operational Tables: Open POs & Overdue Bills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active POs Requiring Attention */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Purchase Orders In Pipeline</h3>
                <p className="text-xs text-slate-500">Orders awaiting approval or delivery</p>
              </div>
              <Link
                href="/purchases/orders"
                className="text-xs font-medium text-brand-burgundy hover:underline flex items-center gap-1"
              >
                <span>All Orders</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {actionablePOs.length > 0 ? (
                actionablePOs.map((po) => (
                  <div key={po.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-brand-burgundy">{po.poNumber}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            po.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : po.status === 'APPROVED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}
                        >
                          {po.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-medium">{po.supplierName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{po.destinationBranchName}</span>
                        <span>•</span>
                        <span>{po.items.length} SKUs</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 block">
                        Rs. {po.grandTotal.toLocaleString()}
                      </span>
                      <Link
                        href={`/purchases/orders/${po.id}`}
                        className="text-[11px] text-brand-burgundy hover:underline font-medium mt-1 inline-flex items-center gap-0.5"
                      >
                        <span>View</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  No purchase orders currently pending approval or receipt.
                </div>
              )}
            </div>
          </div>

          {/* Outstanding Vendor Bills */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Unsettled Supplier Bills</h3>
                <p className="text-xs text-slate-500">Upcoming and overdue bill commitments</p>
              </div>
              <Link
                href="/purchases/bills"
                className="text-xs font-medium text-brand-burgundy hover:underline flex items-center gap-1"
              >
                <span>All Bills</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {overdueOrUnpaidBills.length > 0 ? (
                overdueOrUnpaidBills.map((bill) => {
                  const isOverdue =
                    bill.amountDue > 0 && bill.dueDate < new Date().toISOString().slice(0, 10);

                  return (
                    <div
                      key={bill.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-800">{bill.billNumber}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isOverdue
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : bill.paymentStatus === 'PARTIALLY_PAID'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isOverdue ? 'OVERDUE' : bill.paymentStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 font-medium">{bill.supplierName}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Due: {bill.dueDate}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-rose-700 block">
                          Rs. {bill.amountDue.toLocaleString()}
                        </span>
                        <Link
                          href="/payments/suppliers"
                          className="text-[11px] text-brand-burgundy hover:underline font-medium mt-1 inline-flex items-center gap-0.5"
                        >
                          <span>Pay</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  All supplier bills are fully settled!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PurchasesOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Purchases Overview...
        </div>
      }
    >
      <PurchasesOverviewContent />
    </Suspense>
  );
}
