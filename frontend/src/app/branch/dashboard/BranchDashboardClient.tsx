'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import KpiCard from '@/components/dashboard/KpiCard';
import DailySalesTrendChart from '@/components/dashboard/DailySalesTrendChart';
import BranchSalesBreakdownDonut from '@/components/dashboard/BranchSalesBreakdownDonut';
import BranchRecentInvoicesCard from '@/components/dashboard/BranchRecentInvoicesCard';
import BranchTopProductsCard from '@/components/dashboard/BranchTopProductsCard';
import { useAppSelector } from '@/store';
import {
  Banknote,
  Calendar,
  Briefcase,
  Package,
  ChevronDown,
  Truck,
  CreditCard,
} from 'lucide-react';

import { useGetBranchesQuery } from '@/store/services/catalogueApi';
import { useGetDashboardKPIsQuery } from '@/store/services/apiSlice';
import { useGetBranchDashboardQuery } from '@/store/services/reportsApi';

function BranchDashboardContent() {
  const isBackendMode = process.env.NEXT_PUBLIC_DATA_MODE === 'backend';
  const searchParams = useSearchParams();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: branches = [] } = useGetBranchesQuery(undefined, { skip: !mounted });

  const queryBranchId = searchParams.get('branchId');
  const effectiveBranchId = isSuperAdmin
    ? queryBranchId || (branches.length > 0 ? branches[0].id : '')
    : currentUser?.assignedBranchId || (branches.length > 0 ? branches[0].id : '');

  const { data: kpis } = useGetDashboardKPIsQuery(
    { branchId: effectiveBranchId },
    { skip: !mounted || isBackendMode || !effectiveBranchId }
  );

  const { data: backendBranchDashboard } = useGetBranchDashboardQuery(
    effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
    { skip: !mounted || !isBackendMode || !effectiveBranchId, refetchOnMountOrArgChange: true }
  );

  const displayTodaySales = isBackendMode
    ? backendBranchDashboard?.today?.sales ?? 0
    : kpis?.todaySales ?? 0;

  const displayMonthlyRevenue = isBackendMode
    ? backendBranchDashboard?.periodMetrics?.netSales ?? 0
    : kpis?.totalNetSales ?? 0;

  const displayTotalOrders = isBackendMode
    ? backendBranchDashboard?.today?.invoicesCount ?? 0
    : kpis?.totalInvoices ?? 0;

  const displayAvailableStock = isBackendMode
    ? `${backendBranchDashboard?.inventory?.available ?? 0} Units`
    : `${(kpis as any)?.availableUnits ?? 0} Units`;

  const displayWalkIn = isBackendMode
    ? backendBranchDashboard?.salesBreakdown?.walkIn ?? 0
    : (kpis?.walkInRevenue ?? kpis?.retailRevenue ?? 0);

  const displayWholesale = isBackendMode
    ? backendBranchDashboard?.salesBreakdown?.wholesale ?? 0
    : (kpis?.wholesaleRevenue ?? 0);

  const displayDistributor = isBackendMode
    ? backendBranchDashboard?.salesBreakdown?.distributor ?? 0
    : (kpis?.distributorRevenue ?? 0);

  const displayCredit = isBackendMode
    ? backendBranchDashboard?.periodMetrics?.creditSales ?? 0
    : (kpis?.totalOutstandingReceivables ?? 0);

  // Live Chart & Card Data Mappings
  const dailySalesTrend = React.useMemo(() => {
    return backendBranchDashboard?.salesTrends || [];
  }, [backendBranchDashboard?.salesTrends]);

  const salesBreakdownDonut = React.useMemo(() => {
    const walkIn = backendBranchDashboard?.salesBreakdown?.walkIn ?? 0;
    const wholesale = backendBranchDashboard?.salesBreakdown?.wholesale ?? 0;
    const distributor = backendBranchDashboard?.salesBreakdown?.distributor ?? 0;
    const total = walkIn + wholesale + distributor || 1;
    return [
      {
        name: 'Walk-in Retail',
        value: walkIn,
        formatted: `Rs. ${walkIn.toLocaleString()}`,
        percent: Math.round((walkIn / total) * 100),
        color: '#2563EB',
      },
      {
        name: 'Wholesale',
        value: wholesale,
        formatted: `Rs. ${wholesale.toLocaleString()}`,
        percent: Math.round((wholesale / total) * 100),
        color: '#D97706',
      },
      {
        name: 'Distributor',
        value: distributor,
        formatted: `Rs. ${distributor.toLocaleString()}`,
        percent: Math.round((distributor / total) * 100),
        color: '#7C3AED',
      },
    ];
  }, [backendBranchDashboard?.salesBreakdown]);

  const recentInvoicesRows = React.useMemo(() => {
    return (backendBranchDashboard?.recentInvoices || []).map((inv: any) => ({
      id: inv.invoiceNumber,
      number: inv.invoiceNumber,
      date: new Intl.DateTimeFormat('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Karachi',
      }).format(new Date(inv.date || Date.now())),
      customer: inv.customerName,
      type: (inv.saleType === 'WHOLESALE' ? 'Wholesale' : 'Retail') as 'Retail' | 'Wholesale',
      amount: `Rs. ${(inv.netAmount || 0).toLocaleString()}`,
      status: (inv.paymentStatus === 'PAID' ? 'Paid' : 'Pending') as 'Paid' | 'Pending',
    }));
  }, [backendBranchDashboard?.recentInvoices]);

  const topProductsRows = React.useMemo(() => {
    return backendBranchDashboard?.topProducts || [];
  }, [backendBranchDashboard?.topProducts]);

  const activeBranch = branches.find((b) => b.id === effectiveBranchId) || null;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            {activeBranch ? `${activeBranch.name} Dashboard` : 'Branch Dashboard'}
          </h1>
          <p className="text-[13px] sm:text-sm text-gray-500 mt-0.5 font-normal">
            Overview of branch operations and sales performance
          </p>
        </div>

        {/* Date Range Picker Dropdown */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200/90 rounded-lg text-sm font-medium text-gray-700 shadow-2xs cursor-pointer hover:bg-gray-50 transition-colors">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>This Month</span>
          <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard
          title="Today's Sales"
          value={`Rs. ${displayTodaySales.toLocaleString()}`}
          icon={Banknote}
          colorScheme="red"
        />
        <KpiCard
          title="Monthly Revenue"
          value={`Rs. ${displayMonthlyRevenue.toLocaleString()}`}
          icon={Calendar}
          colorScheme="blue"
        />
        <KpiCard
          title="Total Orders"
          value={`${displayTotalOrders}`}
          icon={Briefcase}
          colorScheme="purple"
        />
        <KpiCard
          title="Available Stock"
          value={displayAvailableStock}
          icon={Package}
          colorScheme="orange"
        />
      </div>

      {/* Flow 07 Multi-Tier Sales & Credit Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs mb-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold">W</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Walk-in</span>
            <span className="text-xs font-bold text-gray-900 font-sans">
              Rs. {displayWalkIn.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold">WS</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Wholesale</span>
            <span className="text-xs font-bold text-amber-800 font-sans">
              Rs. {displayWholesale.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Distributor</span>
            <span className="text-xs font-bold text-purple-800 font-sans">
              Rs. {displayDistributor.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Outstanding Credit</span>
            <span className="text-xs font-bold text-emerald-800 font-sans">
              Rs. {displayCredit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Daily Sales Trend & Sales Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-7 xl:col-span-8">
          <DailySalesTrendChart data={dailySalesTrend} />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <BranchSalesBreakdownDonut data={salesBreakdownDonut} />
        </div>
      </div>

      {/* Bottom Row: Recent Invoices & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-7 xl:col-span-8">
          <BranchRecentInvoicesCard invoices={recentInvoicesRows} />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <BranchTopProductsCard products={topProductsRows} />
        </div>
      </div>
    </AppLayout>
  );
}

export default BranchDashboardContent;
