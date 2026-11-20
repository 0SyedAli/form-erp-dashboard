'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/store/services/authApi';
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
  LogOut,
  ArrowDownToLine,
  SlidersHorizontal,
  ArrowLeftRight,
  ClipboardCheck,
  BarChart3,
  X,
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
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logoutApi] = useLogoutMutation();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // Ignore network errors on logout
    }
    dispatch(logout());
    router.push('/login');
  };

  // Accordion open states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Stock & Inventory': true,
    'Purchases': false,
  });

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Clean navigation list: No employee management or complex roles
  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: isSuperAdmin ? '/admin/dashboard' : '/branch/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Point of Sale (POS)',
      href: '/pos',
      icon: ShoppingBag,
      requiredPermission: 'pos:view',
    },
    {
      title: 'Sales History',
      href: '/pos/history',
      icon: Receipt,
      requiredPermission: 'sales:view',
    },
    {
      title: 'Products',
      href: '/products',
      icon: Package,
      requiredPermission: 'catalogue:view',
    },
    {
      title: 'Stock & Inventory',
      href: '/inventory/stock',
      icon: Layers,
      requiredPermission: 'inventory:view',
      subItems: [
        { title: 'Stock Balances', href: '/inventory/stock', icon: Boxes },
        { title: 'Receive Stock (Inward)', href: '/inventory/receiving', icon: ArrowDownToLine },
        { title: 'Stock Adjustments', href: '/inventory/adjustments', icon: SlidersHorizontal },
        { title: 'Stock Transfers', href: '/inventory/transfers', icon: ArrowLeftRight },
        { title: 'Stock Counting', href: '/inventory/counts', icon: ClipboardCheck },
        { title: 'Movements Ledger', href: '/inventory/movements', icon: History },
        { title: 'Inventory Reports', href: '/inventory/reports', icon: BarChart3 },
        { title: 'Inventory Overview', href: '/inventory', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Purchases',
      href: '/purchases/orders',
      icon: ShoppingCart,
      requiredPermission: 'purchases.view',
      subItems: [
        { title: 'Purchase Orders', href: '/purchases/orders', icon: ShoppingCart },
        { title: 'Receive Stock', href: '/purchases/receiving', icon: ArrowDownToLine },
        { title: 'Purchase Bills', href: '/purchases/bills', icon: Receipt },
      ],
    },
    {
      title: 'Suppliers',
      href: '/suppliers',
      icon: Building,
      requiredPermission: 'suppliers.view',
    },
    {
      title: 'Customers',
      href: '/customers',
      icon: Users2,
      requiredPermission: 'customers:view',
    },
    {
      title: 'Collections (Khata)',
      href: '/payments/collections',
      icon: CreditCard,
      requiredPermission: 'payments.collect',
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
      title: 'Reports & Analytics',
      href: '/reports',
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
    if (item.href.startsWith('/purchases') && pathname.startsWith('/purchases')) return true;
    if (item.href === '/suppliers' && pathname.startsWith('/suppliers')) return true;
    if (item.href === '/customers' && pathname.startsWith('/customers')) return true;
    if (item.href === '/admin/branches' && pathname.startsWith('/admin/branches')) return true;
    if (item.href === '/settings/products' && pathname.startsWith('/settings/products')) return true;
    return false;
  };

  return (
    <>
      {/* Slide-over Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Slide-over Drawer Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-brand-navy text-slate-300 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header with Close Button */}
        <div className="h-18 flex items-center justify-between px-5 border-b border-slate-800/60 bg-[#0A101D] shrink-0">
          <Link
            href={isSuperAdmin ? '/admin/dashboard' : '/pos'}
            onClick={onMobileClose}
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

          {/* Close Drawer Button */}
          <button
            type="button"
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="Close menu"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = checkIsActive(item);
            const Icon = item.icon;
            const hasSub = Array.isArray(item.subItems) && item.subItems.length > 0;

            if (hasSub) {
              const isSectionOpen = expandedSections[item.title] ?? isActive;
              return (
                <div key={item.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(item.title)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                      ? 'bg-slate-800/80 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium'
                      }`}
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <Icon
                        className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`}
                      />
                      <span className="truncate">{item.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isSectionOpen ? 'rotate-180 text-blue-400' : 'text-slate-400'}`}
                    />
                  </button>

                  {/* Submenu links */}
                  {isSectionOpen && item.subItems && (
                    <div className="pl-2 pr-1 py-1 space-y-1 border-l border-slate-700/60 ml-4 animate-in fade-in duration-150">
                      {item.subItems.map((sub) => {
                        const isSubActive = pathname === sub.href;
                        const SubIcon = sub.icon;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={onMobileClose}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isSubActive
                              ? 'bg-brand-blue text-white font-semibold shadow-xs'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                              }`}
                          >
                            {SubIcon && <SubIcon className="w-3.5 h-3.5 shrink-0" />}
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                  ? 'bg-brand-blue text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium'
                  }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'
                    }`}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Account Summary */}
        <div className="p-3.5 border-t border-slate-800/80 bg-[#0A101D] text-[13px] text-slate-400 font-sans">
          {/* <div className="flex items-center justify-between">
            <span className="truncate font-semibold text-slate-300 text-xs">
              {currentUser?.name}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
              {isSuperAdmin ? 'Super Admin' : 'Branch'}
            </span>
          </div> */}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-slate-500 truncate">
              {isSuperAdmin ? 'Full Business Access' : (currentUser?.designation || 'Active Terminal')}
            </span>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
