'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { Branch, BranchSettings } from '@/types';
import { useAppSelector } from '@/store';
import {
  useGetBranchesQuery,
  useGetBranchCountsQuery,
  useUpdateBranchSettingsMutation,
} from '@/store/services/apiSlice';
import AddBranchModal from '@/components/branches/AddBranchModal';
import EditBranchModal from '@/components/branches/EditBranchModal';
import BranchStatusModal from '@/components/branches/BranchStatusModal';
import ResetDemoModal from '@/components/branches/ResetDemoModal';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  Plus,
  Edit2,
  Power,
  Building2,
  Search,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Camera,
} from 'lucide-react';

export default function BranchesManagementPage() {
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Filters & Search state
  const [activeTab, setActiveTab] = useState<'all' | 'retail' | 'warehouse'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Query branches and dynamic counts
  const { data: branches = [], isLoading } = useGetBranchesQuery({
    search: searchQuery,
    type: activeTab,
    status: statusFilter,
  });

  const { data: counts = { total: 5, retail: 4, warehouse: 1, active: 5, inactive: 0 } } =
    useGetBranchCountsQuery();

  const [updateSettings, { isLoading: isSavingSettings }] = useUpdateBranchSettingsMutation();

  // Selected Branch for detail view & settings
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Active selected branch entity
  const selectedBranch = useMemo(() => {
    if (!branches || branches.length === 0) return null;
    if (selectedBranchId) {
      const found = branches.find((b) => b.id === selectedBranchId);
      if (found) return found;
    }
    return branches[0];
  }, [branches, selectedBranchId]);

  // Branch Settings pending user overrides (per branch ID)
  const [pendingSettings, setPendingSettings] = useState<Record<string, Partial<BranchSettings>>>({});

  // Active settings for currently selected branch
  const currentSettings: BranchSettings = useMemo(() => {
    const defaults: BranchSettings = {
      allowRetailSales: true,
      allowWholesaleSales: true,
      manageOwnInventory: false,
      showInReports: true,
    };
    if (!selectedBranch) return defaults;
    const saved = selectedBranch.settings || defaults;
    const overrides = pendingSettings[selectedBranch.id] || {};
    return { ...saved, ...overrides };
  }, [selectedBranch, pendingSettings]);

  const toggleSetting = (key: keyof BranchSettings) => {
    if (!selectedBranch) return;
    setPendingSettings((prev) => ({
      ...prev,
      [selectedBranch.id]: {
        ...(prev[selectedBranch.id] || {}),
        [key]: !currentSettings[key],
      },
    }));
  };

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTargetBranch, setEditTargetBranch] = useState<Branch | null>(null);
  const [statusTargetBranch, setStatusTargetBranch] = useState<Branch | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToast({
      id: Date.now().toString(),
      type,
      title,
      message,
    });
  };

  const handleSaveSettings = async () => {
    if (!selectedBranch) return;

    try {
      await updateSettings({
        id: selectedBranch.id,
        settings: currentSettings,
      }).unwrap();

      setPendingSettings((prev) => {
        const next = { ...prev };
        delete next[selectedBranch.id];
        return next;
      });

      showToast(
        'success',
        'Operational Settings Updated',
        `Governance toggles saved for ${selectedBranch.name}.`
      );
    } catch {
      showToast('error', 'Update Failed', 'Could not update branch settings.');
    }
  };

  // Human readable label for branch types
  const getBranchTypeLabel = (type?: string) => {
    switch (type) {
      case 'WHOLESALE_DEPOT':
        return 'Wholesale Depot / Godown';
      case 'WAREHOUSE':
        return 'Warehouse / Central Storage';
      case 'SHOWROOM':
        return 'Showroom / Display Center';
      case 'EXPRESS_COUNTER':
        return 'Express Counter';
      default:
        return 'Retail Store';
    }
  };

  return (
    <AppLayout>
      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header matching screenshot Screen 3 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Branches / Stores
          </h1>
          <p className="text-[13px] sm:text-sm text-gray-500 mt-0.5 font-normal">
            Manage all your retail stores, showrooms, and wholesale depots in the commercial market cluster
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Reset Demo Data Button */}
          <button
            onClick={() => setIsResetOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium shadow-2xs transition-colors cursor-pointer"
            title="Reset demo branches to baseline"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
            <span className="hidden sm:inline">Reset Demo Data</span>
          </button>

          {/* Add Branch Button (Restricted for Super Admin) */}
          {isSuperAdmin ? (
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Branch</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium border border-gray-200">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Admin Only: Add Branch</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs and Search Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        {/* Category Tabs with dynamic counts */}
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-brand-blue text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
            }`}
          >
            All Branches ({counts.total})
          </button>
          <button
            onClick={() => setActiveTab('retail')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'retail'
                ? 'bg-brand-blue text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
            }`}
          >
            Retail Stores ({counts.retail})
          </button>
          <button
            onClick={() => setActiveTab('warehouse')}
            className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'warehouse'
                ? 'bg-brand-blue text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50'
            }`}
          >
            Warehouses ({counts.warehouse})
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search branch, code, manager..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200/90 rounded-lg text-sm font-normal text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-blue shadow-2xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 bg-white border border-gray-200/90 rounded-lg text-sm font-medium text-gray-700 shadow-2xs focus:outline-hidden cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active ({counts.active})</option>
            <option value="inactive">Inactive ({counts.inactive})</option>
          </select>
        </div>
      </div>

      {/* Table of Branches */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-10">#</th>
                <th className="py-3.5 px-4">Branch Name</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Manager</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                      <span>Loading branch repository...</span>
                    </div>
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-500">
                    <p className="font-medium text-gray-700">No branches match the selected filters.</p>
                    <p className="text-[13px] text-gray-400 mt-1 font-normal">
                      Try clearing your search term or tab filter.
                    </p>
                  </td>
                </tr>
              ) : (
                branches.map((b, idx) => {
                  const isSelected = selectedBranch?.id === b.id;

                  return (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60 font-medium' : ''
                      }`}
                    >
                      <td className="py-4 px-4 text-gray-400 font-normal">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              b.isActive
                                ? 'bg-blue-50 text-brand-blue'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Building2 className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="block text-sm font-medium">{b.name}</span>
                            <span className="text-xs font-mono text-gray-400 font-normal">
                              {b.code} {b.shopNumber ? `• ${b.shopNumber}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                          {getBranchTypeLabel(b.type)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-600 truncate max-w-[180px] text-sm font-normal">
                        {b.city}
                      </td>
                      <td className="py-4 px-4 font-mono text-gray-600 text-sm">
                        {b.phone}
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-900 text-sm">
                        {b.managerName}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {b.isActive ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 text-gray-400">
                          {/* Drilldown to Branch Dashboard */}
                          <Link
                            href={`/branch/dashboard?branchId=${b.id}`}
                            className="p-1.5 hover:text-brand-blue rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                            title="Open Branch Counter Dashboard"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          {/* Edit Action (Super Admin or assigned manager) */}
                          <button
                            onClick={() => setEditTargetBranch(b)}
                            className="p-1 hover:text-brand-blue rounded hover:bg-gray-100 transition-colors cursor-pointer"
                            title="Edit Branch Information"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active/Inactive (Super Admin only) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => setStatusTargetBranch(b)}
                              className={`p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer ${
                                b.isActive
                                  ? 'hover:text-amber-600 text-gray-400'
                                  : 'hover:text-emerald-600 text-emerald-600'
                              }`}
                              title={b.isActive ? 'Deactivate Branch' : 'Activate Branch'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Section: Branch Information & Settings */}
      {selectedBranch && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column: Branch Information */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Branch Information
                  </h3>
                  <span className="text-[11px] text-gray-400">
                    Selected Node: {selectedBranch.code}
                  </span>
                </div>

                <button
                  onClick={() => setEditTargetBranch(selectedBranch)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-brand-blue flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Details</span>
                </button>
              </div>

              {/* Storefront Photo and Quick Preview */}
              <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3 rounded-xl bg-gray-50/80 border border-gray-200/80">
                <div className="relative w-28 h-20 rounded-lg overflow-hidden border border-gray-300 bg-slate-200 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      selectedBranch.imageUrl ||
                      'https://images.unsplash.com/photo-1555529771-7888783a18d3?auto=format&fit=crop&w=600&q=80'
                    }
                    alt={selectedBranch.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setEditTargetBranch(selectedBranch)}
                    className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{selectedBranch.name}</span>
                    {selectedBranch.isActive ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                        Operational
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-gray-200 text-gray-700">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{selectedBranch.address}</p>
                  <p className="text-[11px] text-gray-600 mt-1 font-mono">
                    Contact: {selectedBranch.phone} • Manager: {selectedBranch.managerName}
                  </p>
                </div>
              </div>

              {/* Form Input Displays */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    value={selectedBranch.name}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Type *
                    </label>
                    <input
                      type="text"
                      value={getBranchTypeLabel(selectedBranch.type)}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Shop / Stall Number
                    </label>
                    <input
                      type="text"
                      value={selectedBranch.shopNumber || selectedBranch.code}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={selectedBranch.address}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={selectedBranch.phone}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">
                      Assigned Manager
                    </label>
                    <input
                      type="text"
                      value={selectedBranch.managerName}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium"
                    />
                  </div>
                </div>

                {/* Status Toggle Row */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="font-semibold text-gray-700 block">Operating Status</span>
                    <span className="text-[10px] text-gray-400">
                      {selectedBranch.isActive
                        ? 'Location is open for transactions'
                        : 'Location operations suspended'}
                    </span>
                  </div>

                  {isSuperAdmin ? (
                    <button
                      type="button"
                      onClick={() => setStatusTargetBranch(selectedBranch)}
                      className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                        selectedBranch.isActive
                          ? 'bg-emerald-500 justify-end'
                          : 'bg-gray-300 justify-start'
                      }`}
                      title="Click to toggle branch operational status"
                    >
                      <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                    </button>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedBranch.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {selectedBranch.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4">
              <Link
                href={`/branch/dashboard?branchId=${selectedBranch.id}`}
                className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5 text-brand-blue" />
                <span>Launch Counter Dashboard for {selectedBranch.name}</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Branch Settings */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-sm">
                  Branch Settings & Governance
                </h3>
                <span className="text-[11px] text-gray-400">
                  {selectedBranch.name}
                </span>
              </div>

              <div className="space-y-4 text-xs">
                {/* Allow Retail Sales */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <span className="font-semibold text-gray-800 block">Allow Retail Sales</span>
                    <span className="text-[11px] text-gray-400">
                      Enable walk-in counter invoicing and POS at this shop
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('allowRetailSales')}
                    className={`w-9 h-5 rounded-full flex items-center px-1 transition-colors cursor-pointer shrink-0 ml-3 ${
                      currentSettings.allowRetailSales ? 'bg-brand-blue justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                  </button>
                </div>

                {/* Allow Wholesale Sales */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <span className="font-semibold text-gray-800 block">Allow Wholesale Sales</span>
                    <span className="text-[11px] text-gray-400">
                      Enable commercial bulk delivery and B2B pricing terms
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('allowWholesaleSales')}
                    className={`w-9 h-5 rounded-full flex items-center px-1 transition-colors cursor-pointer shrink-0 ml-3 ${
                      currentSettings.allowWholesaleSales ? 'bg-brand-blue justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                  </button>
                </div>

                {/* Manage Own Inventory */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <span className="font-semibold text-gray-800 block">Manage Own Inventory</span>
                    <span className="text-[11px] text-gray-400">
                      Independent local stock reordering & threshold alerts
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('manageOwnInventory')}
                    className={`w-9 h-5 rounded-full flex items-center px-1 transition-colors cursor-pointer shrink-0 ml-3 ${
                      currentSettings.manageOwnInventory ? 'bg-brand-blue justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                  </button>
                </div>

                {/* Show in Reports */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div>
                    <span className="font-semibold text-gray-800 block">Show in Reports</span>
                    <span className="text-[11px] text-gray-400">
                      Include branch revenue in executive group consolidated report
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('showInReports')}
                    className={`w-9 h-5 rounded-full flex items-center px-1 transition-colors cursor-pointer shrink-0 ml-3 ${
                      currentSettings.showInReports ? 'bg-brand-blue justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="w-full mt-6 py-2.5 px-4 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {isSavingSettings ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      <AddBranchModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={(created) => {
          setSelectedBranchId(created.id);
          showToast(
            'success',
            'Branch Registered Successfully',
            `${created.name} (${created.code}) is now active in the market cluster.`
          );
        }}
      />

      {/* Edit Branch Modal */}
      <EditBranchModal
        branch={editTargetBranch}
        isOpen={Boolean(editTargetBranch)}
        onClose={() => setEditTargetBranch(null)}
        onSuccess={(updated) => {
          showToast(
            'success',
            'Branch Updated Successfully',
            `Changes saved for ${updated.name}.`
          );
        }}
      />

      {/* Status Deactivation/Activation Confirmation Modal */}
      <BranchStatusModal
        branch={statusTargetBranch}
        isOpen={Boolean(statusTargetBranch)}
        onClose={() => setStatusTargetBranch(null)}
        onSuccess={(updated) => {
          showToast(
            'info',
            updated.isActive ? 'Branch Activated' : 'Branch Deactivated',
            `${updated.name} operational status updated. Historical sales preserved.`
          );
        }}
      />

      {/* Reset Demo Data Modal */}
      <ResetDemoModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onSuccess={() => {
          showToast(
            'info',
            'Demo Database Reset',
            'Baseline 5 market cluster shops successfully restored.'
          );
        }}
      />
    </AppLayout>
  );
}
