'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store';

export default function RootIndexPage() {
  const router = useRouter();
  const { currentUser, isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      router.replace('/login');
    } else if (currentUser.role === 'SUPER_ADMIN') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/branch/dashboard');
    }
  }, [currentUser, isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-red text-white font-black flex items-center justify-center text-xl shadow-md shadow-red-950/20 animate-pulse">
          MF
        </div>
        <p className="text-xs font-semibold text-gray-500">
          Redirecting to Molty Foam ERP Console...
        </p>
      </div>
    </div>
  );
}
