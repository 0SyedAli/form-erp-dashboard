'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector, RootState } from '@/store';
import { hasPermission } from '@/lib/permissions';
import {
  useGetProductsQuery,
  useGetVariantsQuery,
  useGetBrandsQuery,
  useGetCategoriesQuery,
} from '@/store/services/apiSlice';
import Toast, { ToastMessage } from '@/components/common/Toast';
import ProductsTab from '@/components/products/ProductsTab';
import VariantsTab from '@/components/products/VariantsTab';
import BrandsTab from '@/components/products/BrandsTab';
import CategoriesTab from '@/components/products/CategoriesTab';
import SizesTab from '@/components/products/SizesTab';
import ThicknessTab from '@/components/products/ThicknessTab';
import {
  Package,
  Layers,
  Award,
  Maximize2,
  Sliders,
  Boxes,
  ShieldAlert,
} from 'lucide-react';

type ProductCatalogueTab =
  | 'products'
  | 'variants'
  | 'brands'
  | 'categories'
  | 'sizes'
  | 'thickness';

export default function ProductsPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  // Access control
  const canManageCatalogue = hasPermission(currentUser, 'catalogue:manage');
  const canManagePricing = hasPermission(currentUser, 'pricing:manage');
  const canViewCatalogue = hasPermission(currentUser, 'catalogue:view') || canManageCatalogue;

  const [activeTab, setActiveTab] = useState<ProductCatalogueTab>('products');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Query high-level counts
  const { data: products = [] } = useGetProductsQuery();
  const { data: variants = [] } = useGetVariantsQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();

  const activeVariantsCount = variants.filter((v) => v.status === 'active').length;

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({
      id: Date.now().toString(),
      type,
      title: type === 'success' ? 'Operation Completed' : type === 'error' ? 'Notice' : 'Information',
      message,
    });
  };

  const tabs: Array<{
    id: ProductCatalogueTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'products', label: 'Products', icon: Package, count: products.length },
    { id: 'variants', label: 'Variants & SKUs', icon: Boxes, count: variants.length },
    { id: 'brands', label: 'Brands', icon: Award, count: brands.length },
    { id: 'categories', label: 'Categories', icon: Layers, count: categories.length },
    { id: 'sizes', label: 'Sizes', icon: Maximize2 },
    { id: 'thickness', label: 'Thickness', icon: Sliders },
  ];

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
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Product Catalogue & Pricing
          </h1>
          <p className="text-[13px] sm:text-sm text-gray-500 mt-0.5 font-normal">
            Manage brands, brand-specific categories, dimensions, SKUs and dual retail/wholesale prices
          </p>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3">
          <div className="bg-white px-3.5 py-2 rounded-xl border border-gray-200/80 shadow-2xs">
            <span className="text-xs text-gray-400 block font-normal">Active SKUs</span>
            <span className="text-lg font-bold text-gray-900 font-mono">
              {activeVariantsCount} <span className="text-xs font-normal text-gray-400">/ {variants.length}</span>
            </span>
          </div>

          <div className="bg-white px-3.5 py-2 rounded-xl border border-gray-200/80 shadow-2xs">
            <span className="text-xs text-gray-400 block font-normal">Total Products</span>
            <span className="text-lg font-bold text-brand-blue font-mono">{products.length}</span>
          </div>
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

      {/* Tab Navigation Strip */}
      <div className="flex items-center gap-1.5 mb-6 text-sm font-medium bg-white p-1.5 rounded-xl border border-gray-200/80 w-full sm:w-fit overflow-x-auto shadow-2xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-xs sm:text-sm font-medium ${
                isActive
                  ? 'bg-brand-blue text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="transition-all">
        {activeTab === 'products' && (
          <ProductsTab
            canManage={canManageCatalogue}
            canManagePricing={canManagePricing}
            onToast={showToast}
            currentUserEmail={currentUser?.email}
          />
        )}

        {activeTab === 'variants' && (
          <VariantsTab
            canManage={canManageCatalogue}
            canManagePricing={canManagePricing}
            onToast={showToast}
            currentUserEmail={currentUser?.email}
          />
        )}

        {activeTab === 'brands' && (
          <BrandsTab canManage={canManageCatalogue} onToast={showToast} />
        )}

        {activeTab === 'categories' && (
          <CategoriesTab canManage={canManageCatalogue} onToast={showToast} />
        )}

        {activeTab === 'sizes' && (
          <SizesTab canManage={canManageCatalogue} onToast={showToast} />
        )}

        {activeTab === 'thickness' && (
          <ThicknessTab canManage={canManageCatalogue} onToast={showToast} />
        )}
      </div>

      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
}
