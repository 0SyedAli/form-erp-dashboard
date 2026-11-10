'use client';

import React, { useState, useEffect } from 'react';
import { User, Calendar, Store, Circle } from 'lucide-react';

interface POSFooterProps {
  cashierName?: string;
  shiftName?: string;
  version?: string;
  isOnline?: boolean;
  pendingOfflineCount?: number;
}

export default function POSFooter({
  cashierName = 'Admin',
  shiftName = 'Morning',
  version = '1.0.0',
  isOnline = true,
  pendingOfflineCount = 0,
}: POSFooterProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [formattedDate, setFormattedDate] = useState('26 Apr 2025');

  useEffect(() => {
    setIsMounted(true);
    try {
      setFormattedDate(
        new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date())
      );
    } catch {
      // Keep initial formatted fallback
    }
  }, []);

  const displayOnline = isMounted ? isOnline : true;
  const displayCashier = cashierName || 'Admin';

  return (
    <footer className="bg-white border-t border-slate-200 px-5 py-2 flex items-center justify-between text-xs text-slate-500 font-medium select-none shrink-0">
      {/* Left items: Cashier, Date, Shift */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 text-slate-700">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span suppressHydrationWarning>
            Cashier:{' '}
            <strong className="text-slate-900 font-bold" suppressHydrationWarning>
              {displayCashier}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span suppressHydrationWarning>
            Date:{' '}
            <span className="text-slate-800" suppressHydrationWarning>
              {formattedDate}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-700">
          <Store className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Shift: <span className="text-slate-800 font-semibold">{shiftName}</span>
          </span>
        </div>
      </div>

      {/* Right items: Online status & Version */}
      <div className="flex items-center gap-4">
        {displayOnline ? (
          <div className="flex items-center gap-1.5 text-emerald-600 font-semibold" suppressHydrationWarning>
            <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500 animate-pulse" />
            <span>Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-600 font-semibold" suppressHydrationWarning>
            <Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500 animate-pulse" />
            <span>Offline Mode {pendingOfflineCount > 0 ? `(${pendingOfflineCount} queued)` : ''}</span>
          </div>
        )}
        <span className="text-slate-400">Version {version}</span>
      </div>
    </footer>
  );
}
