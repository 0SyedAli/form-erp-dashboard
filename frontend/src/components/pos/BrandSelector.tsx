'use client';

import React, { useState } from 'react';
import { Brand } from '@/types';
import { Sparkles, LayoutGrid } from 'lucide-react';

interface BrandSelectorProps {
  brands: Brand[];
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
  brandProductCounts?: Record<string, number>;
  brandStockMap?: Record<string, number>;
}

export default function BrandSelector({
  brands,
  selectedBrandId,
  onSelectBrand,
  brandProductCounts = {},
  brandStockMap = {},
}: BrandSelectorProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (brandId: string) => {
    setFailedImages((prev) => ({ ...prev, [brandId]: true }));
  };

  // Only show active created brands (no dummy data)
  const activeBrands = React.useMemo(() => {
    return brands.filter((b) => (b.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  }, [brands]);

  // Helper to render brand emblem or logo
  const renderBrandVisual = (brand: Brand) => {
    const logoSrc = brand.logoUrl || (brand as any).logo;
    const hasImage = logoSrc && !failedImages[brand.id];

    if (hasImage) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt={brand.name}
          onError={() => handleImageError(brand.id)}
          className="h-7 w-auto max-w-[130px] object-contain transition-transform duration-200 group-hover:scale-105"
        />
      );
    }

    const code = (brand.code || '').toUpperCase();
    const name = (brand.name || '').toUpperCase();

    if (code.includes('MOLT') || name.includes('MOLT')) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-[#fbbc04] border border-[#ea4335] flex items-center justify-center text-[10px] font-black text-[#1a73e8] shadow-2xs">
            M
          </div>
          <span className="font-black text-[#ea4335] text-xs tracking-tight">MoltyFoam</span>
        </div>
      );
    }

    if (code.includes('DUR') || name.includes('DURA')) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1a73e8] text-white font-extrabold tracking-tight text-xs shadow-2xs">
          <span className="text-[10px] bg-white text-blue-700 px-1 py-0.2 rounded font-black">DF</span>
          <span>DuraFoam</span>
        </div>
      );
    }

    if (code.includes('MAST') || name.includes('MASTER')) {
      return (
        <div className="border border-slate-900 rounded px-2 py-0.5 text-[11px] font-black tracking-widest text-slate-900 uppercase">
          MASTER
        </div>
      );
    }

    if (code.includes('DIAM') || name.includes('DIAMOND')) {
      return (
        <div className="flex items-center gap-1 text-[#1a73e8] font-black text-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#1a73e8]" />
          <span>Diamond</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
        <LayoutGrid className="w-4 h-4 text-slate-500" />
        <span className="truncate max-w-[100px]">{brand.name}</span>
      </div>
    );
  };

  if (activeBrands.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-transparent select-none shrink-0">
      <div className="flex items-center gap-3 overflow-x-auto pb-0.5 scrollbar-thin scroll-smooth">
        {activeBrands.map((brand) => {
          const isSelected = selectedBrandId === brand.id;
          const count = brandProductCounts[brand.id] ?? 0;
          const stock = brandStockMap[brand.id] ?? 0;
          const hasStock = stock > 0;

          return (
            <button
              key={brand.id}
              onClick={() => {
                if (hasStock) {
                  onSelectBrand(brand.id);
                }
              }}
              disabled={!hasStock}
              className={`group flex-1 min-w-[145px] max-w-[145px] h-[74px] px-3.5 py-1.5 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-150 ${!hasStock
                ? 'border-slate-200 bg-slate-50/70 opacity-40 cursor-not-allowed'
                : isSelected
                  ? 'border-[#1a73e8] bg-white shadow-sm ring-2 ring-blue-500/20 cursor-pointer'
                  : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/80 shadow-2xs cursor-pointer'
                }`}
            >
              {/* Brand Logo / Artwork preview */}
              <div className="h-7 flex items-center justify-center mb-0.5">
                {renderBrandVisual(brand)}
              </div>

              {/* Brand Name & Info */}
              <div className="w-full text-center">
                <p
                  className={`text-xs font-bold truncate leading-tight uppercase ${!hasStock ? 'text-slate-400' : isSelected ? 'text-[#1a73e8]' : 'text-slate-900'
                    }`}
                >
                  {brand.name}
                </p>
                <p className="text-[10px] leading-tight truncate">
                  {!hasStock ? (
                    <span className="text-red-500 font-bold">Out of stock</span>
                  ) : (
                    <span className="text-emerald-700 font-semibold">{stock} in stock</span>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
