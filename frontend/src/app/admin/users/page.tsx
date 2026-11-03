'use client';

import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { User } from '@/types';
import {
  useGetUsersQuery,
  useGetUserCountsQuery,
  useGetBranchesQuery,
  useUpdateUserMutation,
} from '@/store/services/apiSlice';
import { getRoleBadge } from '@/lib/permissions';
import AddUserModal from '@/components/users/AddUserModal';
import EditUserModal from '@/components/users/EditUserModal';
import UserStatusModal from '@/components/users/UserStatusModal';
import RoleManagementModal from '@/components/users/RoleManagementModal';
import ResetDemoModal from '@/components/branches/ResetDemoModal';
import PermissionsMatrix from '@/components/users/PermissionsMatrix';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  Plus,
  Edit2,
  Power,
  User as UserIcon,
  Search,
  RotateCcw,
  Shield,
  Building2,
  Check,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';

type TabType = 'all' | 'managers' | 'cashiers' | 'wholesale' | 'inventory' | 'accountants' | 'admins';

export default function UsersManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Convert tab to role query filter
  const roleQueryFilter = useMemo(() => {
    switch (activeTab) {
      case 'managers':
        return 'BRANCH_MANAGER';
      case 'cashiers':
        return 'CASHIER';
      case 'wholesale':
        return 'WHOLESALE_STAFF';
      case 'inventory':
        return 'INVENTORY_OFFICER';
      case 'accountants':
        return 'ACCOUNTANT';
      case 'admins':
        return 'SUPER_ADMIN';
      default:
        return 'all';
    }
  }, [activeTab]);

  // RTK Queries
  const { data: users = [], isLoading } = useGetUsersQuery({
    search: searchQuery,
    role: roleQueryFilter,
    branchId: branchFilter,
    status: statusFilter,
  });

  const { data: counts = {
    total: 0,
    active: 0,
    inactive: 0,
    managers: 0,
    cashiers: 0,
    wholesale: 0,
    inventory: 0,
    accountants: 0,
    superAdmins: 0,
  } } = useGetUserCountsQuery();

  const { data: branches = [] } = useGetBranchesQuery();
  const [updateUser, { isLoading: isUpdatingUser }] = useUpdateUserMutation();

  // Selected user for bottom inspector
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const selectedUser = useMemo(() => {
    if (!users || users.length === 0) return null;
    if (selectedUserId) {
      const found = users.find((u) => u.id === selectedUserId);
      if (found) return found;
    }
    return users[0];
  }, [users, selectedUserId]);

  // Local state for bottom permission editor overrides (per user ID)
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, string[]>>({});

  const currentInspectorPermissions = useMemo(() => {
    if (!selectedUser) return [];
    if (permissionOverrides[selectedUser.id]) {
      return permissionOverrides[selectedUser.id];
    }
    return selectedUser.customPermissions && selectedUser.customPermissions.length > 0
      ? selectedUser.customPermissions
      : [];
  }, [selectedUser, permissionOverrides]);

  const handleInspectorPermissionChange = (newPerms: string[]) => {
    if (!selectedUser) return;
    setPermissionOverrides((prev) => ({
      ...prev,
      [selectedUser.id]: newPerms,
    }));
  };

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTargetUser, setEditTargetUser] = useState<User | null>(null);
  const [statusTargetUser, setStatusTargetUser] = useState<User | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToast({
      id: Date.now().toString(),
      type,
      title,
      message,
    });
  };

  const handleSaveInspectorPermissions = async () => {
    if (!selectedUser) return;

    try {
      await updateUser({
        id: selectedUser.id,
        input: {
          customPermissions: currentInspectorPermissions,
        },
      }).unwrap();

      showToast(
        'success',
        'Permissions Updated',
        `Access privileges updated for ${selectedUser.name}.`
      );
    } catch {
      showToast('error', 'Update Failed', 'Could not save permission adjustments.');
    }
  };

  // Resolve branch name for table pill
  const getBranchName = (user: User): string => {
    if (user.role === 'SUPER_ADMIN') return 'All Branches (Consolidated)';
    if (!user.assignedBranchId) return 'Unassigned';
    const found = branches.find((b) => b.id === user.assignedBranchId);
    if (!found) return user.assignedBranchId;

    if (user.assignedBranchIds && user.assignedBranchIds.length > 1) {
      return `${found.name} (+${user.assignedBranchIds.length - 1} more)`;
    }
    return found.name;
  };

  return (
    <AppLayout>
      {/* Toast Notification Container */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Users & Staff Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-brand-blue border border-blue-200">
              RBAC Matrix Active
            </span>
          </div>
          <p className="text-[13px] sm:text-sm text-gray-500 mt-0.5 font-normal">
            Manage employee profiles, role assignments, and permission matrices across the commercial market cluster
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Reset Demo Data Button */}
          <button
            onClick={() => setIsResetOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium shadow-2xs transition-colors cursor-pointer"
            title="Reset to default 10 verified personas"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
            <span className="hidden sm:inline">Reset Demo Data</span>
          </button>

          {/* Role Management Modal Button */}
          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-purple-200 hover:bg-purple-50 text-purple-700 rounded-lg text-sm font-medium shadow-2xs transition-colors cursor-pointer"
            title="Configure System Roles and Custom Permission Matrices"
          >
            <Shield className="w-4 h-4 text-purple-600" />
            <span>Roles & Matrix</span>
          </button>

          {/* Add User Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Dynamic Role Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'bg-brand-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Staff ({counts.total})
        </button>
        <button
          onClick={() => setActiveTab('managers')}
          className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'managers'
              ? 'bg-brand-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Branch Managers ({counts.managers})
        </button>
        <button
          onClick={() => setActiveTab('cashiers')}
          className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'cashiers'
              ? 'bg-brand-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Cashiers ({counts.cashiers})
        </button>
        <button
          onClick={() => setActiveTab('wholesale')}
          className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'wholesale'
              ? 'bg-brand-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Wholesale Staff ({counts.wholesale})
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-brand-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Inventory Officers ({counts.inventory})
        </button>
        <button
          onClick={() => setActiveTab('accountants')}
          className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'accountants'
              ? 'bg-brand-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Accountants ({counts.accountants})
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'admins'
              ? 'bg-brand-blue text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Super Admins ({counts.superAdmins})
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-normal text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-blue shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 cursor-pointer focus:outline-hidden shadow-2xs"
          >
            <option value="all">All Market Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 cursor-pointer focus:outline-hidden shadow-2xs"
          >
            <option value="all">All Statuses ({counts.total})</option>
            <option value="active">Active Only ({counts.active})</option>
            <option value="inactive">Inactive Only ({counts.inactive})</option>
          </select>
        </div>
      </div>

      {/* Main Users Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-10">#</th>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Email / Phone</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Branch Location</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <span className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    <span>Loading staff directory...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <UserIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p className="font-medium text-gray-600">No staff members found.</p>
                    <p className="text-[13px] text-gray-400 mt-0.5 font-normal">
                      Try clearing search filters or add a new team member.
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((u, idx) => {
                  const roleBadge = getRoleBadge(u.role);
                  const isSelected = selectedUser?.id === u.id;
                  const isActive = u.isActive ?? true;

                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/40' : 'hover:bg-gray-50/70'
                      }`}
                    >
                      <td className="py-4 px-4 text-gray-400 font-normal">
                        {idx + 1}
                      </td>

                      <td className="py-4 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              u.avatarUrl ||
                              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
                            }
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                          />
                          <div>
                            <span className="block leading-tight text-gray-900 text-sm font-medium">{u.name}</span>
                            <span className="text-xs font-normal text-gray-400 leading-tight">
                              {u.designation}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-gray-600">
                        <div className="text-sm font-normal text-gray-700">{u.email}</div>
                        <span className="text-xs font-mono text-gray-400">{u.phone || '—'}</span>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-medium text-xs border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                        >
                          {u.roleName || roleBadge.label}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-normal text-gray-800 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{getBranchName(u)}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5 text-gray-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Edit button */}
                          <button
                            onClick={() => setEditTargetUser(u)}
                            className="p-1.5 hover:text-brand-blue hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Employee Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Status toggle button */}
                          <button
                            onClick={() => setStatusTargetUser(u)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              isActive
                                ? 'hover:text-amber-600 hover:bg-amber-50'
                                : 'hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isActive ? 'Deactivate Account' : 'Activate Account'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
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

      {/* Bottom Section: User Information & Role / Permissions Inspector */}
      {selectedUser && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* User Information Card */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 mb-5">
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">
                    Employee Profile Overview
                  </h3>
                  <span className="text-xs text-gray-400 font-mono font-normal">
                    ID: {selectedUser.id}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditTargetUser(selectedUser)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Edit Profile</span>
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    selectedUser.avatarUrl ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
                  }
                  alt={selectedUser.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 shadow-xs shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-900 leading-tight">
                      {selectedUser.name}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedUser.isActive ?? true
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedUser.isActive ?? true ? 'Operational' : 'Suspended'}
                    </span>
                  </div>
                  <span className="text-sm font-normal text-gray-500 block mt-0.5">
                    {selectedUser.designation}
                  </span>
                  <span className="text-xs font-mono text-gray-400 block mt-1 font-normal">
                    Registered: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Verified Account'}
                  </span>
                </div>
              </div>

              <div className="space-y-4 text-sm font-normal">
                <div>
                  <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                    Work Email Address
                  </label>
                  <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200 font-normal text-gray-800 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{selectedUser.email}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                    Contact Phone Number
                  </label>
                  <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-gray-800 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{selectedUser.phone || '0300-0000000'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                    Assigned Primary Branch
                  </label>
                  <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200 font-normal text-gray-800 text-sm">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span>{getBranchName(selectedUser)}</span>
                  </div>
                </div>

                {selectedUser.assignedBranchIds && selectedUser.assignedBranchIds.length > 1 && (
                  <div>
                    <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                      Multi-Branch Authorizations ({selectedUser.assignedBranchIds.length})
                    </label>
                    <div className="flex flex-wrap gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                      {selectedUser.assignedBranchIds.map((bId) => {
                        const bName = branches.find((b) => b.id === bId)?.name || bId;
                        return (
                          <span
                            key={bId}
                            className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-700"
                          >
                            {bName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span className="flex items-center gap-1.5 font-normal">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Identity Verified</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusTargetUser(selectedUser)}
                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors cursor-pointer"
              >
                {selectedUser.isActive ?? true ? 'Deactivate Account' : 'Reactivate Account'}
              </button>
            </div>
          </div>

          {/* Role & Permissions Inspector Card */}
          <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 mb-5">
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">
                    Role & Permissions Matrix
                  </h3>
                  <span className="text-[13px] text-gray-500 font-normal">
                    Review and adjust security privileges for {selectedUser.name}
                  </span>
                </div>

                <span
                  className={`px-3 py-1 rounded-md text-xs font-medium border ${
                    getRoleBadge(selectedUser.role).bg
                  } ${getRoleBadge(selectedUser.role).text} ${
                    getRoleBadge(selectedUser.role).border
                  }`}
                >
                  {selectedUser.roleName || selectedUser.role}
                </span>
              </div>

              {selectedUser.role === 'SUPER_ADMIN' ? (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 text-purple-900 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-purple-800">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>Master Administrator Privileges</span>
                  </div>
                  <p className="leading-relaxed font-normal">
                    Super Admin accounts possess full, unrestricted access to all 5 commercial market cluster shops,
                    accounting ledgers, user governance, and POS modules. Permissions cannot be modified.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">
                      Effective Module Permissions ({currentInspectorPermissions.length} active)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRoleModalOpen(true)}
                      className="text-brand-blue hover:text-blue-800 font-medium text-xs cursor-pointer"
                    >
                      Manage Roles
                    </button>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto pr-1">
                    <PermissionsMatrix
                      selectedPermissions={currentInspectorPermissions}
                      onChange={handleInspectorPermissionChange}
                    />
                  </div>
                </div>
              )}
            </div>

            {selectedUser.role !== 'SUPER_ADMIN' && (
              <button
                type="button"
                onClick={handleSaveInspectorPermissions}
                disabled={isUpdatingUser}
                className="w-full mt-5 py-2.5 px-4 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isUpdatingUser ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Privileges...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save User Permissions</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={(created) => {
          setSelectedUserId(created.id);
          showToast(
            'success',
            'Employee Registered Successfully',
            `${created.name} (${created.roleName || created.role}) is now active in the system.`
          );
        }}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={editTargetUser}
        isOpen={Boolean(editTargetUser)}
        onClose={() => setEditTargetUser(null)}
        onSuccess={(updated) => {
          showToast(
            'success',
            'User Updated Successfully',
            `Changes saved for ${updated.name}.`
          );
        }}
      />

      {/* Status Activation / Deactivation Modal */}
      <UserStatusModal
        user={statusTargetUser}
        isOpen={Boolean(statusTargetUser)}
        onClose={() => setStatusTargetUser(null)}
        onSuccess={(updated) => {
          showToast(
            'info',
            updated.isActive ? 'Account Activated' : 'Account Deactivated',
            `${updated.name} operational status updated. Historical audits preserved.`
          );
        }}
      />

      {/* Roles & Permissions Management Modal */}
      <RoleManagementModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSuccessToast={(msg) => showToast('success', 'Role Updated', msg)}
      />

      {/* Reset Demo Data Modal */}
      <ResetDemoModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onSuccess={() => {
          showToast(
            'info',
            'Demo Database Reset',
            'Baseline 10 verified personas and 5 cluster shops successfully restored.'
          );
        }}
      />
    </AppLayout>
  );
}
