'use client';

import React from 'react';
import { Permission, PermissionCategory } from '@/types';
import { SEED_PERMISSIONS } from '@/lib/demo-db/seed';
import { CheckSquare, Square } from 'lucide-react';

interface PermissionsMatrixProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
  categoryFilter?: PermissionCategory;
}

const CATEGORY_META: Record<PermissionCategory, { title: string; color: string }> = {
  branches: { title: 'Branches & Stores', color: 'text-blue-700 bg-blue-50 border-blue-100' },
  users: { title: 'Users & Roles', color: 'text-purple-700 bg-purple-50 border-purple-100' },
  pos: { title: 'POS & Counter Sales', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  wholesale: { title: 'Wholesale & B2B', color: 'text-amber-700 bg-amber-50 border-amber-100' },
  inventory: { title: 'Products & Inventory', color: 'text-cyan-700 bg-cyan-50 border-cyan-100' },
  reports: { title: 'Analytics & Financials', color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
  settings: { title: 'System & Governance', color: 'text-slate-700 bg-slate-100 border-slate-200' },
};

export default function PermissionsMatrix({
  selectedPermissions,
  onChange,
  disabled = false,
  categoryFilter,
}: PermissionsMatrixProps) {
  const allPermissions: Permission[] = SEED_PERMISSIONS;

  // Group by category
  const categories = (
    categoryFilter
      ? [categoryFilter]
      : (Object.keys(CATEGORY_META) as PermissionCategory[])
  );

  const togglePermission = (key: string) => {
    if (disabled) return;
    if (selectedPermissions.includes(key)) {
      onChange(selectedPermissions.filter((k) => k !== key));
    } else {
      onChange([...selectedPermissions, key]);
    }
  };

  const toggleCategoryAll = (category: PermissionCategory) => {
    if (disabled) return;
    const catKeys = allPermissions
      .filter((p) => p.category === category)
      .map((p) => p.key);

    const allSelected = catKeys.every((k) => selectedPermissions.includes(k));

    if (allSelected) {
      // Deselect all in category
      onChange(selectedPermissions.filter((k) => !catKeys.includes(k)));
    } else {
      // Select all in category
      const merged = new Set([...selectedPermissions, ...catKeys]);
      onChange(Array.from(merged));
    }
  };

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const catPermissions = allPermissions.filter((p) => p.category === cat);
        if (catPermissions.length === 0) return null;

        const catKeys = catPermissions.map((p) => p.key);
        const allSelected = catKeys.every((k) => selectedPermissions.includes(k));
        const meta = CATEGORY_META[cat];

        return (
          <div
            key={cat}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs space-y-3"
          >
            {/* Category Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${meta.color}`}>
                  {meta.title}
                </span>
                <span className="text-xs text-gray-400 font-normal">
                  ({catPermissions.filter((p) => selectedPermissions.includes(p.key)).length}/
                  {catPermissions.length} active)
                </span>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleCategoryAll(cat)}
                  className="text-xs font-medium text-brand-blue hover:text-blue-800 transition-colors cursor-pointer flex items-center gap-1"
                >
                  {allSelected ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Deselect Category</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Select All</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Permission Checkbox Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {catPermissions.map((perm) => {
                const isChecked = selectedPermissions.includes(perm.key);

                return (
                  <label
                    key={perm.key}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'border-blue-200 bg-blue-50/40 text-gray-900'
                        : 'border-gray-100 bg-gray-50/50 text-gray-600 hover:bg-gray-50'
                    } ${disabled ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => togglePermission(perm.key)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue cursor-pointer"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-xs text-gray-900 truncate">
                          {perm.label}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ${
                            perm.scope === 'GLOBAL'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {perm.scope}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 leading-normal font-normal">
                        {perm.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
