'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  ArrowDownToLine,
  Receipt,
  RotateCcw,
  Building2,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';
import { useGetPurchasingDashboardKPIsQuery } from '@/store/services/apiSlice';

interface NavTabItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: string;
}

export default function PurchasesNavTabs({ branchId }: { branchId?: string }) {
  const pathname = usePathname();
  const { data: kpis } = useGetPurchasingDashboardKPIsQuery(branchId ? { branchId } : undefined);

  const tabs: NavTabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      href: '/purchases',
      icon: LayoutDashboard,
    },
    {
      id: 'orders',
      label: 'Purchase Orders',
      href: '/purchases/orders',
      icon: ShoppingCart,
      badge:
        kpis?.pendingPurchaseOrdersCount && kpis.pendingPurchaseOrdersCount > 0
          ? `${kpis.pendingPurchaseOrdersCount} open`
          : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'receiving',
      label: 'Goods Receiving',
      href: '/purchases/receiving',
      icon: ArrowDownToLine,
      badge:
        kpis?.pendingGoodsReceiptsCount && kpis.pendingGoodsReceiptsCount > 0
          ? `${kpis.pendingGoodsReceiptsCount} pending`
          : undefined,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      id: 'bills',
      label: 'Supplier Bills',
      href: '/purchases/bills',
      icon: Receipt,
      badge:
        kpis?.overdueBillsCount && kpis.overdueBillsCount > 0
          ? `${kpis.overdueBillsCount} overdue`
          : undefined,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      id: 'returns',
      label: 'Debit Notes & Returns',
      href: '/purchases/returns',
      icon: RotateCcw,
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      href: '/suppliers',
      icon: Building2,
    },
    {
      id: 'payments',
      label: 'Supplier Payments',
      href: '/payments/suppliers',
      icon: CreditCard,
    },
    {
      id: 'reports',
      label: 'Procurement Reports',
      href: '/purchases/reports',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="w-full bg-white border-b border-slate-200 mb-6 shadow-xs sticky top-16 z-20">
      <div className="overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 px-4 sm:px-6 min-w-max" aria-label="Purchasing Tabs">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/purchases'
                ? pathname === '/purchases'
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 py-3.5 px-3.5 text-sm font-medium border-b-2 transition-all duration-150 ${
                  isActive
                    ? 'border-brand-burgundy text-brand-burgundy font-semibold bg-rose-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-burgundy' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      tab.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

