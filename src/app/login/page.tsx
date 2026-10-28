'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch } from '@/store';
import { setCurrentUser } from '@/store/slices/authSlice';
import { setBranchFilter } from '@/store/slices/filterSlice';
import { DEMO_USERS, DEMO_BRANCHES } from '@/data/mockData';
import {
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid work email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'ahtesham.syed@moltyfoam.pk',
      password: 'password123',
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setErrorMsg(null);
    const user = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase()
    );

    if (user) {
      dispatch(setCurrentUser(user));
      if (user.role === 'SUPER_ADMIN') {
        dispatch(setBranchFilter('all'));
        router.push('/admin/dashboard');
      } else {
        dispatch(setBranchFilter(user.assignedBranchId || 'BR-MAIN-01'));
        router.push('/branch/dashboard');
      }
    } else {
      // Allow custom email as demo admin
      const customUser = {
        id: `USR-CUSTOM-${data.email.replace(/[^a-zA-Z0-9]/g, '')}`,
        name: data.email.split('@')[0],
        email: data.email,
        role: 'SUPER_ADMIN' as const,
        designation: 'Enterprise Access User',
      };
      dispatch(setCurrentUser(customUser));
      dispatch(setBranchFilter('all'));
      router.push('/admin/dashboard');
    }
  };

  const handleQuickLogin = (userId: string) => {
    const user = DEMO_USERS.find((u) => u.id === userId);
    if (!user) return;

    setValue('email', user.email);
    setValue('password', 'password123');

    dispatch(setCurrentUser(user));
    if (user.role === 'SUPER_ADMIN') {
      dispatch(setBranchFilter('all'));
      router.push('/admin/dashboard');
    } else {
      dispatch(setBranchFilter(user.assignedBranchId || 'BR-MAIN-01'));
      router.push('/branch/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Molty Brand Icon */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-red text-white text-2xl font-bold shadow-lg shadow-red-950/20 mb-3">
          MF
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          MASTER MOLTY FOAM
        </h1>
        <p className="text-xs uppercase tracking-wider font-medium text-brand-red mt-1">
          Retail & Wholesale ERP System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-gray-200">
          {/* Disclaimer Header */}
          <div className="mb-6 p-3.5 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 text-[13px] text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <strong className="font-semibold">Demo Authorization:</strong> Use any persona card below for instant one-click login to test Super Admin vs Branch Manager views.
            </div>
          </div>

          {/* Quick Persona Switcher Cards */}
          <div className="mb-6 space-y-2.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Instant One-Click Demo Access
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_USERS.map((u) => {
                const isSuperAdmin = u.role === 'SUPER_ADMIN';
                const branch = DEMO_BRANCHES.find((b) => b.id === u.assignedBranchId);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickLogin(u.id)}
                    className="flex flex-col text-left p-3 rounded-xl border border-gray-200 hover:border-brand-red hover:bg-red-50/30 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                          isSuperAdmin
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {u.roleName || u.role.replace(/_/g, ' ')}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-red group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="font-medium text-gray-900 text-sm mt-1.5 truncate">
                      {u.name}
                    </span>
                    <span className="text-xs text-gray-500 truncate font-normal">
                      {isSuperAdmin ? 'All 5 Branches' : branch?.name || 'Local'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-400 font-medium">
                Or Sign In With Work Credentials
              </span>
            </div>
          </div>

          {/* Standard Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-brand-red focus:border-transparent transition-all"
                  placeholder="name@moltyfoam.pk"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 font-normal">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  {...register('password')}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-brand-red focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 font-normal">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Authenticate Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center text-xs text-gray-400 font-normal">
            Protected by Molty Foam Enterprise Directory Services • Asia/Karachi (PKT)
          </div>
        </div>
      </div>
    </div>
  );
}
