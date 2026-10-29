'use client';

import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import KpiCard from '@/components/dashboard/KpiCard';
import RevenueTrendChart from '@/components/dashboard/RevenueTrendChart';
import BranchwiseRevenueDonut from '@/components/dashboard/BranchwiseRevenueDonut';
import TopSellingProductsCard from '@/components/dashboard/TopSellingProductsCard';
import BranchPerformanceCard from '@/components/dashboard/BranchPerformanceCard';
import { useAppDispatch, useAppSelector } from '@/store';
import { setBranchFilter } from '@/store/slices/filterSlice';
import { useGetBranchesQuery, useGetDashboardKPIsQuery } from '@/store/services/apiSlice';
import {
  Banknote,
  ShoppingCart,
  Briefcase,
  Receipt,
  Calendar,
  ChevronDown,
  Truck,
  CreditCard,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.filters);
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: kpis } = useGetDashboardKPIsQuery(filters);

  return (
    <AppLayout>
      {/* Page Header matching user screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-[13px] sm:text-sm text-gray-500 mt-0.5 font-normal">
            Complete overview of all branches
          </p>
        </div>

        {/* Top-Right Filter Controls matching screenshot */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Picker Dropdown */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200/90 rounded-lg text-sm font-medium text-gray-700 shadow-2xs cursor-pointer hover:bg-gray-50 transition-colors">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Oct 1, 2024 - Oct 31, 2024</span>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
          </div>

          {/* Branch Dropdown Selector */}
          <div className="relative">
            <select
              value={filters.branchId}
              onChange={(e) => dispatch(setBranchFilter(e.target.value))}
              className="appearance-none pl-3.5 pr-8 py-2 bg-white border border-gray-200/90 rounded-lg text-sm font-medium text-gray-800 shadow-2xs focus:outline-hidden cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4 Top KPI Cards matching screenshot Screen 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard
          title="Total Net Revenue"
          value={kpis ? `Rs. ${kpis.totalNetSales.toLocaleString()}` : 'Rs. 12,450,000'}
          icon={Banknote}
          colorScheme="green"
          badge={{ text: '+12%', subtext: 'vs last month' }}
        />
        <KpiCard
          title="Walk-in Sales"
          value={kpis ? `Rs. ${(kpis.walkInRevenue ?? kpis.retailRevenue).toLocaleString()}` : 'Rs. 8,320,000'}
          icon={ShoppingCart}
          colorScheme="blue"
          badge={{ text: '+10%' }}
        />
        <KpiCard
          title="Wholesale Sales"
          value={kpis ? `Rs. ${kpis.wholesaleRevenue.toLocaleString()}` : 'Rs. 4,130,000'}
          icon={Briefcase}
          colorScheme="purple"
          badge={{ text: '+14%' }}
        />
        <KpiCard
          title="Total Invoices"
          value={kpis ? kpis.totalInvoices.toLocaleString() : '1,245'}
          icon={Receipt}
          colorScheme="teal"
          badge={{ text: '+14%' }}
        />
      </div>

      {/* Flow 07 Credit, Recovery & Distributor Performance Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs mb-6 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Distributor Sales</span>
            <span className="text-sm font-bold text-gray-900 font-sans">
              Rs. {(kpis?.distributorRevenue || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Total Recoveries</span>
            <span className="text-sm font-bold text-emerald-800 font-sans">
              Rs. {(kpis?.totalCollections || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Outstanding Credit</span>
            <span className="text-sm font-bold text-blue-900 font-sans">
              Rs. {(kpis?.totalOutstandingReceivables || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Overdue Amount</span>
            <span className="text-sm font-bold text-rose-700 font-sans">
              Rs. {(kpis?.overdueAmount || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Revenue Trend & Branchwise Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-7 xl:col-span-8">
          <RevenueTrendChart />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <BranchwiseRevenueDonut />
        </div>
      </div>

      {/* Bottom Row: Top Selling Products & Branch Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TopSellingProductsCard />
        <BranchPerformanceCard />
      </div>
    </AppLayout>
  );
}
