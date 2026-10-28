'use client';

import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { switchPersona } from '@/store/slices/authSlice';
import { setBranchFilter } from '@/store/slices/filterSlice';
import { useGetUsersQuery, useGetBranchesQuery } from '@/store/services/apiSlice';
import { getRoleBadge } from '@/lib/permissions';
import { X, ShieldCheck, Building2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoleSwitcherModal({ isOpen, onClose }: RoleSwitcherModalProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  const { data: users = [] } = useGetUsersQuery();
  const { data: branches = [] } = useGetBranchesQuery();

  if (!isOpen) return null;

  // Show active users
  const activeUsers = users.filter((u) => u.isActive ?? true);

  const handleSelectUser = (userId: string) => {
    const selected = activeUsers.find((u) => u.id === userId);
    if (!selected) return;

    dispatch(switchPersona(userId));

    if (selected.role === 'SUPER_ADMIN' || selected.role === 'ACCOUNTANT') {
      dispatch(setBranchFilter('all'));
      router.push('/admin/dashboard');
    } else if (selected.assignedBranchId) {
      dispatch(setBranchFilter(selected.assignedBranchId));
      router.push('/branch/dashboard');
    } else {
      dispatch(setBranchFilter('all'));
      router.push('/admin/dashboard');
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="role-switcher-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-brand-navy text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center text-white font-bold text-lg shadow-sm">
              MF
            </div>
            <div>
              <h2 id="role-switcher-title" className="text-lg font-semibold tracking-tight">
                Switch Demo Persona
              </h2>
              <p className="text-[13px] text-slate-300 font-normal">
                Experience role-based access across all 6 verified ERP personas
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

        {/* Modal Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-[13px] text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="font-normal leading-relaxed">
              <span className="font-semibold">Enterprise RBAC Demonstration:</span> Super Admin and Accountants have group-wide visibility. Branch Managers, Cashiers, Wholesale Staff, and Inventory Officers are isolated to authorized modules and local market shops.
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Available Active Personas ({activeUsers.length})
            </label>

            {activeUsers.map((user) => {
              const isSelected = currentUser?.id === user.id;
              const isSuperAdmin = user.role === 'SUPER_ADMIN';
              const branch = branches.find((b) => b.id === user.assignedBranchId);
              const badge = getRoleBadge(user.role);

              return (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user.id)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-red bg-red-50/50 ring-2 ring-red-100 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          user.avatarUrl ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
                        }
                        alt={user.name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"
                      />
                      <span 
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          isSuperAdmin ? 'bg-purple-500' : 'bg-emerald-500'
                        }`} 
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{user.name}</span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {user.roleName || badge.label}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-500 mt-0.5 font-normal">{user.designation}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 font-normal">
                        {isSuperAdmin ? (
                          <span className="flex items-center gap-1 text-purple-700 font-medium">
                            <Building2 className="w-3.5 h-3.5" /> Full Enterprise Group (5 Shops)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-600 font-normal">
                            <Building2 className="w-3.5 h-3.5" /> {branch?.name || 'Local Market Cluster'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-brand-red font-semibold text-xs shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Active</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
