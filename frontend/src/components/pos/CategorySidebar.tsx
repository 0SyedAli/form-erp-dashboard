'use client';

import React from 'react';
import { Category } from '@/types';
import {
  Layers,
  Star,
  Crown,
  Sparkles,
  Equal,
  ShieldCheck,
  Boxes,
  Package,
  Tag,
} from 'lucide-react';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategoryId: string; // 'ALL' or category.id
  onSelectCategory: (categoryId: string) => void;
  categoryProductCounts?: Record<string, number>;
  totalAllCount: number;
}

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  categoryProductCounts = {},
  totalAllCount,
}: CategorySidebarProps) {
  // Helper to pick matching icon from reference screenshot
  const getCategoryIcon = (name: string, code: string) => {
    const lower = (name + ' ' + code).toLowerCase();
    if (lower.includes('classic')) return <Star className="w-4 h-4 shrink-0" />;
    if (lower.includes('ultra luxury') || lower.includes('diamond'))
      return <Sparkles className="w-4 h-4 shrink-0" />;
    if (lower.includes('luxury')) return <Crown className="w-4 h-4 shrink-0" />;
    if (lower.includes('slim')) return <Equal className="w-4 h-4 shrink-0" />;
    if (lower.includes('ortho')) return <ShieldCheck className="w-4 h-4 shrink-0" />;
    if (lower.includes('supreme')) return <Boxes className="w-4 h-4 shrink-0" />;
    if (lower.includes('economy')) return <Package className="w-4 h-4 shrink-0" />;
    return <Tag className="w-4 h-4 shrink-0" />;
  };

  return (
    <aside className="w-48 bg-white border-r border-slate-200 flex flex-col p-3 space-y-1 select-none shrink-0 overflow-y-auto">
      {/* "All Products" Item */}
      <button
        onClick={() => onSelectCategory('ALL')}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 cursor-pointer ${
          selectedCategoryId === 'ALL'
            ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-500/20'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 shrink-0" />
          <span>All Products</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            selectedCategoryId === 'ALL'
              ? 'bg-blue-500 text-white'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {totalAllCount}
        </span>
      </button>

      {/* Dynamic Brand Categories */}
      {categories.map((category) => {
        const isSelected = selectedCategoryId === category.id;
        const count = categoryProductCounts[category.id] ?? 0;

        return (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 cursor-pointer ${
              isSelected
                ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-500/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              {getCategoryIcon(category.name, category.code)}
              <span className="truncate">{category.name}</span>
            </div>
            {count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
