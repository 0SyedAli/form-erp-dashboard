'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch } from '@/store';
import { setAuthenticatedAccount } from '@/store/slices/authSlice';
import { setBranchFilter } from '@/store/slices/filterSlice';
import { useLoginMutation } from '@/store/services/authApi';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

const loginSchema = z.object({
  identifier: z.string().min(2, 'Username or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [loginApi, { isLoading: isApiLoading }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const isLoading = isSubmitting || isApiLoading;

  const performLogin = async (identifier: string, pass: string) => {
    setErrorMsg(null);
    const cleanId = identifier.trim().toLowerCase();

    // 1. Attempt Real Backend API Authentication
    try {
      const response = await loginApi({
        loginId: cleanId,
        password: pass,
      }).unwrap();

      if (response.success && response.data?.account) {
        const account = response.data.account;
        dispatch(setAuthenticatedAccount(account));

        // Automatic smart redirection based on role / branch
        if (account.role === 'SUPER_ADMIN') {
          dispatch(setBranchFilter('all'));
          router.push('/admin/dashboard');
        } else {
          // Branch account automatically redirects to its own branch POS
          dispatch(setBranchFilter(account.branchId || 'BR-MAIN-01'));
          router.push('/pos');
        }
        return;
      }
    } catch (err: unknown) {
      const apiErr = err as {
        status?: number;
        data?: {
          error?: {
            code?: string;
            message?: string;
          };
        };
      };

      if (apiErr?.status === 401 || apiErr?.data?.error?.code === 'INVALID_CREDENTIALS') {
        setErrorMsg('Invalid username/email or password.');
        return;
      }
      if (apiErr?.status === 403 || apiErr?.data?.error?.code === 'ACCOUNT_INACTIVE') {
        setErrorMsg('Account is deactivated. Please contact Super Admin.');
        return;
      }

      setErrorMsg(
        apiErr?.data?.error?.message ||
        'Connection to authentication service failed. Please ensure the backend is running.'
      );
    }
  };

  const onSubmit = (data: LoginFormData) => {
    performLogin(data.identifier, data.password);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
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

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200/80">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  {...register('identifier')}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-burgundy focus:border-transparent transition-all"
                  placeholder="Enter login ID or email"
                />
              </div>
              {errors.identifier && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.identifier.message}</p>
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-burgundy focus:border-transparent transition-all"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-rose-700  hover:bg-rose-900 disabled:opacity-70 text-white text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
            Protected ERP System &bull; Automatic branch & role destination
          </div>
        </div>
      </div>
    </div>
  );
}
