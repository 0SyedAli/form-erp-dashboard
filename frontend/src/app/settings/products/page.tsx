'use client';

import React, { useState, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector, RootState } from '@/store';
import { hasPermission } from '@/lib/permissions';
import {
  useGetBrandsQuery as useGetDemoBrandsQuery,
  useGetCategoriesQuery as useGetDemoCategoriesQuery,
  useGetSizesQuery as useGetDemoSizesQuery,
  useGetThicknessQuery as useGetDemoThicknessQuery,
} from '@/store/services/apiSlice';
import {
  useGetBrandsQuery as useGetBackendBrandsQuery,
  useGetCategoriesQuery as useGetBackendCategoriesQuery,
  useGetSizesQuery as useGetBackendSizesQuery,
  useGetThicknessesQuery as useGetBackendThicknessesQuery,
} from '@/store/services/catalogueApi';
import Toast, { ToastMessage } from '@/components/common/Toast';
import BrandsTab from '@/components/products/BrandsTab';
import CategoriesTab from '@/components/products/CategoriesTab';
import SizesTab from '@/components/products/SizesTab';
import ThicknessTab from '@/components/products/ThicknessTab';
import {
  Award,
  Layers,
  Maximize2,
  Sliders,
  ShieldAlert,
  Settings,
} from 'lucide-react';

type MasterDataTab = 'brands' | 'categories' | 'sizes' | 'thickness';

function ProductSettingsContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  // Access control
  const canManageCatalogue = hasPermission(currentUser, 'catalogue:manage');
  const canViewCatalogue = hasPermission(currentUser, 'catalogue:view') || canManageCatalogue;

  const [activeTab, setActiveTab] = useState<MasterDataTab>('brands');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Queries for live counts (Backend primary with Demo fallback)
  const isBackendMode = process.env.NEXT_PUBLIC_USE_BACKEND !== 'false';
  const { data: backendBrands = [] } = useGetBackendBrandsQuery(undefined, { skip: !isBackendMode });
  const { data: demoBrands = [] } = useGetDemoBrandsQuery(undefined, { skip: isBackendMode });
  const brands = isBackendMode ? (Array.isArray(backendBrands) ? backendBrands : (backendBrands as any)?.data || []) : demoBrands;

  const { data: backendCategories = [] } = useGetBackendCategoriesQuery(undefined, { skip: !isBackendMode });
  const { data: demoCategories = [] } = useGetDemoCategoriesQuery(undefined, { skip: isBackendMode });
  const categories = isBackendMode ? (Array.isArray(backendCategories) ? backendCategories : (backendCategories as any)?.data || []) : demoCategories;

  const { data: backendSizes = [] } = useGetBackendSizesQuery(undefined, { skip: !isBackendMode });
  const { data: demoSizes = [] } = useGetDemoSizesQuery(undefined, { skip: isBackendMode });
  const sizes = isBackendMode ? (Array.isArray(backendSizes) ? backendSizes : (backendSizes as any)?.data || []) : demoSizes;

  const { data: backendThicknesses = [] } = useGetBackendThicknessesQuery(undefined, { skip: !isBackendMode });
  const { data: demoThicknesses = [] } = useGetDemoThicknessQuery(undefined, { skip: isBackendMode });
  const thicknesses = isBackendMode ? (Array.isArray(backendThicknesses) ? backendThicknesses : (backendThicknesses as any)?.data || []) : demoThicknesses;

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({
      id: Date.now().toString(),
      type,
      title: type === 'success' ? 'Saved' : type === 'error' ? 'Notice' : 'Information',
      message,
    });
  };

  const tabs: Array<{
    id: MasterDataTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'brands', label: 'Brands', icon: Award, count: brands.length },
    { id: 'categories', label: 'Categories', icon: Layers, count: categories.length },
    { id: 'sizes', label: 'Sizes', icon: Maximize2, count: sizes.length },
    { id: 'thickness', label: 'Thicknesses', icon: Sliders, count: thicknesses.length },
  ];

  if (currentUser && !canViewCatalogue) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-gray-600 bg-white rounded-2xl border border-gray-200 mt-6 max-w-lg mx-auto shadow-xs">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Master Data Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-1">
            Your current role (<span className="font-semibold text-gray-800">{currentUser.role}</span>) does not have permission to configure master product attributes.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-brand-blue rounded-lg">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-sans">
              Product Master Data Settings
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage global specifications: mattress brands, brand-specific categories, standard dimensions, and thicknesses
          </p>
        </div>
      </div>

      {/* Tab Navigation Strip */}
      <div className="flex items-center gap-1.5 mb-6 text-sm font-medium bg-white p-1.5 rounded-xl border border-gray-200/80 w-full sm:w-fit overflow-x-auto shadow-2xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-xs sm:text-sm font-semibold ${
                isActive
                  ? 'bg-brand-blue text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
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

export default function ProductSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Loading Master Data...</div>}>
      <ProductSettingsContent />
    </Suspense>
  );
}

