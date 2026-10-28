'use client';

import React from 'react';
import { useAppSelector } from '@/store';
import {
  Menu,
  Bell,
  Search,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  onMobileOpen: () => void;
  onOpenRoleSwitcher: () => void;
  title?: string;
  subtitle?: string;
}

export default function Header({
  onMobileOpen,
  onOpenRoleSwitcher,
}: HeaderProps) {
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200/80 px-4 lg:px-8 flex items-center justify-between shadow-2xs">
      {/* Left: Hamburger & Search Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <button
          onClick={onMobileOpen}
          className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder={
              isSuperAdmin
                ? 'Search products, invoices, customers...'
                : 'Search products, customers, invoices...'
            }
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50/90 border border-gray-200/80 rounded-lg text-sm font-normal text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-3.5">
        {/* Quick Role Switcher Button */}
        <button
          onClick={onOpenRoleSwitcher}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50 text-sm font-medium transition-colors cursor-pointer"
          title="Switch Demo Persona"
        >
          <RefreshCw className="w-4 h-4 text-brand-blue" />
          <span className="hidden sm:inline">Switch Role</span>
        </button>

        {/* Notifications Icon with red badge */}
        <button
          onClick={() => alert('Notifications: All 5 cluster shops connected in real time.')}
          className="relative p-2.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
            1
          </span>
        </button>

        {/* User Profile Pill matching screenshot */}
        <div
          onClick={onOpenRoleSwitcher}
          className="flex items-center gap-2.5 pl-2 cursor-pointer group"
          title="Click to switch persona"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              currentUser?.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
            }
            alt={currentUser?.name || 'User'}
            className="w-9 h-9 rounded-full object-cover border border-gray-200"
          />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-brand-blue transition-colors">
              {currentUser?.name || 'User'}
            </span>
            <span className="text-[13px] font-normal text-gray-500 leading-tight mt-0.5">
              {currentUser?.roleName || (currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'User')}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 hidden sm:block" />
        </div>
      </div>
    </header>
  );
}
