'use client';

import React, { useState } from 'react';
import { Role } from '@/types';
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
} from '@/store/services/apiSlice';
import PermissionsMatrix from './PermissionsMatrix';
import { X, Shield, Plus, Check, Lock } from 'lucide-react';

interface RoleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
}

export default function RoleManagementModal({
  isOpen,
  onClose,
  onSuccessToast,
}: RoleManagementModalProps) {
  const { data: roles = [] } = useGetRolesQuery();
  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();

  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || 'ROLE_SUPER_ADMIN');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New role form state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active selected role for inspection / editing
  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];
  const [editedPermissions, setEditedPermissions] = useState<string[]>([]);

  // When selected role changes, initialize edited permissions
  const handleSelectRole = (r: Role) => {
    setSelectedRoleId(r.id);
    setIsCreatingNew(false);
    setEditedPermissions(r.permissions);
    setErrorMsg(null);
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    setErrorMsg(null);

    try {
      await updateRole({
        id: selectedRole.id,
        input: {
          permissions: editedPermissions.length > 0 ? editedPermissions : selectedRole.permissions,
        },
      }).unwrap();

      if (onSuccessToast) {
        onSuccessToast(`Role permissions updated for ${selectedRole.name}.`);
      }
    } catch (err) {
      setErrorMsg((err as { data?: string })?.data || 'Failed to update role permissions.');
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newRoleName.trim() || !newRoleCode.trim()) {
      setErrorMsg('Role Name and Code are required.');
      return;
    }

    if (newRolePermissions.length === 0) {
      setErrorMsg('Please select at least one permission for this role.');
      return;
    }

    try {
      const created = await createRole({
        name: newRoleName.trim(),
        code: newRoleCode.trim().toUpperCase().replace(/\s+/g, '_'),
        description: newRoleDesc.trim(),
        permissions: newRolePermissions,
      }).unwrap();

      setIsCreatingNew(false);
      setNewRoleName('');
      setNewRoleCode('');
      setNewRoleDesc('');
      setNewRolePermissions([]);
      setSelectedRoleId(created.id);

      if (onSuccessToast) {
        onSuccessToast(`Custom role "${created.name}" created successfully.`);
      }
    } catch (err) {
      setErrorMsg((err as { data?: string })?.data || 'Failed to create custom role.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="roles-matrix-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-brand-navy text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="roles-matrix-title" className="text-lg font-semibold tracking-tight">
                Roles & Permissions Catalogue
              </h2>
              <p className="text-[13px] text-slate-300">
                Configure role access levels, audit default roles, and define custom enterprise permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout: Left Role List, Right Permissions Matrix */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {/* Left Column: Roles List */}
          <div className="p-4 bg-gray-50/70 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                System & Custom Roles ({roles.length})
              </span>

              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(true);
                  setErrorMsg(null);
                }}
                className="px-2.5 py-1 bg-brand-blue hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Role</span>
              </button>
            </div>

            <div className="space-y-2">
              {roles.map((r) => {
                const isSelected = !isCreatingNew && selectedRole?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-brand-blue bg-blue-50/60 shadow-xs ring-1 ring-brand-blue/30'
                        : 'border-gray-200 bg-white hover:bg-gray-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm truncate">{r.name}</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                          r.isSystem
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {r.isSystem ? 'System' : 'Custom'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{r.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400 font-mono">
                      <span>{r.code}</span>
                      <span>•</span>
                      <span>{r.permissions.length} perms</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Permission Matrix or New Role Form */}
          <div className="md:col-span-2 p-6 overflow-y-auto space-y-4 text-sm">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium text-sm">
                {errorMsg}
              </div>
            )}

            {isCreatingNew ? (
              /* Create Custom Role Form */
              <form onSubmit={handleCreateCustomRole} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">Create Custom Role</h3>
                    <p className="text-gray-500 text-xs">
                      Specify role identity and assign specific module permissions
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="text-gray-500 hover:text-gray-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-medium text-sm mb-1.5">Role Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Bedding Studio Supervisor"
                      value={newRoleName}
                      onChange={(e) => {
                        setNewRoleName(e.target.value);
                        if (!newRoleCode) {
                          setNewRoleCode(
                            e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
                          );
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 font-normal text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium text-sm mb-1.5">Role Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. STUDIO_SUPERVISOR"
                      value={newRoleCode}
                      onChange={(e) => setNewRoleCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium text-sm mb-1.5">Description</label>
                  <input
                    type="text"
                    placeholder="Brief description of responsibilities"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-800 font-normal text-sm"
                  />
                </div>

                <div className="pt-2">
                  <label className="block text-gray-700 font-semibold text-sm mb-2">
                    Authorized Module Permissions ({newRolePermissions.length} selected)
                  </label>
                  <PermissionsMatrix
                    selectedPermissions={newRolePermissions}
                    onChange={setNewRolePermissions}
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2.5 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs cursor-pointer transition-colors"
                  >
                    {isCreating ? 'Saving Role...' : 'Save Custom Role'}
                  </button>
                </div>
              </form>
            ) : selectedRole ? (
              /* View / Edit Selected Role */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-base">{selectedRole.name}</h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {selectedRole.code}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{selectedRole.description}</p>
                  </div>

                  {selectedRole.code !== 'SUPER_ADMIN' && (
                    <button
                      type="button"
                      onClick={handleSaveRolePermissions}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isUpdating ? 'Saving...' : 'Update Matrix'}</span>
                    </button>
                  )}
                </div>

                {selectedRole.code === 'SUPER_ADMIN' && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 text-purple-900 flex items-center gap-2 text-xs">
                    <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      <strong>Protected Master Role:</strong> Super Admin permissions are permanent and cannot be downgraded.
                    </span>
                  </div>
                )}

                <div>
                  <PermissionsMatrix
                    selectedPermissions={
                      editedPermissions.length > 0
                        ? editedPermissions
                        : selectedRole.permissions
                    }
                    onChange={setEditedPermissions}
                    disabled={selectedRole.code === 'SUPER_ADMIN'}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
