'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store';
import { switchPersona } from '@/store/slices/authSlice';
import { setBranchFilter } from '@/store/slices/filterSlice';
import RoleSwitcherModal from '@/components/layout/RoleSwitcherModal';
import { DEMO_BRANCHES } from '@/data/mockData';
import {
  ShieldAlert,
  Building2,
  RefreshCw,
  Home,
} from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const assignedBranch = DEMO_BRANCHES.find((b) => b.id === currentUser?.assignedBranchId);

  const handleSwitchToAdmin = () => {
    dispatch(switchPersona('USR-ADMIN-01'));
    dispatch(setBranchFilter('all'));
    router.push('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-brand-navy p-6 text-center text-white relative">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">403 — Access Restricted</h1>
          <p className="text-xs text-slate-300 mt-1">
            Molty Foam Enterprise Role-Based Access Control (RBAC)
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-900 leading-relaxed">
            <strong className="font-semibold block mb-0.5">Authorization Boundary:</strong>
            You are currently logged in as a <strong>Branch Manager</strong>. In accordance with Molty Foam multi-branch isolation policy, branch accounts can only access transactions and inventory designated for their assigned branch.
          </div>

          {/* Current Session Summary */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Current Authenticated Persona
            </span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">{currentUser?.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                {currentUser?.role}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600 pt-1">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <span>Assigned Node: <strong>{assignedBranch?.name || 'Local Branch'}</strong></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Link
              href="/branch/dashboard"
              className="w-full py-2.5 px-4 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Return to Assigned Branch Dashboard</span>
            </Link>

            <button
              onClick={handleSwitchToAdmin}
              className="w-full py-2.5 px-4 rounded-xl border border-brand-red text-brand-red hover:bg-red-50 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Switch to Super Admin (Demo Mode)</span>
            </button>

            <button
              onClick={() => setIsSwitcherOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore All Demo Personas</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-400">
          Backend RBAC verification strictly enforced in production deployment.
        </div>
      </div>

      <RoleSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />
    </div>
  );
}
