'use client';

import React from 'react';
import Link from 'next/link';
import {
  Search,
  Keyboard,
  FileText,
  Clock,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { Branch, SaleType } from '@/types';

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
  saleType?: SaleType;
  onChangeSaleType?: (newType: SaleType) => void;
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
  saleType = 'WALK_IN',
  onChangeSaleType,
}: POSHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200/90 px-4 py-2 flex items-center justify-between gap-4 select-none shrink-0 shadow-xs">
      {/* Left: Branding matching reference screenshot */}
      <div className="flex items-center gap-3 shrink-0">
        <Link href={isSuperAdmin ? '/admin/dashboard' : '/branch/dashboard'} className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-xl bg-[#0f9d58] flex items-center justify-center text-white shadow-xs group-hover:bg-[#0b8043] transition-colors shrink-0">
            {/* White Mattress / Bed Icon */}
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
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight font-sans">
              Foam Shop POS
            </h1>
            <p className="text-[11px] text-slate-500 font-medium font-sans">
              Quality Sleep Starts Here
            </p>
          </div>
        </Link>
      </div>

      {/* Center: Search Input matching reference screenshot */}
      <div className="flex-1 max-w-xl mx-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="pos-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search foams, categories or brands..."
            className="w-full pl-10 pr-4 py-2 bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans"
          />
        </div>
      </div>

      {/* Right: Quick Action Buttons matching reference screenshot */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* F2: New Sale */}
        <button
          onClick={onNewSaleClick}
          className="flex flex-col items-center justify-center px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          title="New Sale (F2)"
        >
          <div className="flex items-center gap-1">
            <Keyboard className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-400">F2</span>
          </div>
          <span className="text-xs font-medium mt-0.5">New Sale</span>
        </button>

        {/* F3: Hold Sale */}
        <button
          onClick={onHoldSaleClick}
          className="relative flex flex-col items-center justify-center px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          title="Hold Sale (F3)"
        >
          <div className="flex items-center gap-1">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-400">F3</span>
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
          className="flex flex-col items-center justify-center px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          title="Sales History (F4)"
        >
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-400">F4</span>
          </div>
          <span className="text-xs font-medium mt-0.5">Sales History</span>
        </Link>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center px-3 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          title="Workstation Settings"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium mt-0.5">Settings</span>
        </button>

        {/* Subtle Tier Dropdown Selector (Walk-in / Wholesale / Distributor) */}
        {onChangeSaleType && (
          <div className="ml-1 pl-2 border-l border-slate-200">
            <select
              value={saleType}
              onChange={(e) => onChangeSaleType(e.target.value as SaleType)}
              className="text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="WALK_IN">Walk-in</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </select>
          </div>
        )}
      </div>
    </header>
  );
}
