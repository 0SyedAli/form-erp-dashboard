'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User } from '@/types';
import {
  useCreateUserMutation,
  useGetBranchesQuery,
  useGetRolesQuery,
} from '@/store/services/apiSlice';
import AvatarUploadInput from './AvatarUploadInput';
import PermissionsMatrix from './PermissionsMatrix';
import { X, UserPlus, Mail, Phone } from 'lucide-react';

const addUserSchema = z.object({
  name: z.string().min(3, 'Employee name must be at least 3 characters'),
  email: z.string().email('Please enter a valid work email address'),
  phone: z.string().min(7, 'Please enter a valid contact phone number'),
  role: z.string().min(1, 'Please select a role'),
  designation: z.string().min(2, 'Designation / job title is required'),
  assignedBranchId: z.string().optional(),
});

type AddUserFormData = z.infer<typeof addUserSchema>;

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export default function AddUserModal({ isOpen, onClose, onSuccess }: AddUserModalProps) {
  const [createUser, { isLoading }] = useCreateUserMutation();
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: roles = [] } = useGetRolesQuery();

  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [accessibleBranchIds, setAccessibleBranchIds] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'BRANCH_MANAGER',
      designation: 'Branch Manager',
      assignedBranchId: branches[0]?.id || 'BR-MAIN-01',
    },
  });

  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('BRANCH_MANAGER');

  // Handle role change to auto-load role's default permissions
  const handleRoleChange = (roleCode: string) => {
    setSelectedRoleCode(roleCode);
    setValue('role', roleCode);
    const matchedRole = roles.find((r) => r.code === roleCode);
    if (matchedRole) {
      setSelectedPermissions(matchedRole.permissions);
      setValue('designation', matchedRole.name);
    }
  };

  const toggleAccessibleBranch = (branchId: string) => {
    if (accessibleBranchIds.includes(branchId)) {
      setAccessibleBranchIds(accessibleBranchIds.filter((id) => id !== branchId));
    } else {
      setAccessibleBranchIds([...accessibleBranchIds, branchId]);
    }
  };

  const onSubmit = async (data: AddUserFormData) => {
    setServerError(null);

    const primaryBranchId = data.role === 'SUPER_ADMIN' ? undefined : data.assignedBranchId;
    const combinedBranches = data.role === 'SUPER_ADMIN'
      ? branches.map((b) => b.id)
      : Array.from(new Set([primaryBranchId, ...accessibleBranchIds].filter(Boolean) as string[]));

    try {
      const created = await createUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        designation: data.designation,
        assignedBranchId: primaryBranchId,
        assignedBranchIds: combinedBranches,
        avatarUrl: avatarUrl || undefined,
        customPermissions: selectedPermissions,
        isActive: true,
      }).unwrap();

      reset();
      setAvatarUrl('');
      setSelectedPermissions([]);
      setAccessibleBranchIds([]);
      onSuccess(created);
      onClose();
    } catch (err) {
      const errorMsg =
        (err as { data?: string })?.data ||
        'Failed to create user. Please verify all fields and email uniqueness.';
      setServerError(errorMsg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-labelledby="add-user-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-brand-navy text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center text-white shadow-sm">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-user-title" className="text-lg font-semibold tracking-tight">
                Register New Staff Member
              </h2>
              <p className="text-[13px] text-slate-300 font-normal">
                Add employee profile, assign branch location, and customize RBAC permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto p-6 space-y-5 text-sm font-normal">
          {serverError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-normal">
              {serverError}
            </div>
          )}

          {/* Avatar Upload */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
            <label className="block text-gray-700 font-medium mb-2 text-sm">Employee Avatar</label>
            <AvatarUploadInput currentAvatarUrl={avatarUrl} onChange={setAvatarUrl} />
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-xs text-gray-500">
              Personal & Contact Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Tariq Mehmood"
                  {...register('name')}
                  className={`w-full px-3 py-2.5 bg-white border rounded-lg text-gray-800 text-sm font-normal ${
                    errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-brand-blue'
                  }`}
                />
                {errors.name && <p className="text-xs text-red-600 mt-1 font-normal">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">Work Email Address *</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="e.g. tariq@moltyfoam.store"
                    {...register('email')}
                    className={`w-full pl-9 pr-3 py-2.5 bg-white border rounded-lg text-gray-800 text-sm font-normal ${
                      errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-brand-blue'
                    }`}
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                </div>
                {errors.email && <p className="text-xs text-red-600 mt-1 font-normal">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">Contact Phone *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 0300-8888888"
                    {...register('phone')}
                    className={`w-full pl-9 pr-3 py-2.5 bg-white border rounded-lg text-gray-800 text-sm font-mono ${
                      errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-brand-blue'
                    }`}
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                </div>
                {errors.phone && <p className="text-xs text-red-600 mt-1 font-normal">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">Designation / Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Store Consultant"
                  {...register('designation')}
                  className={`w-full px-3 py-2.5 bg-white border rounded-lg text-gray-800 text-sm font-normal ${
                    errors.designation ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-brand-blue'
                  }`}
                />
                {errors.designation && <p className="text-xs text-red-600 mt-1 font-normal">{errors.designation.message}</p>}
              </div>
            </div>
          </div>

          {/* Role & Branch Assignment */}
          <div className="space-y-4 pt-2">
            <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] text-gray-500">
              Role & Branch Assignment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Assigned Role *</label>
                <select
                  value={selectedRoleCode}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-medium"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name} {r.isSystem ? '(System)' : '(Custom)'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRoleCode !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Primary Branch *</label>
                  <select
                    {...register('assignedBranchId')}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-800 font-medium"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Additional Accessible Branches (if multi-branch staff) */}
            {selectedRoleCode !== 'SUPER_ADMIN' && (
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                <span className="font-semibold text-gray-800 block">
                  Additional Authorized Branches (Multi-Branch Access)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer text-gray-700">
                      <input
                        type="checkbox"
                        checked={accessibleBranchIds.includes(b.id)}
                        onChange={() => toggleAccessibleBranch(b.id)}
                        className="rounded text-brand-blue"
                      />
                      <span className="truncate">{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Permissions Matrix */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] text-gray-500">
                  Granular Permissions Matrix
                </h3>
                <p className="text-[11px] text-gray-400">
                  Review and customize permissions granted to this employee account
                </p>
              </div>
              <span className="text-[11px] font-semibold text-brand-blue">
                {selectedPermissions.length} permissions active
              </span>
            </div>

            <PermissionsMatrix
              selectedPermissions={selectedPermissions}
              onChange={setSelectedPermissions}
              disabled={selectedRoleCode === 'SUPER_ADMIN'}
            />
          </div>

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registering Employee...</span>
                </>
              ) : (
                <span>Register Employee</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
