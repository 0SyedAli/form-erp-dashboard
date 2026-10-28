'use client';

import React from 'react';
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
  UserCog,
  Settings,
  CreditCard,
  UserCheck,
} from 'lucide-react';

import { hasPermission } from '@/lib/permissions';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onOpenRoleSwitcher: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: string;
}

export default function Sidebar({
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Navigation matching the exact screenshot
  const adminNavItems: NavItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { title: 'Branches', href: '/admin/branches', icon: Building2, requiredPermission: 'branches:view' },
    { title: 'Products', href: '/products', icon: Package, requiredPermission: 'inventory:view' },
    { title: 'Inventory', href: '/products?tab=inventory', icon: Layers, requiredPermission: 'inventory:view' },
    { title: 'Sales (Retail)', href: '/admin/dashboard#invoices', icon: ShoppingBag, requiredPermission: 'pos:view' },
    { title: 'Wholesale', href: '/admin/dashboard#invoices', icon: Building, requiredPermission: 'wholesale:view' },
    { title: 'Customers & Dealers', href: '/admin/users?tab=customers', icon: Users2 },
    { title: 'Purchases', href: '#', icon: ShoppingCart },
    { title: 'Accounts', href: '#', icon: Receipt, requiredPermission: 'reports:financial' },
    { title: 'Reports', href: '#', icon: FileSpreadsheet, requiredPermission: 'reports:view' },
    { title: 'Users & Roles', href: '/admin/users', icon: UserCog, requiredPermission: 'users:view' },
    { title: 'Settings', href: '#', icon: Settings },
  ];

  const branchNavItems: NavItem[] = [
    { title: 'Dashboard', href: '/branch/dashboard', icon: LayoutDashboard },
    { title: 'POS (Billing)', href: '/branch/dashboard#invoices', icon: CreditCard, requiredPermission: 'pos:create' },
    { title: 'Products & Inventory', href: '/products', icon: Package, requiredPermission: 'inventory:view' },
    { title: 'Sales & Invoices', href: '/branch/dashboard#invoices', icon: Receipt, requiredPermission: 'pos:view' },
    { title: 'Customers', href: '#', icon: Users2 },
    { title: 'Purchases', href: '#', icon: ShoppingCart },
    { title: 'Staff (Branch)', href: '/admin/users', icon: UserCheck, requiredPermission: 'users:view' },
    { title: 'Settings', href: '#', icon: Settings },
  ];

  const rawNavItems = isSuperAdmin ? adminNavItems : branchNavItems;

  const navItems = rawNavItems.filter((item) => {
    if (!item.requiredPermission) return true;
    return hasPermission(currentUser, item.requiredPermission);
  });

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
        {/* Brand Header matching screenshot */}
        <div className="h-18 flex items-center px-5 border-b border-slate-800/60 bg-[#0A101D]">
          <Link
            href={isSuperAdmin ? '/admin/dashboard' : '/branch/dashboard'}
            className="flex items-center gap-3 overflow-hidden"
          >
            {/* Red/Yellow Circular 'M' Icon */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-red-600 to-red-700 flex items-center justify-center text-white font-extrabold text-base tracking-wider shrink-0 shadow-sm border border-amber-300/40">
              <span className="text-amber-200">M</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-base leading-tight tracking-tight">
                MoltyFoam
              </span>
              <span className="text-[11px] font-normal text-red-500 tracking-normal">
                Feel the Difference
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href !== '#' &&
              (pathname === item.href ||
                (item.href === '/admin/dashboard' && pathname.startsWith('/admin/dashboard')) ||
                (item.href === '/branch/dashboard' && pathname.startsWith('/branch/dashboard')));
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
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

        {/* Footer info */}
        <div className="p-3.5 border-t border-slate-800/80 bg-[#0A101D] text-[13px] text-slate-400">
          <div className="flex items-center justify-between">
            <span className="truncate font-medium text-slate-300">
              {currentUser?.name}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
              {isSuperAdmin ? 'Admin' : 'Branch'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
