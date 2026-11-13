'use client';

import React from 'react';
import Image from 'next/image';
import {
  CatalogueProduct,
  ProductVariant,
  InventoryBalance,
  SaleType,
  MattressSize,
  MattressThickness,
} from '@/types';
import { Package, AlertCircle } from 'lucide-react';

interface ProductGridProps {
  brandName: string;
  products: CatalogueProduct[];
  variants: ProductVariant[];
  inventoryBalances: InventoryBalance[];
  onSelectProduct: (product: CatalogueProduct) => void;
  selectedProductId?: string;
  saleType?: SaleType;
  selectedSizeId?: string;
  selectedThicknessId?: string;
  sizes?: MattressSize[];
  thicknesses?: MattressThickness[];
}

// Ultra-realistic 3D isometric mattress illustration matching the reference screenshot
function RealisticMattressImage({ name, index }: { name: string; index: number }) {
  const colorThemes = [
    {
      top: '#e0edff',
      topGrad: '#f0f6ff',
      sideLeft: '#3b82f6',
      sideRight: '#1d4ed8',
      ribbon: '#1e40af',
      border: '#93c5fd',
      quilt: '#93c5fd',
      textColor: '#ffffff',
      label: 'Durafoam',
    },
    {
      top: '#fef3c7',
      topGrad: '#fffbeb',
      sideLeft: '#d97706',
      sideRight: '#b45309',
      ribbon: '#92400e',
      border: '#fde68a',
      quilt: '#fcd34d',
      textColor: '#ffffff',
      label: 'Durafoam',
    },
    {
      top: '#f1f5f9',
      topGrad: '#f8fafc',
      sideLeft: '#64748b',
      sideRight: '#475569',
      ribbon: '#334155',
      border: '#cbd5e1',
      quilt: '#94a3b8',
      textColor: '#ffffff',
      label: 'Durafoam',
    },
    {
      top: '#fce7f3',
      topGrad: '#fdf2f8',
      sideLeft: '#ec4899',
      sideRight: '#be185d',
      ribbon: '#9d174d',
      border: '#fbcfe8',
      quilt: '#f472b6',
      textColor: '#ffffff',
      label: 'Durafoam',
    },
    {
      top: '#cffafe',
      topGrad: '#ecfeff',
      sideLeft: '#06b6d4',
      sideRight: '#0e7490',
      ribbon: '#155e75',
      border: '#a5f3fc',
      quilt: '#67e8f9',
      textColor: '#ffffff',
      label: 'Durafoam',
    },
    {
      top: '#fef9c3',
      topGrad: '#fefce8',
      sideLeft: '#eab308',
      sideRight: '#a16207',
      ribbon: '#854d0e',
      border: '#fef08a',
      quilt: '#fde047',
      textColor: '#ffffff',
      label: 'Durafoam',
    },
  ];

  const theme = colorThemes[index % colorThemes.length];
  const brandLabel = name.toUpperCase().includes('MOLTY') ? 'MoltyFoam' : 'Durafoam';

  return (
    <div className="w-full h-full flex items-center justify-center p-2 relative select-none">
      <svg
        viewBox="0 0 200 130"
        className="w-full h-full max-h-[115px] drop-shadow-md select-none transition-transform duration-200 group-hover:scale-105"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`topGrad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.topGrad} />
            <stop offset="100%" stopColor={theme.top} />
          </linearGradient>
          <linearGradient id={`sideL-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.sideLeft} />
            <stop offset="100%" stopColor={theme.sideRight} />
          </linearGradient>
          <filter id={`shadow-${index}`} x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Soft Ground Shadow */}
        <ellipse cx="100" cy="116" rx="75" ry="12" fill="#cbd5e1" opacity="0.45" />

        {/* 3D Isometric Mattress Block */}
        <g filter={`url(#shadow-${index})`}>
          {/* Top Quilted Pillow Surface */}
          <polygon
            points="100,20 178,54 100,88 22,54"
            fill={`url(#topGrad-${index})`}
            stroke={theme.border}
            strokeWidth="1.5"
          />

          {/* Quilt stitching pattern (diamond tufting) */}
          <line x1="60" y1="37" x2="140" y2="71" stroke={theme.quilt} strokeWidth="1" strokeDasharray="3,3" opacity="0.8" />
          <line x1="140" y1="37" x2="60" y2="71" stroke={theme.quilt} strokeWidth="1" strokeDasharray="3,3" opacity="0.8" />
          <line x1="38" y1="46" x2="118" y2="80" stroke={theme.quilt} strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
          <line x1="162" y1="46" x2="82" y2="80" stroke={theme.quilt} strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />

          {/* Quilt Tuft Buttons */}
          <circle cx="100" cy="54" r="2" fill={theme.quilt} />
          <circle cx="80" cy="45" r="1.5" fill={theme.quilt} />
          <circle cx="120" cy="63" r="1.5" fill={theme.quilt} />
          <circle cx="120" cy="45" r="1.5" fill={theme.quilt} />
          <circle cx="80" cy="63" r="1.5" fill={theme.quilt} />
          <circle cx="60" cy="54" r="1.5" fill={theme.quilt} />
          <circle cx="140" cy="54" r="1.5" fill={theme.quilt} />

          {/* Left Foam Border Face */}
          <polygon
            points="22,54 100,88 100,112 22,78"
            fill={`url(#sideL-${index})`}
            stroke={theme.border}
            strokeWidth="1"
          />

          {/* Brand Ribbon on the Left Side Face */}
          <polygon
            points="38,72 84,92 84,103 38,83"
            fill={theme.ribbon}
            opacity="0.9"
          />
          <text
            x="61"
            y="91"
            fill={theme.textColor}
            fontSize="6.5"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="sans-serif"
            letterSpacing="0.5"
            transform="rotate(13 61 91)"
          >
            {brandLabel}
          </text>

          {/* Right Foam Border Face */}
          <polygon
            points="100,88 178,54 178,78 100,112"
            fill={theme.sideRight}
            stroke={theme.border}
            strokeWidth="1"
            opacity="0.9"
          />

          {/* Piping edge highlight */}
          <line x1="22" y1="54" x2="100" y2="88" stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
          <line x1="100" y1="88" x2="178" y2="54" stroke="#ffffff" strokeWidth="1.2" opacity="0.4" />
        </g>
      </svg>
    </div>
  );
}

export default function ProductGrid({
  brandName,
  products,
  variants,
  inventoryBalances,
  onSelectProduct,
  selectedProductId,
  saleType = 'WALK_IN',
  selectedSizeId = 'ALL',
  selectedThicknessId = 'ALL',
  sizes = [],
  thicknesses = [],
}: ProductGridProps) {
  // Helper to determine starting price, stock, and matching size/thickness for a product
  const getProductMetrics = (productId: string) => {
    const productVariants = variants.filter(
      (v) => v.productId === productId && v.status === 'ACTIVE'
    );
    if (productVariants.length === 0) {
      return {
        startingPrice: 0,
        inStock: false,
        totalAvailable: 0,
      };
    }

    const getVariantPrice = (v: ProductVariant) => {
      if (saleType === 'WHOLESALE') return v.wholesalePrice || 0;
      if (saleType === 'DISTRIBUTOR') return v.distributorPrice || v.wholesalePrice || 0;
      return v.walkInPrice || v.retailPrice || 0;
    };

    let targetVariants = productVariants;
    if (selectedSizeId && selectedSizeId !== 'ALL') {
      const filtered = targetVariants.filter((v) => v.sizeId === selectedSizeId);
      if (filtered.length > 0) targetVariants = filtered;
    }
    if (selectedThicknessId && selectedThicknessId !== 'ALL') {
      const filtered = targetVariants.filter((v) => v.thicknessId === selectedThicknessId);
      if (filtered.length > 0) targetVariants = filtered;
    }

    const sorted = [...targetVariants].sort((a, b) => getVariantPrice(a) - getVariantPrice(b));
    const representative = sorted.find((v) => getVariantPrice(v) > 0) || sorted[0] || productVariants[0];

    const startingPrice = representative ? getVariantPrice(representative) : 0;

    const variantIds = new Set(productVariants.map((v) => v.id));
    const matchingBalances = inventoryBalances.filter((b) => variantIds.has(b.variantId));
    let totalAvailable = 0;
    if (matchingBalances.length > 0) {
      totalAvailable = matchingBalances.reduce((sum, b) => sum + Math.max(0, b.available || 0), 0);
    } else {
      totalAvailable = productVariants.reduce(
        (sum, v) => sum + Math.max(0, v.stock ?? (v as any).onHand ?? 0),
        0
      );
    }

    return {
      startingPrice,
      inStock: totalAvailable > 0,
      totalAvailable,
    };
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col p-4 overflow-hidden select-none">
      {/* Header matching reference mockup */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0 mb-3.5">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 font-sans tracking-tight">
          {brandName} Products
        </h2>
        <span className="text-xs text-slate-400 font-medium font-sans">
          {products.length} Products
        </span>
      </div>

      {/* Product Cards Grid */}
      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-base font-semibold text-slate-600">No products found in this branch</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            This branch does not have stock or catalogue products assigned yet. Use the <strong>Stock Branch</strong> switcher in the header to view or sell products from sister branches.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map((product, idx) => {
              const { startingPrice, inStock, totalAvailable } = getProductMetrics(product.id);
              const isSelected = selectedProductId === product.id;
              // { console.log(product?.category?.name) }
              return (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className={`group bg-white rounded-2xl border-2 p-3.5 flex flex-col justify-between transition-all duration-150 cursor-pointer ${isSelected
                    ? 'border-[#1a73e8] shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                >
                  {/* Mattress Visual Container */}
                  <div className="w-full h-26 bg-slate-50/70 rounded-xl overflow-hidden relative mb-3 flex items-center justify-center border border-slate-100">
                    <Image
                      src={product.imageUrl || '/assets/mattress/foam1.png'}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                      className="object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                      unoptimized
                    />

                    {/* In Stock Badge */}
                    <div className="absolute top-2 right-2">
                      {inStock ? (
                        <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                          In Stock ({totalAvailable})
                        </span>
                      ) : (
                        <span className="bg-rose-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                          Line: {product.productLineName || (product as any).productLine?.name || product.name}
                        </span>
                      </div> */}
                      <p className="font-bold text-sm text-slate-500 leading-snug line-clamp-1 font-sans" style={{ fontSize: '14px' }}>
                        {/* {product?.category?.name || 'Standard Foam'} */}
                        [ {product?.category?.name} ]
                      </p>
                      <h3 className="font-bold text-sm text-slate-900  font-sans" style={{ fontSize: '17px' }}>
                        {/* {product.name} */}
                        {product.productLineName || (product as any).productLine?.name || product.name}
                      </h3>

                    </div>

                    <div className="pt-3">
                      {/* Price Display matching reference mockup */}
                      <div className="flex items-baseline gap-1">
                        {startingPrice > 0 ? (
                          <div className="flex items-baseline gap-1 font-sans">
                            <span className="text-xs font-bold text-slate-900">Rs.</span>
                            {/* <span className="text-lg font-black text-slate-900 tracking-tight">
                              {startingPrice.toLocaleString()}
                            </span> */}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Price unavailable
                          </span>
                        )}
                      </div>

                      {/* Select Action Button matching reference mockup */}
                      {/* <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(product);
                        }}
                        disabled={!inStock}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center cursor-pointer ${!inStock
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : isSelected
                              ? 'bg-[#1a73e8] text-white hover:bg-blue-700 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
                          }`}
                      >
                        {inStock ? 'Select' : 'Unavailable'}
                      </button> */}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
