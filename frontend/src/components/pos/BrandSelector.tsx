'use client';

import React from 'react';
import { Brand } from '@/types';
import { LayoutGrid, Sparkles } from 'lucide-react';

interface BrandSelectorProps {
  brands: Brand[];
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
  brandProductCounts?: Record<string, number>;
}

export default function BrandSelector({
  brands,
  selectedBrandId,
  onSelectBrand,
  brandProductCounts = {},
}: BrandSelectorProps) {
  // Demo brands mapping to match the reference screenshot
  // Brands shown in reference: Dura Foam, MoltyFoam, Master, Diamond, SupremeFoam, Other Brands
  return (
    <div className="w-full bg-white border-b border-slate-200 px-4 py-3 select-none">
      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {brands.map((brand) => {
          const isSelected = selectedBrandId === brand.id;
          const count = brandProductCounts[brand.id] ?? 0;

          return (
            <button
              key={brand.id}
              onClick={() => onSelectBrand(brand.id)}
              className={`flex-1 min-w-[140px] max-w-[190px] h-[78px] rounded-xl border-2 p-2.5 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/80 shadow-2xs'
              }`}
            >
              {/* Brand Logo / Artwork preview */}
              <div className="h-7 flex items-center justify-center mb-1">
                {brand.code === 'DURA' ? (
                  <div className="flex items-center gap-1 font-black text-blue-900 tracking-tight text-sm">
                    <span className="bg-blue-600 text-white rounded-sm px-1 py-0.2 text-[10px] font-bold">
                      DF
                    </span>
                    <span>DuraFoam</span>
                  </div>
                ) : brand.code === 'MOLTY' ? (
                  <div className="flex items-center gap-1 font-black text-rose-600 tracking-tight text-sm">
                    <span className="w-5 h-5 rounded-full bg-amber-400 border border-amber-500 flex items-center justify-center text-[10px] text-blue-900 font-extrabold shadow-2xs">
                      M
                    </span>
                    <span className="text-rose-600">MoltyFoam</span>
                  </div>
                ) : brand.code === 'MASTER' ? (
                  <div className="border border-slate-700 px-1.5 py-0.5 rounded-sm font-black text-slate-800 tracking-widest text-[11px] uppercase">
                    MASTER
                  </div>
                ) : brand.code === 'DIAMOND' ? (
                  <div className="flex items-center gap-1 text-blue-700 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Diamond</span>
                  </div>
                ) : brand.code === 'SUPREME' ? (
                  <div className="text-red-700 font-black italic tracking-tight text-xs bg-red-50 px-1.5 py-0.5 rounded">
                    Supreme
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-600 text-xs font-semibold">
                    <LayoutGrid className="w-4 h-4 text-slate-500" />
                    <span>{brand.name}</span>
                  </div>
                )}
              </div>

              {/* Brand Name & Count */}
              <span
                className={`text-xs font-semibold truncate ${
                  isSelected ? 'text-blue-900 font-bold' : 'text-slate-700'
                }`}
              >
                {brand.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {count > 0 ? `${count} Products` : 'Catalogue'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
