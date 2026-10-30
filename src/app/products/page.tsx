'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector, RootState } from '@/store';
import { hasPermission } from '@/lib/permissions';
import {
  useGetProductsQuery,
  useGetVariantsQuery,
} from '@/store/services/apiSlice';
import Toast, { ToastMessage } from '@/components/common/Toast';
import ProductsTab from '@/components/products/ProductsTab';
import {
  Plus,
  Settings,
  ShieldAlert,
} from 'lucide-react';

function ProductsPageContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  // Access control
  const canManageCatalogue = hasPermission(currentUser, 'catalogue:manage');
  const canManagePricing = hasPermission(currentUser, 'pricing:manage');
  const canViewCatalogue = hasPermission(currentUser, 'catalogue:view') || canManageCatalogue;

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Query high-level counts
  const { data: products = [] } = useGetProductsQuery();
  const { data: variants = [] } = useGetVariantsQuery();

  const activeVariantsCount = variants.filter((v) => v.status === 'active' || v.status === 'ACTIVE').length;

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({
      id: Date.now().toString(),
      type,
      title: type === 'success' ? 'Operation Completed' : type === 'error' ? 'Notice' : 'Information',
      message,
    });
  };

  if (currentUser && !canViewCatalogue) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-gray-600 bg-white rounded-2xl border border-gray-200 mt-6 max-w-lg mx-auto shadow-xs">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Catalogue Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-1">
            Your current role (<span className="font-semibold text-gray-800">{currentUser.role}</span>) does not have permission to view the product catalogue.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header with Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-sans">
            Product Catalogue & Pricing
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-normal">
            Browse mattress products, specifications, retail/wholesale rates and stock levels
          </p>
        </div>

        {/* Live Counters and Navigation */}
        <div className="flex items-center gap-3">
          <div className="bg-white px-3.5 py-2 rounded-xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] text-gray-400 block font-normal">Active SKUs</span>
            <span className="text-base font-bold text-gray-900 font-mono">
              {activeVariantsCount} <span className="text-xs font-normal text-gray-400">/ {variants.length}</span>
            </span>
          </div>

          <div className="bg-white px-3.5 py-2 rounded-xl border border-gray-200/80 shadow-2xs">
            <span className="text-[11px] text-gray-400 block font-normal">Total Products</span>
            <span className="text-base font-bold text-brand-blue font-mono">{products.length}</span>
          </div>

          <Link
            href="/settings/products"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Configure Brands, Categories, Sizes and Thicknesses"
          >
            <Settings className="w-4 h-4 text-gray-600" />
            <span className="hidden md:inline">Master Data</span>
          </Link>

          {canManageCatalogue && (
            <Link
              href="/products/new"
              className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </Link>
          )}
        </div>
      </div>

      {/* Permission Warning for Read-Only Staff */}
      {!canManageCatalogue && (
        <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-800">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <strong>Read-Only Mode:</strong> Your current role (
            <span className="font-semibold text-gray-900">{currentUser?.role || 'Staff'}</span>) has
            view access to catalogue items and prices. Modifications are restricted to Super Admin or
            authorized catalogue managers.
          </div>
        </div>
      )}

      {/* Main Products List Table */}
      <ProductsTab
        canManage={canManageCatalogue}
        canManagePricing={canManagePricing}
        onToast={showToast}
        currentUserEmail={currentUser?.email}
      />

      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Loading Products...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
