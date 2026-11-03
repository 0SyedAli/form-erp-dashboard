'use client';

import React from 'react';
import { useAppSelector } from '@/store';
import {
  Menu,
  Bell,
  Search,
} from 'lucide-react';

interface HeaderProps {
  onMobileOpen: () => void;
  onOpenRoleSwitcher?: () => void;
  title?: string;
  subtitle?: string;
}

export default function Header({
  onMobileOpen,
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
      <div className="flex items-center gap-3">
        {/* Open Unified POS Quick Button */}
        <a
          href="/pos"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-burgundy/10 text-brand-burgundy hover:bg-brand-burgundy hover:text-white text-xs font-semibold transition-colors"
          title="Open Full-Screen POS"
        >
          <span>Open POS</span>
        </a>

        {/* Notifications Icon with badge */}
        <button
          onClick={() => alert('Notifications: All branch cluster terminals connected in real time.')}
          className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
            1
          </span>
        </button>

        {/* User Profile Pill */}
        <div
          className="flex items-center gap-2.5 pl-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              currentUser?.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
            }
            alt={currentUser?.name || 'User'}
            className="w-8 h-8 rounded-full object-cover border border-gray-200"
          />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-gray-900 leading-tight">
              {currentUser?.name || 'User'}
            </span>
            <span className="text-[11px] font-normal text-gray-500 leading-tight mt-0.5">
              {isSuperAdmin ? 'Super Admin' : (currentUser?.designation || 'Branch Terminal')}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
