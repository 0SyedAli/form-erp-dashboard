'use client';

import React from 'react';
import Image from 'next/image';
import { CatalogueProduct, ProductVariant, InventoryBalance, SaleType } from '@/types';
import { Package, AlertCircle } from 'lucide-react';

interface ProductGridProps {
  brandName: string;
  products: CatalogueProduct[];
  variants: ProductVariant[];
  inventoryBalances: InventoryBalance[];
  onSelectProduct: (product: CatalogueProduct) => void;
  selectedProductId?: string;
  saleType?: SaleType;
}

export default function ProductGrid({
  brandName,
  products,
  variants,
  inventoryBalances,
  onSelectProduct,
  selectedProductId,
  saleType = 'WALK_IN',
}: ProductGridProps) {
  // Helper to determine starting price and stock availability for a product based on active saleType
  const getProductMetrics = (productId: string) => {
    const productVariants = variants.filter(
      (v) => v.productId === productId && v.status === 'ACTIVE'
    );
    if (productVariants.length === 0) {
      return { startingPrice: 0, inStock: false, totalAvailable: 0 };
    }

    const getVariantPrice = (v: ProductVariant) => {
      if (saleType === 'WHOLESALE') return v.wholesalePrice || 0;
      if (saleType === 'DISTRIBUTOR') return v.distributorPrice || v.wholesalePrice || 0;
      return v.walkInPrice || v.retailPrice || 0;
    };

    const prices = productVariants.map(getVariantPrice).filter((p) => p > 0);
    const startingPrice = prices.length > 0 ? Math.min(...prices) : 0;

    const variantIds = new Set(productVariants.map((v) => v.id));
    const totalAvailable = inventoryBalances
      .filter((b) => variantIds.has(b.variantId))
      .reduce((sum, b) => sum + (b.available || 0), 0);

    return {
      startingPrice,
      inStock: totalAvailable > 0,
      totalAvailable,
    };
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-slate-50/50">
      {/* Header matching reference */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 font-sans tracking-tight">
          {brandName} Products
        </h2>
        <span className="text-xs text-slate-500 font-medium font-sans">
          {products.length} Products
        </span>
      </div>

      {/* Product Cards Grid */}
      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-base font-semibold text-slate-600">No products found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Try choosing a different category or clearing your search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const { startingPrice, inStock, totalAvailable } = getProductMetrics(
              product.id
            );
            const isSelected = selectedProductId === product.id;

            return (
              <div
                key={product.id}
                className={`bg-white rounded-2xl border-2 p-3 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-md ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Product Image */}
                <div className="w-full h-36 bg-slate-100 rounded-xl overflow-hidden relative mb-3 flex items-center justify-center">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 300px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Package className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-medium">Mattress Image</span>
                    </div>
                  )}

                  {/* Stock Availability Pill */}
                  <div className="absolute top-2 right-2">
                    {inStock ? (
                      <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                        In Stock ({totalAvailable})
                      </span>
                    ) : (
                      <span className="bg-rose-500/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 leading-snug line-clamp-1 font-sans">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 font-sans">
                      {product.description || 'Quality Foam Mattress'}
                    </p>
                  </div>

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-baseline gap-1">
                        {startingPrice > 0 ? (
                          <>
                            <span className="text-xs font-semibold text-slate-500">Rs.</span>
                            <span className="text-base font-extrabold text-blue-900 font-sans tracking-tight">
                              {startingPrice.toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Price unavailable
                          </span>
                        )}
                      </div>
                      {saleType !== 'WALK_IN' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {saleType === 'WHOLESALE' ? 'Wholesale' : 'Distributor'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      disabled={!inStock}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center cursor-pointer ${
                        inStock
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md active:scale-[0.98]'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                    >
                      {inStock ? 'Select' : 'Unavailable'}
                    </button>
                  </div>
                </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
