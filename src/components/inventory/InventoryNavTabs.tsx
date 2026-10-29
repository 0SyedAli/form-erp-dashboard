'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  History,
  BarChart3,
} from 'lucide-react';
import {
  useGetInventoryDashboardKPIsQuery,
} from '@/store/services/apiSlice';

interface NavTabItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

export default function InventoryNavTabs({ branchId }: { branchId?: string }) {
  const pathname = usePathname();
  const { data: kpis } = useGetInventoryDashboardKPIsQuery(branchId);

  const tabs: NavTabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      href: '/inventory',
      icon: LayoutDashboard,
    },
    {
      id: 'stock',
      label: 'Stock Balances',
      href: '/inventory/stock',
      icon: Boxes,
      badge: kpis?.lowStockSKUs && kpis.lowStockSKUs > 0 ? `${kpis.lowStockSKUs} low` : undefined,
    },
    {
      id: 'receiving',
      label: 'Stock Receiving',
      href: '/inventory/receiving',
      icon: ArrowDownToLine,
    },
    {
      id: 'transfers',
      label: 'Transfers',
      href: '/inventory/transfers',
      icon: ArrowLeftRight,
      badge: kpis?.pendingTransfers && kpis.pendingTransfers > 0 ? `${kpis.pendingTransfers} pending` : undefined,
    },
    {
      id: 'adjustments',
      label: 'Adjustments & Damaged',
      href: '/inventory/adjustments',
      icon: SlidersHorizontal,
      badge: kpis?.damagedStockUnits && kpis.damagedStockUnits > 0 ? `${kpis.damagedStockUnits} dmg` : undefined,
    },
    {
      id: 'counts',
      label: 'Stock Counting',
      href: '/inventory/counts',
      icon: ClipboardCheck,
    },
    {
      id: 'movements',
      label: 'Movements Ledger',
      href: '/inventory/movements',
      icon: History,
    },
    {
      id: 'reports',
      label: 'Reports',
      href: '/inventory/reports',
      icon: BarChart3,
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 shadow-2xs">
      <div className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none py-1.5">
        {tabs.map((tab) => {
          const isActive =
            tab.href === '/inventory'
              ? pathname === '/inventory'
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-50 text-brand-blue font-semibold shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-blue' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                    isActive
                      ? 'bg-brand-blue text-white'
                      : String(tab.badge).includes('low') || String(tab.badge).includes('dmg')
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
