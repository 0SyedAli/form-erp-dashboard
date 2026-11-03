'use client';

import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setBranchFilter,
  setDateRangeFilter,
  setCustomDateRange,
  setSearchQueryFilter,
  resetFilters,
} from '@/store/slices/filterSlice';
import { DEMO_BRANCHES } from '@/data/mockData';
import { DateRangePreset } from '@/types';
import {
  Building2,
  Calendar,
  Search,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';

interface FilterBarProps {
  showBranchSelector?: boolean;
}

export default function FilterBar({ showBranchSelector = true }: FilterBarProps) {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.filters);
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const presets: { label: string; value: DateRangePreset }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: 'last7days' },
    { label: 'Month to Date', value: 'mtd' },
    { label: 'Year to Date', value: 'ytd' },
    { label: 'Custom', value: 'custom' },
  ];

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setBranchFilter(e.target.value));
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    dispatch(setDateRangeFilter(preset));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQueryFilter(e.target.value));
  };

  const handleCustomDateChange = (start: string, end: string) => {
    dispatch(setCustomDateRange({ startDate: start, endDate: end }));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3.5 sm:p-4 mb-6">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
        {/* Left: Branch selector & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Branch Dropdown */}
          {showBranchSelector && (
            <div className="relative min-w-[220px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Building2 className="w-4 h-4 text-brand-navy" />
              </div>
              <select
                value={filters.branchId}
                onChange={handleBranchChange}
                disabled={!isSuperAdmin}
                className={`w-full pl-9.5 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-brand-red focus:border-transparent transition-all appearance-none cursor-pointer ${
                  !isSuperAdmin ? 'bg-gray-100 text-gray-600 cursor-not-allowed opacity-90' : ''
                }`}
                title={!isSuperAdmin ? 'Branch Manager access is isolated to assigned branch' : 'Filter by branch'}
              >
                {isSuperAdmin && (
                  <option value="all">Consolidated (All 5 Branches)</option>
                )}
                {DEMO_BRANCHES.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} — {branch.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search invoice #, customer name, NTN..."
              value={filters.searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-brand-red focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Right: Date Range Presets */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="hidden xl:flex items-center gap-1 text-xs font-semibold text-gray-500 mr-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Range:</span>
          </div>

          <div className="flex flex-wrap items-center bg-gray-100/80 p-1 rounded-lg border border-gray-200/80">
            {presets.map((p) => {
              const isSelected = filters.dateRange === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => handlePresetClick(p.value)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    isSelected
                      ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Reset Filters button */}
          <button
            onClick={() => dispatch(resetFilters())}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Reset filters to default (All Branches • Month to Date)"
            aria-label="Reset filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Row if 'custom' is active */}
      {filters.dateRange === 'custom' && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-gray-600">Custom Date Range:</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.startDate || '2026-10-01'}
              onChange={(e) =>
                handleCustomDateChange(e.target.value, filters.endDate || '2026-10-28')
              }
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-800"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={filters.endDate || '2026-10-28'}
              onChange={(e) =>
                handleCustomDateChange(filters.startDate || '2026-10-01', e.target.value)
              }
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}
