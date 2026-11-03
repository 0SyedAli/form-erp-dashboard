'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { Branch, BranchSettings, BranchAccessPermissions } from '@/types';
import { DEFAULT_BRANCH_PERMISSIONS } from '@/lib/demo-db';
import { useAppSelector } from '@/store';
import {
  useGetBranchesQuery,
  useGetBranchCountsQuery,
  useUpdateBranchSettingsMutation,
  useUpdateBranchPermissionsMutation,
  useResetBranchPasswordMutation,
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
  KeyRound,
  ShieldCheck,
  CheckCircle2,
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
  const [updatePermissions, { isLoading: isSavingPermissions }] = useUpdateBranchPermissionsMutation();
  const [resetPassword, { isLoading: isResettingPassword }] = useResetBranchPasswordMutation();

  // Selected Branch for detail view & settings
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

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
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, Partial<BranchAccessPermissions>>>({});

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

  const currentPermissions: BranchAccessPermissions = useMemo(() => {
    const defaults: BranchAccessPermissions = DEFAULT_BRANCH_PERMISSIONS;
    if (!selectedBranch) return defaults;
    const saved = selectedBranch.permissions || defaults;
    const overrides = pendingPermissions[selectedBranch.id] || {};
    return { ...saved, ...overrides };
  }, [selectedBranch, pendingPermissions]);

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

  const togglePermission = (key: keyof BranchAccessPermissions) => {
    if (!selectedBranch) return;
    setPendingPermissions((prev) => ({
      ...prev,
      [selectedBranch.id]: {
        ...(prev[selectedBranch.id] || {}),
        [key]: !currentPermissions[key],
      },
    }));
  };

  const setAllPermissions = (enabled: boolean) => {
    if (!selectedBranch) return;
    const allKeys: (keyof BranchAccessPermissions)[] = [
      'pos', 'viewOwnSales', 'viewOwnRevenue', 'viewProducts', 'addEditProducts',
      'viewStock', 'manageStock', 'stockTransfers', 'customers', 'customerCredit',
      'purchases', 'suppliers', 'reports', 'returns', 'discountsOverrides'
    ];
    const newPerms: Partial<BranchAccessPermissions> = {};
    allKeys.forEach((k) => {
      newPerms[k] = enabled;
    });
    setPendingPermissions((prev) => ({
      ...prev,
      [selectedBranch.id]: newPerms,
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

  const handleSaveAccessControl = async () => {
    if (!selectedBranch) return;

    try {
      await Promise.all([
        updateSettings({
          id: selectedBranch.id,
          settings: currentSettings,
        }).unwrap(),
        updatePermissions({
          id: selectedBranch.id,
          permissions: currentPermissions,
        }).unwrap(),
      ]);

      setPendingSettings((prev) => {
        const next = { ...prev };
        delete next[selectedBranch.id];
        return next;
      });

      setPendingPermissions((prev) => {
        const next = { ...prev };
        delete next[selectedBranch.id];
        return next;
      });

      showToast(
        'success',
        'Branch Access & Settings Saved',
        `Permissions and operational settings updated for ${selectedBranch.name}.`
      );
    } catch {
      showToast('error', 'Update Failed', 'Could not update branch access permissions.');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedBranch || !newPassword.trim()) {
      showToast('error', 'Password Required', 'Please enter a new password.');
      return;
    }
    try {
      await resetPassword({
        id: selectedBranch.id,
        password: newPassword.trim(),
      }).unwrap();
      setNewPassword('');
      showToast(
        'success',
        'Password Reset Successful',
        `New password established for branch "${selectedBranch.loginId || selectedBranch.code}".`
      );
    } catch {
      showToast('error', 'Reset Failed', 'Could not reset password.');
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

          {/* Right Column: Branch Account & Permissions */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-blue" />
                    <span>Branch Account & Access Control</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Credentials and module permissions for {selectedBranch.name}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">
                  {selectedBranch.code}
                </span>
              </div>

              {/* Login Credentials Box */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800">Branch Login Credentials</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                    Direct POS Login
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-gray-500 font-medium mb-1">Login ID</label>
                    <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg font-mono font-bold text-gray-800">
                      {selectedBranch.loginId || selectedBranch.code.toLowerCase().replace(/[^a-z0-9]/g, '')}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-500 font-medium mb-1">Reset Password</label>
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-blue"
                      />
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={isResettingPassword || !newPassword.trim()}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        {isResettingPassword ? '...' : 'Reset'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module Permissions Header with Bulk Actions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Module Access Permissions (15)
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllPermissions(true)}
                      className="text-[11px] font-semibold text-brand-blue hover:underline cursor-pointer"
                    >
                      Enable All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newPerms: Partial<BranchAccessPermissions> = {
                          pos: true,
                          viewOwnSales: false,
                          viewOwnRevenue: false,
                          viewProducts: false,
                          addEditProducts: false,
                          viewStock: false,
                          manageStock: false,
                          stockTransfers: false,
                          customers: false,
                          customerCredit: false,
                          purchases: false,
                          suppliers: false,
                          reports: false,
                          returns: false,
                          discountsOverrides: false,
                        };
                        setPendingPermissions((prev) => ({
                          ...prev,
                          [selectedBranch.id]: newPerms,
                        }));
                      }}
                      className="text-[11px] font-semibold text-gray-600 hover:underline cursor-pointer"
                    >
                      POS Only (Default)
                    </button>
                  </div>
                </div>

                {/* 15 Permissions Grid */}
                <div className="grid grid-cols-1 gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {[
                    { key: 'pos', label: 'POS Counter & Invoicing', desc: 'Allows counter cashiers to create retail and wholesale bills' },
                    { key: 'viewOwnSales', label: 'View Own Sales History', desc: 'Branch can view past invoices generated at this store' },
                    { key: 'viewOwnRevenue', label: 'View Revenue & Sales Totals', desc: 'Branch can view revenue analytics and register metrics' },
                    { key: 'viewProducts', label: 'View Product Catalogue', desc: 'Can browse product prices, sizes, and specifications' },
                    { key: 'addEditProducts', label: 'Add & Edit Products', desc: 'Can modify prices, titles, or create new catalogue items' },
                    { key: 'viewStock', label: 'View Stock Balances', desc: 'Can view inventory on hand for this branch' },
                    { key: 'manageStock', label: 'Manage Stock & Counts', desc: 'Can update physical quantities and manage stock entries' },
                    { key: 'stockTransfers', label: 'Stock Transfers', desc: 'Can send or receive stock from sister branches' },
                    { key: 'customers', label: 'Customer Directory', desc: 'Can search and register customer contact profiles' },
                    { key: 'customerCredit', label: 'Customer Credit & Udhaar', desc: 'Can issue credit invoices and record recovery payments' },
                    { key: 'purchases', label: 'Purchases & Inward Orders', desc: 'Can create and receive purchase orders from suppliers' },
                    { key: 'suppliers', label: 'Supplier Directory', desc: 'Can view suppliers, cost lists and payable balances' },
                    { key: 'reports', label: 'Branch Reports', desc: 'Can access daily performance and financial summaries' },
                    { key: 'returns', label: 'Returns & Exchanges', desc: 'Can process customer returns or supplier return notes' },
                    { key: 'discountsOverrides', label: 'Discounts & Price Overrides', desc: 'Can apply bill discounts or custom price adjustments' },
                  ].map((perm) => {
                    const isChecked = !!currentPermissions[perm.key as keyof BranchAccessPermissions];
                    return (
                      <div
                        key={perm.key}
                        onClick={() => togglePermission(perm.key as keyof BranchAccessPermissions)}
                        className={`flex items-start justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-blue-50/50 border-blue-200'
                            : 'bg-gray-50/40 border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div className="pr-3">
                          <span className={`text-xs font-semibold block ${isChecked ? 'text-blue-900' : 'text-gray-700'}`}>
                            {perm.label}
                          </span>
                          <span className="text-[10px] text-gray-500 leading-tight block mt-0.5">
                            {perm.desc}
                          </span>
                        </div>
                        <div
                          className={`w-8 h-4.5 rounded-full flex items-center px-0.5 transition-colors shrink-0 mt-0.5 ${
                            isChecked ? 'bg-brand-blue justify-end' : 'bg-gray-300 justify-start'
                          }`}
                        >
                          <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Operational Governance Settings */}
              <div className="border-t border-gray-100 pt-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2.5">
                  Operational Governance
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    onClick={() => toggleSetting('allowRetailSales')}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer"
                  >
                    <span className="text-[11px] font-medium text-gray-700">Allow Retail Sales</span>
                    <input
                      type="checkbox"
                      checked={currentSettings.allowRetailSales}
                      onChange={() => {}}
                      className="rounded text-brand-blue cursor-pointer"
                    />
                  </div>
                  <div
                    onClick={() => toggleSetting('allowWholesaleSales')}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer"
                  >
                    <span className="text-[11px] font-medium text-gray-700">Allow Wholesale</span>
                    <input
                      type="checkbox"
                      checked={currentSettings.allowWholesaleSales}
                      onChange={() => {}}
                      className="rounded text-brand-blue cursor-pointer"
                    />
                  </div>
                  <div
                    onClick={() => toggleSetting('manageOwnInventory')}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer"
                  >
                    <span className="text-[11px] font-medium text-gray-700">Manage Own Stock</span>
                    <input
                      type="checkbox"
                      checked={currentSettings.manageOwnInventory}
                      onChange={() => {}}
                      className="rounded text-brand-blue cursor-pointer"
                    />
                  </div>
                  <div
                    onClick={() => toggleSetting('showInReports')}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50/50 cursor-pointer"
                  >
                    <span className="text-[11px] font-medium text-gray-700">Show in Reports</span>
                    <input
                      type="checkbox"
                      checked={currentSettings.showInReports}
                      onChange={() => {}}
                      className="rounded text-brand-blue cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveAccessControl}
              disabled={isSavingSettings || isSavingPermissions}
              className="w-full mt-4 py-2.5 px-4 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {isSavingSettings || isSavingPermissions ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Permissions & Governance...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Access Permissions & Settings</span>
                </>
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
