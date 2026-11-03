'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector } from '@/store';
import Sidebar from './Sidebar';
import Header from './Header';
import RoleSwitcherModal from './RoleSwitcherModal';
import InvoiceDetailDrawer from '../dashboard/InvoiceDetailDrawer';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const emptySubscribe = () => () => {};

export default function AppLayout({
  children,
  title,
  subtitle,
}: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, isAuthenticated } = useAppSelector((state) => state.auth);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  
  // React 19 recommended hydration pattern without synchronous setState in effect
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Client-side authentication and role guard
  useEffect(() => {
    if (!isClient) return;

    if (!isAuthenticated || !currentUser) {
      router.push('/login');
      return;
    }

    // Role Guard: Branch managers cannot access Super Admin dashboard
    if (currentUser.role === 'BRANCH_MANAGER' && pathname.startsWith('/admin')) {
      router.push('/unauthorized');
    }
  }, [isAuthenticated, currentUser, pathname, router, isClient]);

  if (!isClient || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-red text-white font-extrabold flex items-center justify-center text-xl animate-pulse">
            MF
          </div>
          <p className="text-xs font-semibold text-gray-500">
            Initializing Molty Foam ERP...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Role-Aware Sidebar */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
      />

      {/* Main Container - Shifted for desktop sidebar */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300">
        {/* Header */}
        <Header
          onMobileOpen={() => setIsMobileOpen(true)}
          onOpenRoleSwitcher={() => setIsRoleSwitcherOpen(true)}
          title={title}
          subtitle={subtitle}
        />

        {/* Content canvas */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-4 px-6 border-t border-gray-200/80 bg-white/70 text-center text-xs text-gray-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <span>
              © {new Date().getFullYear()} Master Molty Foam (Pvt) Ltd. All Rights Reserved.
            </span>
            <span className="text-[11px] text-gray-400">
              Enterprise POS & ERP Architecture • Asia/Karachi (PKT)
            </span>
          </div>
        </footer>
      </div>

      {/* Slide-over Invoice Detail Drawer */}
      <InvoiceDetailDrawer />

      {/* Role Switcher Demo Modal */}
      <RoleSwitcherModal
        isOpen={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
      />
    </div>
  );
}
