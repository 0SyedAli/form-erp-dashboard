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
  categoryStockMap?: Record<string, number>;
  totalAllCount: number;
}

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  categoryProductCounts = {},
  categoryStockMap = {},
  totalAllCount,
}: CategorySidebarProps) {
  // Dynamically pick matching icon based on category name
  const getCategoryIcon = (name: string, code: string, disabled: boolean) => {
    const lower = (name + ' ' + (code || '')).toLowerCase();
    const colorClass = disabled ? 'text-slate-400' : 'text-blue-500';
    if (lower.includes('gold')) return <Crown className={`w-4 h-4 shrink-0 ${disabled ? 'text-slate-400' : 'text-amber-500'}`} />;
    if (lower.includes('classic')) return <Star className={`w-4 h-4 shrink-0 ${disabled ? 'text-slate-400' : 'text-amber-500'}`} />;
    if (lower.includes('ultra') || lower.includes('luxury') || lower.includes('diamond'))
      return <Sparkles className={`w-4 h-4 shrink-0 ${disabled ? 'text-slate-400' : 'text-purple-500'}`} />;
    if (lower.includes('orig') || lower.includes('standard'))
      return <ShieldCheck className={`w-4 h-4 shrink-0 ${disabled ? 'text-slate-400' : 'text-emerald-500'}`} />;
    if (lower.includes('slim')) return <Equal className={`w-4 h-4 shrink-0 ${colorClass}`} />;
    if (lower.includes('supreme')) return <Boxes className={`w-4 h-4 shrink-0 ${disabled ? 'text-slate-400' : 'text-rose-500'}`} />;
    if (lower.includes('economy')) return <Package className={`w-4 h-4 shrink-0 text-slate-400`} />;
    return <Tag className={`w-4 h-4 shrink-0 ${colorClass}`} />;
  };

  // Only active real categories
  const activeCategories = React.useMemo(() => {
    return categories.filter((c) => (c.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  }, [categories]);

  return (
    <aside className="w-48 xl:w-52 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col p-3 space-y-1 select-none shrink-0 overflow-y-auto scrollbar-thin">
      {/* "All Products" Item */}
      <button
        onClick={() => onSelectCategory('ALL')}
        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer ${
          selectedCategoryId === 'ALL'
            ? 'bg-[#1a73e8] text-white font-semibold shadow-xs'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 shrink-0" />
          <span className="font-semibold">All Products</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            selectedCategoryId === 'ALL' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {totalAllCount}
        </span>
      </button>

      {/* Real Created Categories Only */}
      {activeCategories.map((cat) => {
        const isSelected = selectedCategoryId === cat.id;
        const stock = categoryStockMap[cat.id] ?? 0;
        const hasStock = stock > 0;

        return (
          <button
            key={cat.id}
            onClick={() => {
              if (hasStock) {
                onSelectCategory(cat.id);
              }
            }}
            disabled={!hasStock}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 ${
              !hasStock
                ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400'
                : isSelected
                ? 'bg-[#1a73e8] text-white font-semibold shadow-xs cursor-pointer'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-2.5 truncate">
              {getCategoryIcon(cat.name, cat.code, !hasStock)}
              <span className="truncate">{cat.name}</span>
            </div>

            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                !hasStock
                  ? 'bg-slate-200 text-slate-500'
                  : isSelected
                  ? 'bg-blue-500 text-white'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {stock}
            </span>
          </button>
        );
      })}

      {activeCategories.length === 0 && (
        <div className="pt-4 text-center text-xs text-slate-400">
          <p>No categories in this brand</p>
        </div>
      )}
    </aside>
  );
}
