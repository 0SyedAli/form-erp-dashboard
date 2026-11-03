'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import { useToggleUserStatusMutation, useGetUsersQuery } from '@/store/services/apiSlice';
import { Power, AlertTriangle, ShieldAlert, CheckCircle2, X } from 'lucide-react';

interface UserStatusModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: User) => void;
}

export default function UserStatusModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: UserStatusModalProps) {
  const [toggleStatus, { isLoading }] = useToggleUserStatusMutation();
  const { data: allUsers = [] } = useGetUsersQuery();
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const isCurrentlyActive = user.isActive ?? true;
  const willDeactivate = isCurrentlyActive;

  // Check if this is the last active Super Admin
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const activeSuperAdmins = allUsers.filter(
    (u) => u.role === 'SUPER_ADMIN' && (u.isActive ?? true)
  );
  const isLastActiveSuperAdmin = isSuperAdmin && willDeactivate && activeSuperAdmins.length <= 1;

  const handleConfirm = async () => {
    if (isLastActiveSuperAdmin) return;
    setServerError(null);

    try {
      const updated = await toggleStatus(user.id).unwrap();
      onSuccess(updated);
      onClose();
    } catch (err) {
      const msg = (err as { data?: string })?.data || 'Failed to update user account status.';
      setServerError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="status-modal-title"
      >
        {/* Header Banner */}
        <div
          className={`p-5 text-white flex items-center justify-between ${
            isLastActiveSuperAdmin
              ? 'bg-rose-700'
              : willDeactivate
              ? 'bg-amber-600'
              : 'bg-emerald-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              {isLastActiveSuperAdmin ? (
                <ShieldAlert className="w-6 h-6" />
              ) : willDeactivate ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <Power className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 id="status-modal-title" className="text-lg font-semibold">
                {willDeactivate ? 'Deactivate Staff Account' : 'Activate Staff Account'}
              </h2>
              <p className="text-[13px] text-white/80">
                {willDeactivate ? 'Suspend ERP access for user' : 'Restore system access for user'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-sm">
          {serverError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {serverError}
            </div>
          )}

          {isLastActiveSuperAdmin ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-800">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Protected Master Account Safeguard</span>
              </div>
              <p className="text-sm leading-relaxed">
                <strong>{user.name}</strong> is the only active <strong>Super Admin</strong> in the system.
                At least one active Super Admin must always exist to manage security, branches, and staff.
                Deactivation is blocked by the ERP safety policy.
              </p>
            </div>
          ) : (
            <p className="text-gray-700 leading-relaxed text-sm">
              Are you sure you want to {willDeactivate ? 'deactivate' : 'activate'}{' '}
              <strong className="text-gray-900">{user.name}</strong> ({user.email})?
            </p>
          )}

          {/* User Summary Pill */}
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Role:</span>
              <span className="font-semibold text-gray-800">{user.roleName || user.role}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Designation:</span>
              <span className="font-medium text-gray-700">{user.designation}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Current Status:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isCurrentlyActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {isCurrentlyActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {!isLastActiveSuperAdmin && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[13px] leading-relaxed">
                <strong>Historical Audit Preservation:</strong> All historical sales invoices,
                stock transactions, and audit records created by this employee will remain intact and attributed.
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {isLastActiveSuperAdmin ? 'Close' : 'Cancel'}
            </button>

            {!isLastActiveSuperAdmin && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className={`px-4 py-2.5 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2 ${
                  willDeactivate
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    {willDeactivate ? 'Yes, Deactivate Account' : 'Yes, Activate Account'}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
