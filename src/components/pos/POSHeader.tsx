'use client';

import React from 'react';
import Link from 'next/link';
import {
  Search,
  PlusCircle,
  PauseCircle,
  History,
  Settings,
  Store,
  AlertTriangle,
} from 'lucide-react';
import { Branch } from '@/types';

interface POSHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeBranch?: Branch | null;
  heldCount: number;
  onNewSaleClick: () => void;
  onHoldSaleClick: () => void;
  onOpenSettings: () => void;
  onBranchChange?: (branchId: string) => void;
  branches?: Branch[];
  isSuperAdmin?: boolean;
}

export default function POSHeader({
  searchQuery,
  onSearchChange,
  activeBranch,
  heldCount,
  onNewSaleClick,
  onHoldSaleClick,
  onOpenSettings,
  isSuperAdmin = false,
}: POSHeaderProps) {
  const isRetailAllowed = activeBranch?.settings?.allowRetailSales ?? true;

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 select-none shrink-0 shadow-xs">
      {/* Left: Branding */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs group-hover:bg-emerald-700 transition-colors">
            {/* Mattress/Bed Icon */}
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M3 14h18m-9-4v8m-8 0h16a1 1 0 001-1v-4a1 1 0 00-1-1H4a1 1 0 00-1 1v4a1 1 0 001 1z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight flex items-center gap-1.5 font-sans">
              Foam Shop POS
            </h1>
            <p className="text-xs text-slate-500 font-medium font-sans">
              Quality Sleep Starts Here
            </p>
          </div>
        </Link>

        {/* Retail Allowed Warning Banner if disabled */}
        {!isRetailAllowed && (
          <div className="hidden xl:flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Retail Billing Disabled for this Branch</span>
          </div>
        )}
      </div>

      {/* Center: Search Input */}
      <div className="flex-1 max-w-xl mx-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="pos-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search foams, categories or brands... (Ctrl+K)"
            className="w-full pl-10 pr-12 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans"
          />
          <kbd className="hidden sm:inline-flex items-center absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-200/60 rounded border border-slate-300/60">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right: Actions & Indicators */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Branch Identity Badge (Fixed to authenticated account context - no dropdown switching) */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium">
          <Store className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold text-slate-800 truncate max-w-[170px]">
            {activeBranch?.name || 'Main Branch'}
          </span>
        </div>

        {/* Back to Management Link for authorized accounts */}
        <Link
          href={isSuperAdmin ? '/admin/dashboard' : '/manage-stock'}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand-burgundy hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          title="Return to ERP Management Portal"
        >
          <span>Management</span>
        </Link>

        {/* F2: New Sale */}
        <button
          onClick={onNewSaleClick}
          className="flex flex-col items-center justify-center px-3 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 rounded-lg border border-transparent hover:border-blue-200 transition-colors"
          title="New Sale (F2)"
        >
          <div className="flex items-center gap-1">
            <kbd className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-300 px-1 py-0.2 rounded">
              F2
            </kbd>
            <PlusCircle className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium mt-0.5">New Sale</span>
        </button>

        {/* F3: Hold Sale / Held Sales */}
        <button
          onClick={onHoldSaleClick}
          className="relative flex flex-col items-center justify-center px-3 py-1 text-slate-600 hover:text-amber-600 hover:bg-amber-50/60 rounded-lg border border-transparent hover:border-amber-200 transition-colors"
          title="Hold Sale / View Held Sales (F3)"
        >
          <div className="flex items-center gap-1">
            <kbd className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-300 px-1 py-0.2 rounded">
              F3
            </kbd>
            <PauseCircle className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium mt-0.5">Hold Sale</span>
          {heldCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
              {heldCount}
            </span>
          )}
        </button>

        {/* F4: Sales History */}
        <Link
          href="/pos/history"
          className="flex flex-col items-center justify-center px-3 py-1 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/60 rounded-lg border border-transparent hover:border-emerald-200 transition-colors"
          title="Sales History (F4)"
        >
          <div className="flex items-center gap-1">
            <kbd className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-300 px-1 py-0.2 rounded">
              F4
            </kbd>
            <History className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium mt-0.5">Sales History</span>
        </Link>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors"
          title="Workstation Settings"
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs font-medium mt-1">Settings</span>
        </button>
      </div>
    </header>
  );
}
