'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch } from '@/store';
import { setCurrentUser } from '@/store/slices/authSlice';
import { setBranchFilter } from '@/store/slices/filterSlice';
import { branchesRepository } from '@/lib/demo-db/branches.repository';
import { DEMO_USERS } from '@/data/mockData';
import { User } from '@/types';
import {
  Lock,
  User as UserIcon,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Store,
  Crown,
} from 'lucide-react';

const loginSchema = z.object({
  identifier: z.string().min(2, 'Login ID or Username is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'BRANCH' | 'ADMIN'>('BRANCH');

  const branches = branchesRepository.getAll();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: 'mainbranch',
      password: 'password123',
    },
  });

  const performLogin = (identifier: string, pass: string) => {
    setErrorMsg(null);
    const cleanId = identifier.trim().toLowerCase();

    // 1. Check Super Admin Login
    if (
      cleanId === 'admin' ||
      cleanId === 'superadmin' ||
      cleanId === 'admin@moltyfoam.pk' ||
      cleanId === 'ahtesham.syed@moltyfoam.pk'
    ) {
      if (pass !== 'password123' && pass !== 'admin123') {
        setErrorMsg('Invalid password for Super Admin. (Default: password123)');
        return;
      }

      const adminUser = DEMO_USERS[0];
      dispatch(setCurrentUser(adminUser));
      dispatch(setBranchFilter('all'));
      router.push('/admin/dashboard');
      return;
    }

    // 2. Check Branch Account Login
    const branch = branchesRepository.getByLoginId(cleanId);
    if (branch) {
      const expectedPass = branch.password || 'password123';
      if (pass !== expectedPass && pass !== 'password123') {
        setErrorMsg(`Invalid password for ${branch.name}. (Default: password123)`);
        return;
      }

      if (!branch.isActive) {
        setErrorMsg(`Branch account "${branch.name}" is deactivated. Contact Administrator.`);
        return;
      }

      // Create branch authenticated user persona
      const branchUser: User = {
        id: `USR-BRANCH-${branch.id}`,
        name: branch.name,
        email: `${branch.loginId || cleanId}@moltyfoam.store`,
        role: 'BRANCH_MANAGER',
        roleName: 'Branch Account',
        assignedBranchId: branch.id,
        assignedBranchIds: [branch.id],
        designation: `${branch.shopNumber || branch.name} Store Terminal`,
        isActive: true,
      };

      dispatch(setCurrentUser(branchUser));
      dispatch(setBranchFilter(branch.id));

      // Branch accounts open the full-screen POS directly!
      router.push('/pos');
      return;
    }

    // 3. Fallback: check demo users
    const matchedUser = DEMO_USERS.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.name.toLowerCase() === cleanId
    );
    if (matchedUser) {
      dispatch(setCurrentUser(matchedUser));
      if (matchedUser.role === 'SUPER_ADMIN') {
        dispatch(setBranchFilter('all'));
        router.push('/admin/dashboard');
      } else {
        dispatch(setBranchFilter(matchedUser.assignedBranchId || 'BR-MAIN-01'));
        router.push('/pos');
      }
      return;
    }

    setErrorMsg(
      `Login ID "${identifier}" not found. Try "mainbranch", "displaycenter", "wholesaledepot", or "admin".`
    );
  };

  const onSubmit = (data: LoginFormData) => {
    performLogin(data.identifier, data.password);
  };

  const handleQuickBranchLogin = (loginId: string) => {
    setValue('identifier', loginId);
    setValue('password', 'password123');
    performLogin(loginId, 'password123');
  };

  const handleQuickAdminLogin = () => {
    setValue('identifier', 'admin');
    setValue('password', 'password123');
    performLogin('admin', 'password123');
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Molty Brand Icon */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-red-600 to-red-700 text-white text-2xl font-bold shadow-lg shadow-red-950/20 mb-3 border border-amber-300/40">
          <span className="text-amber-200">M</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          MASTER MOLTY FOAM
        </h1>
        <p className="text-xs uppercase tracking-wider font-semibold text-brand-burgundy mt-1">
          Retail & Wholesale ERP System
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-2xl px-4 sm:px-0">
        <div className="bg-white py-7 px-6 sm:px-9 shadow-xl rounded-2xl border border-gray-200/90">
          {/* Quick Demo Access Bar */}
          <div className="mb-6 p-4 rounded-xl bg-blue-50/80 border border-blue-100/90 text-[13px] text-blue-900">
            <div className="flex items-start gap-2.5 mb-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Simple Branch Accounts & Admin:</strong> One-click login below to test the Main Branch full-screen POS vs Super Admin Dashboard.
              </div>
            </div>

            {/* Quick Demo Login Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {/* Admin Card */}
              <button
                type="button"
                onClick={handleQuickAdminLogin}
                className="flex flex-col text-left p-2.5 rounded-lg bg-white border border-purple-200 hover:border-purple-400 hover:bg-purple-50/40 transition-all group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    <span>Admin</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-purple-400 group-hover:text-purple-700 transition-colors" />
                </div>
                <span className="font-bold text-slate-900 text-xs mt-1 truncate">
                  Super Admin
                </span>
                <span className="text-[11px] text-slate-500 truncate">
                  → Admin Dashboard
                </span>
              </button>

              {/* Branch Cards */}
              {branches.slice(0, 5).map((b) => {
                const isMain = b.id === 'BR-MAIN-01';
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleQuickBranchLogin(b.loginId || b.code.toLowerCase())}
                    className={`flex flex-col text-left p-2.5 rounded-lg bg-white border hover:bg-blue-50/40 transition-all group shadow-2xs ${
                      isMain ? 'border-brand-burgundy/40 bg-rose-50/20' : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        isMain ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        <Store className="w-3 h-3" />
                        <span>{b.shopNumber || b.code}</span>
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <span className="font-semibold text-slate-900 text-xs mt-1 truncate">
                      {b.name.split('(')[0].trim()}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">
                      ID: <span className="font-mono text-slate-700">{b.loginId || b.code.toLowerCase()}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex border-b border-slate-200 mb-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('BRANCH');
                setValue('identifier', 'mainbranch');
                setValue('password', 'password123');
              }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'BRANCH'
                  ? 'border-brand-burgundy text-brand-burgundy'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Branch Account</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('ADMIN');
                setValue('identifier', 'admin');
                setValue('password', 'password123');
              }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'ADMIN'
                  ? 'border-brand-burgundy text-brand-burgundy'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Super Admin</span>
            </button>
          </div>

          {/* Standard Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {activeTab === 'BRANCH' ? 'Branch Login ID' : 'Super Admin Username / Email'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  {...register('identifier')}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-burgundy focus:border-transparent transition-all"
                  placeholder={activeTab === 'BRANCH' ? 'e.g. mainbranch, displaycenter' : 'admin'}
                />
              </div>
              {errors.identifier && (
                <p className="mt-1 text-xs text-rose-600">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  {...register('password')}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-burgundy focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-brand-burgundy hover:bg-rose-900 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{activeTab === 'BRANCH' ? 'Open Store POS' : 'Enter Admin Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Helper hint */}
          <div className="mt-5 pt-3.5 border-t border-slate-100 text-center text-xs text-slate-400">
            {activeTab === 'BRANCH' ? (
              <span>Branch accounts launch the full-screen POS directly. Password set by Admin.</span>
            ) : (
              <span>Super Admin has full access across all branch revenue, stock, and management.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
