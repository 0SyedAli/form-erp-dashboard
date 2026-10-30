'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/store';
import {
  LayoutDashboard,
  Building2,
  Package,
  Layers,
  ShoppingBag,
  Building,
  Users2,
  ShoppingCart,
  Receipt,
  FileSpreadsheet,
  Settings,
  CreditCard,
  Boxes,
  ChevronDown,
  History,
  AlertTriangle,
} from 'lucide-react';

import { hasPermission } from '@/lib/permissions';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onOpenRoleSwitcher?: () => void;
}

interface SubNavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: string;
  subItems?: SubNavItem[];
}

export default function Sidebar({
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Manage stock accordion open state
  const isManageStockRoute = pathname?.startsWith('/manage-stock');
  const [isManageStockExpanded, setIsManageStockExpanded] = useState(true);

  // Clean navigation list: No employee management or complex roles
  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: isSuperAdmin ? '/admin/dashboard' : '/branch/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Unified POS',
      href: '/pos',
      icon: ShoppingBag,
      requiredPermission: 'pos:view',
    },
    {
      title: 'Sales History',
      href: '/pos/history',
      icon: Receipt,
      requiredPermission: 'pos:view',
    },
    {
      title: 'Manage Stock',
      href: '/manage-stock',
      icon: Boxes,
      requiredPermission: 'inventory:view',
      subItems: [
        { title: 'Manage Stock', href: '/manage-stock', icon: Boxes },
        { title: 'Stock History', href: '/manage-stock/history', icon: History },
        { title: 'Alert Stock', href: '/manage-stock/alerts', icon: AlertTriangle },
      ],
    },
    {
      title: 'Products',
      href: '/products',
      icon: Package,
      requiredPermission: 'catalogue:view',
    },
    {
      title: 'Inventory',
      href: '/inventory',
      icon: Layers,
      requiredPermission: 'inventory:view',
    },
    {
      title: 'Customers',
      href: '/customers',
      icon: Users2,
      requiredPermission: 'customers:view',
    },
    {
      title: 'Collections',
      href: '/payments/collections',
      icon: Receipt,
      requiredPermission: 'payments.collect',
    },
    {
      title: 'Purchases',
      href: '/purchases',
      icon: ShoppingCart,
      requiredPermission: 'purchases.view',
    },
    {
      title: 'Suppliers',
      href: '/suppliers',
      icon: Building,
      requiredPermission: 'suppliers.view',
    },
    {
      title: 'Supplier Payments',
      href: '/payments/suppliers',
      icon: CreditCard,
      requiredPermission: 'payments.suppliers.create',
    },
    ...(isSuperAdmin
      ? [
          {
            title: 'Branches',
            href: '/admin/branches',
            icon: Building2,
            requiredPermission: 'branches:view',
          },
        ]
      : []),
    {
      title: 'Reports',
      href: '/purchases/reports',
      icon: FileSpreadsheet,
      requiredPermission: 'reports:view',
    },
    {
      title: 'Product Settings',
      href: '/settings/products',
      icon: Settings,
      requiredPermission: 'catalogue:manage',
    },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(currentUser, item.requiredPermission);
  });

  const checkIsActive = (item: NavItem): boolean => {
    if (item.href === '#' || !item.href) return false;
    if (pathname === item.href) return true;
    if (item.subItems && item.subItems.some((s) => pathname === s.href)) {
      return true;
    }
    // Deep route matching
    if (item.href === '/admin/dashboard' && pathname === '/admin/dashboard') return true;
    if (item.href === '/branch/dashboard' && pathname === '/branch/dashboard') return true;
    if (item.href === '/manage-stock' && pathname.startsWith('/manage-stock')) return true;
    if (item.href === '/products' && pathname.startsWith('/products')) return true;
    if (item.href === '/inventory' && pathname.startsWith('/inventory')) return true;
    if (item.href === '/purchases' && pathname.startsWith('/purchases')) return true;
    if (item.href === '/suppliers' && pathname.startsWith('/suppliers')) return true;
    if (item.href === '/customers' && pathname.startsWith('/customers')) return true;
    if (item.href === '/admin/branches' && pathname.startsWith('/admin/branches')) return true;
    if (item.href === '/settings/products' && pathname.startsWith('/settings/products')) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-60 bg-brand-navy text-slate-300 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-18 flex items-center px-5 border-b border-slate-800/60 bg-[#0A101D]">
          <Link
            href={isSuperAdmin ? '/admin/dashboard' : '/pos'}
            className="flex items-center gap-3 overflow-hidden"
          >
            {/* Red/Yellow Circular 'M' Icon */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-red-600 to-red-700 flex items-center justify-center text-white font-extrabold text-base tracking-wider shrink-0 shadow-sm border border-amber-300/40">
              <span className="text-amber-200">M</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-base leading-tight tracking-tight font-sans">
                MoltyFoam
              </span>
              <span className="text-[11px] font-normal text-red-500 tracking-normal font-sans">
                Feel the Difference
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = checkIsActive(item);
            const Icon = item.icon;
            const hasSub = Array.isArray(item.subItems) && item.subItems.length > 0;

            if (hasSub) {
              const showSubs = isManageStockRoute ? isManageStockExpanded : isManageStockExpanded && isActive;
              return (
                <div key={item.title} className="space-y-1">
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-blue text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium'
                    }`}
                    onClick={() => setIsManageStockExpanded(!isManageStockExpanded)}
                  >
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      className="flex items-center gap-3 flex-1"
                    >
                      <Icon
                        className={`w-4.5 h-4.5 shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsManageStockExpanded(!isManageStockExpanded);
                      }}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          showSubs ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Submenu links */}
                  {showSubs && item.subItems && (
                    <div className="pl-6 pr-1 py-1 space-y-1 border-l border-slate-700/60 ml-4">
                      {item.subItems.map((sub) => {
                        const isSubActive = pathname === sub.href;
                        const SubIcon = sub.icon;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={onMobileClose}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              isSubActive
                                ? 'bg-slate-800 text-blue-400 font-semibold'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                          >
                            {SubIcon && <SubIcon className="w-3.5 h-3.5" />}
                            <span>{sub.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-blue text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium'
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Account Summary */}
        <div className="p-3.5 border-t border-slate-800/80 bg-[#0A101D] text-[13px] text-slate-400 font-sans">
          <div className="flex items-center justify-between">
            <span className="truncate font-semibold text-slate-300 text-xs">
              {currentUser?.name}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
              {isSuperAdmin ? 'Super Admin' : 'Branch'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            {isSuperAdmin ? 'Full Business Access' : (currentUser?.designation || 'Active Terminal')}
          </div>
        </div>
      </aside>
    </>
  );
}
