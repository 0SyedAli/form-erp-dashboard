'use client';

import React from 'react';
import { MattressSize, MattressThickness } from '@/types';
import { Ruler, Layers } from 'lucide-react';

interface SizeThicknessSelectorProps {
  sizes: MattressSize[];
  thicknesses: MattressThickness[];
  selectedSizeId: string; // 'ALL' or size.id
  selectedThicknessId: string; // 'ALL' or thickness.id
  onSelectSize: (sizeId: string) => void;
  onSelectThickness: (thicknessId: string) => void;
  sizeProductCounts?: Record<string, number>;
  thicknessProductCounts?: Record<string, number>;
  totalProductsCount: number;
}

export default function SizeThicknessSelector({
  sizes,
  thicknesses,
  selectedSizeId,
  selectedThicknessId,
  onSelectSize,
  onSelectThickness,
  sizeProductCounts = {},
  thicknessProductCounts = {},
  totalProductsCount,
}: SizeThicknessSelectorProps) {
  // Sort sizes by width ascending
  const sortedSizes = [...sizes].sort((a, b) => (a.width || 0) - (b.width || 0));
  // Sort thicknesses by value ascending
  const sortedThicknesses = [...thicknesses].sort((a, b) => (a.value || 0) - (b.value || 0));

  return (
    <div className="w-full bg-transparent px-3 py-1 space-y-1 select-none shrink-0">
      {/* 1. Size Filter Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-0.5">
          <Ruler className="w-3 h-3 text-blue-600" />
          <span>Size:</span>
        </div>

        <button
          type="button"
          onClick={() => onSelectSize('ALL')}
          className={`shrink-0 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSizeId === 'ALL'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span>All Sizes</span>
          <span
            className={`text-[10px] px-1 py-0.1 rounded-full font-mono ${
              selectedSizeId === 'ALL' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {totalProductsCount}
          </span>
        </button>

        {sortedSizes.map((size) => {
          const isSelected = selectedSizeId === size.id;
          const count = sizeProductCounts[size.id] ?? 0;
          let label = size.displayLabel || size.name || `${size.width}×${size.length}`;
          if (label.includes('(')) {
            label = label.split('(')[1].replace(')', '').trim();
          }

          return (
            <button
              key={size.id}
              type="button"
              onClick={() => onSelectSize(isSelected ? 'ALL' : size.id)}
              className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`text-[9px] px-1 py-0.1 rounded-full font-mono ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Thickness Filter Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-0.5">
          <Layers className="w-3 h-3 text-indigo-600" />
          <span>Depth:</span>
        </div>

        <button
          type="button"
          onClick={() => onSelectThickness('ALL')}
          className={`shrink-0 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedThicknessId === 'ALL'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span>All Depth</span>
        </button>

        {sortedThicknesses.map((th) => {
          const isSelected = selectedThicknessId === th.id;
          const count = thicknessProductCounts[th.id] ?? 0;
          const label = th.displayLabel || `${th.value ?? th.thicknessInches}"`;

          return (
            <button
              key={th.id}
              type="button"
              onClick={() => onSelectThickness(isSelected ? 'ALL' : th.id)}
              className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`text-[9px] px-1 py-0.1 rounded-full font-mono ${
                    isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
