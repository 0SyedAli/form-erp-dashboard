'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  CatalogueProduct,
  ProductVariant,
  MattressSize,
  MattressThickness,
  InventoryBalance,
  POSCartItem,
  SaleType,
} from '@/types';
import { X, ShoppingCart, Minus, Plus } from 'lucide-react';

interface ProductConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: CatalogueProduct | null;
  brandName: string;
  categoryName: string;
  variants: ProductVariant[];
  sizes: MattressSize[];
  thicknesses: MattressThickness[];
  inventoryBalances: InventoryBalance[];
  onAddToCart: (item: POSCartItem) => void;
  existingCartQuantity?: number;
  saleType?: SaleType;
  variantStockMap?: Record<string, number>;
}

interface UniqueSizeOption {
  dimKey: string;
  length: number;
  width: number;
  displayLabel: string;
  sizeIds: string[];
}

export default function ProductConfigModal({
  isOpen,
  onClose,
  product,
  brandName,
  categoryName,
  variants,
  sizes,
  thicknesses,
  inventoryBalances,
  onAddToCart,
  existingCartQuantity = 0,
  saleType = 'WALK_IN',
  variantStockMap,
}: ProductConfigModalProps) {
  // 1. Stock map for variants
  const stockMap = useMemo(() => {
    if (variantStockMap) return variantStockMap;
    const map: Record<string, number> = {};
    variants.forEach((v) => {
      const balance = inventoryBalances.find((b) => b.variantId === v.id);
      const stock = balance?.available ?? v.stock ?? (v as any).onHand ?? 0;
      map[v.id] = Math.max(0, stock);
    });
    return map;
  }, [variantStockMap, variants, inventoryBalances]);

  // 2. Active variants belonging to this product
  const productVariants = useMemo(() => {
    if (!product) return [];
    return variants.filter(
      (v) => String(v.productId) === String(product.id) && v.status === 'ACTIVE'
    );
  }, [product, variants]);

  // 3. Active sizes and thicknesses from DB
  const activeSizes = useMemo(() => {
    return sizes.filter((s) => s.status === 'ACTIVE');
  }, [sizes]);

  const activeThicknesses = useMemo(() => {
    return thicknesses.filter((t) => t.status === 'ACTIVE');
  }, [thicknesses]);

  // Deduplicate and group sizes by dimension (length x width) for this product
  const uniqueProductSizes = useMemo<UniqueSizeOption[]>(() => {
    const map = new Map<string, UniqueSizeOption>();

    for (const v of productVariants) {
      const s = activeSizes.find((sz) => String(sz.id) === String(v.sizeId));
      if (!s) continue;
      const dimKey = s.length && s.width ? `${s.length}x${s.width}` : s.displayLabel || s.id;
      if (!map.has(dimKey)) {
        map.set(dimKey, {
          dimKey,
          length: s.length,
          width: s.width,
          displayLabel: s.length && s.width ? `${s.length}" × ${s.width}"` : s.displayLabel,
          sizeIds: [String(s.id)],
        });
      } else {
        const existing = map.get(dimKey)!;
        if (!existing.sizeIds.includes(String(s.id))) {
          existing.sizeIds.push(String(s.id));
        }
      }
    }

    return Array.from(map.values());
  }, [productVariants, activeSizes]);

  // Helper: compute total stock for a unique dimension option
  const getSizeStock = useCallback(
    (sizeOpt: UniqueSizeOption) => {
      return productVariants
        .filter((v) => sizeOpt.sizeIds.includes(String(v.sizeId)))
        .reduce((sum, v) => sum + (stockMap[v.id] || 0), 0);
    },
    [productVariants, stockMap]
  );

  // Available unique sizes with stock > 0
  const availableSizes = useMemo(() => {
    const inStock = uniqueProductSizes.filter((s) => getSizeStock(s) > 0);
    return inStock.length > 0 ? inStock : uniqueProductSizes;
  }, [uniqueProductSizes, getSizeStock]);

  // Selected state
  const [selectedDimKey, setSelectedDimKey] = useState<string>('');
  const [selectedThicknessId, setSelectedThicknessId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Currently selected unique size option
  const selectedSize = useMemo(() => {
    return availableSizes.find((s) => s.dimKey === selectedDimKey) || availableSizes[0] || null;
  }, [availableSizes, selectedDimKey]);

  // Available thicknesses for the selected size dimension that have variants & stock
  const availableThicknesses = useMemo(() => {
    if (!selectedSize) return [];
    const matchingVariants = productVariants.filter((v) =>
      selectedSize.sizeIds.includes(String(v.sizeId))
    );

    const map = new Map<string, { id: string; value: number; stock: number }>();
    for (const v of matchingVariants) {
      const th = activeThicknesses.find((t) => String(t.id) === String(v.thicknessId));
      if (!th) continue;
      const thKey = String(th.value);
      const vStock = stockMap[v.id] || 0;
      if (!map.has(thKey)) {
        map.set(thKey, {
          id: String(th.id),
          value: th.value,
          stock: vStock,
        });
      } else {
        const existing = map.get(thKey)!;
        existing.stock += vStock;
      }
    }

    const list = Array.from(map.values()).sort((a, b) => a.value - b.value);
    const inStock = list.filter((t) => t.stock > 0);
    return inStock.length > 0 ? inStock : list;
  }, [selectedSize, productVariants, activeThicknesses, stockMap]);

  // Currently matching variant
  const selectedVariant = useMemo(() => {
    if (!selectedSize || !selectedThicknessId) return null;
    const targetThick = activeThicknesses.find((t) => String(t.id) === String(selectedThicknessId));
    if (!targetThick) return null;

    return (
      productVariants.find((v) => {
        const matchesSize = selectedSize.sizeIds.includes(String(v.sizeId));
        if (!matchesSize) return false;
        const vThick = activeThicknesses.find((t) => String(t.id) === String(v.thicknessId));
        return vThick && vThick.value === targetThick.value;
      }) || null
    );
  }, [productVariants, selectedSize, selectedThicknessId, activeThicknesses]);

  // Available stock for selected configuration
  const currentAvailableStock = useMemo(() => {
    if (!selectedVariant) return 0;
    return stockMap[selectedVariant.id] || 0;
  }, [selectedVariant, stockMap]);

  // Auto-select initial size and thickness whenever the product changes or modal opens
  useEffect(() => {
    if (!isOpen || !product || availableSizes.length === 0) return;

    // Prefer size that has stock > 0
    let bestSize = availableSizes.find((s) => getSizeStock(s) > 0);
    if (!bestSize) {
      bestSize = availableSizes[0];
    }

    const initDimKey = bestSize ? bestSize.dimKey : '';
    setSelectedDimKey(initDimKey);

    if (bestSize) {
      const matchingVariants = productVariants.filter((v) =>
        bestSize.sizeIds.includes(String(v.sizeId))
      );
      const inStockVar = matchingVariants.find((v) => (stockMap[v.id] || 0) > 0);
      const chosenVar = inStockVar || matchingVariants[0];
      if (chosenVar) {
        setSelectedThicknessId(String(chosenVar.thicknessId));
      }
    }

    setQuantity(1);
  }, [isOpen, product, availableSizes, productVariants, stockMap, getSizeStock]);

  // Handle Size change
  const handleSelectSize = (dimKey: string) => {
    setSelectedDimKey(dimKey);
    const newSize = availableSizes.find((s) => s.dimKey === dimKey);
    if (newSize) {
      const matchingVariants = productVariants.filter((v) =>
        newSize.sizeIds.includes(String(v.sizeId))
      );
      // Auto-switch to thickness with stock > 0
      const inStockVar = matchingVariants.find((v) => (stockMap[v.id] || 0) > 0);
      const chosenVar = inStockVar || matchingVariants[0];
      if (chosenVar) {
        setSelectedThicknessId(String(chosenVar.thicknessId));
      }
    }
    setQuantity(1);
  };

  // Find currently selected thickness entity
  const selectedThickness = useMemo(() => {
    return activeThicknesses.find((t) => String(t.id) === String(selectedThicknessId));
  }, [activeThicknesses, selectedThicknessId]);

  // Price helper
  const getVariantPrice = useCallback(
    (v?: ProductVariant | null) => {
      if (!v) return 0;
      if (saleType === 'WHOLESALE') return v.wholesalePrice || 0;
      if (saleType === 'DISTRIBUTOR') return v.distributorPrice || v.wholesalePrice || 0;
      return v.walkInPrice || v.retailPrice || 0;
    },
    [saleType]
  );

  const basePrice = useMemo(() => {
    if (productVariants.length === 0) return 0;
    const prices = productVariants.map(getVariantPrice).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [productVariants, getVariantPrice]);

  const unitPrice = useMemo(() => {
    if (selectedVariant) {
      const p = getVariantPrice(selectedVariant);
      if (p > 0) return p;
    }
    return basePrice;
  }, [selectedVariant, getVariantPrice, basePrice]);

  // Editable price state for temporary price adjustments / negotiations
  const [customPrice, setCustomPrice] = useState<number | ''>('');

  useEffect(() => {
    setCustomPrice(unitPrice);
  }, [unitPrice, selectedDimKey, selectedThicknessId]);

  const effectiveUnitPrice = typeof customPrice === 'number' && customPrice >= 0 ? customPrice : unitPrice;
  const totalPrice = effectiveUnitPrice * quantity;

  // Add to Cart handler
  const handleAdd = () => {
    if (!product || currentAvailableStock <= 0) return;

    const variantId =
      selectedVariant?.id || `synth-${product.id}-${selectedDimKey}-${selectedThicknessId}`;
    const finalUnitPrice = typeof customPrice === 'number' && customPrice >= 0 ? customPrice : unitPrice;
    const cartItem: POSCartItem = {
      variantId,
      productId: product.id,
      productName: product.name,
      brandName: brandName || 'Foam',
      categoryName: categoryName || 'Foam',
      sizeLabel: selectedSize?.displayLabel || 'Standard',
      thicknessInches: selectedThickness?.value || 6,
      sku:
        selectedVariant?.sku ||
        `${product.code || 'SKU'}-${selectedThickness?.value || 6}`,
      originalPrice: unitPrice,
      unitPrice: finalUnitPrice,
      quantity,
      lineTotal: finalUnitPrice * quantity,
      availableStock: currentAvailableStock,
      imageUrl: product.imageUrl,
    };

    onAddToCart(cartItem);
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 font-sans tracking-tight">
            {product.name}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Details Header */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center gap-4 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
            <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 p-1">
              <Image
                src={product.imageUrl || '/assets/mattress/foam1.png'}
                alt={product.name}
                width={64}
                height={64}
                className="w-full h-full object-contain"
                unoptimized
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-slate-900 font-sans truncate">{product.name}</h4>
              <p className="text-xs text-slate-500 font-sans">
                {product.description || `${brandName} ${categoryName}`}
              </p>
              <p className="text-xs font-semibold text-slate-700 mt-1">
                Base Price:{' '}
                <span className="font-bold text-slate-900">
                  Rs. {basePrice.toLocaleString()}
                </span>
              </p>
            </div>
          </div>

          {/* Select Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 font-sans">
                Select Size
              </label>
              {selectedSize && (
                <span className="text-[11px] font-medium text-slate-500">
                  Selected: <strong className="text-slate-800">{selectedSize.displayLabel}</strong>
                </span>
              )}
            </div>

            {availableSizes.length === 0 ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <p className="text-xs font-semibold text-amber-800">
                  No sizes available for this product at this branch.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSizes.map((size) => {
                  const isSelected = selectedDimKey === size.dimKey;
                  const sizeStock = getSizeStock(size);
                  const hasStock = sizeStock > 0;

                  return (
                    <button
                      key={size.dimKey}
                      type="button"
                      disabled={!hasStock}
                      onClick={() => handleSelectSize(size.dimKey)}
                      className={`py-2 px-1.5 rounded-xl border-2 flex flex-col items-center justify-center transition-all relative ${!hasStock
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                        : isSelected
                          ? 'border-[#1a73e8] bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20 cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 cursor-pointer'
                        }`}
                    >
                      {/* Small rounded stock badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1 leading-none ${hasStock
                          ? isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-500'
                          }`}
                      >
                        {sizeStock}
                      </span>

                      <span className="text-[15px] font-bold text-slate-900 mt-0.5 whitespace-nowrap">
                        {size.displayLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Select Thickness (Depth) */}
          {availableThicknesses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 font-sans">
                  Select Thickness (Depth)
                </label>
                {selectedThickness && (
                  <span className="text-[11px] font-medium text-slate-500">
                    Stock:{' '}
                    <strong
                      className={
                        currentAvailableStock > 0 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'
                      }
                    >
                      {currentAvailableStock > 0 ? `${currentAvailableStock} available` : 'Out of stock'}
                    </strong>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {availableThicknesses.map((th) => {
                  const isSelected = String(selectedThicknessId) === String(th.id);
                  const thickStock = th.stock;
                  const hasStock = thickStock > 0;

                  return (
                    <button
                      key={th.id}
                      type="button"
                      disabled={!hasStock}
                      onClick={() => {
                        setSelectedThicknessId(th.id);
                        setQuantity(1);
                      }}
                      className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1 transition-all relative ${!hasStock
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                        : isSelected
                          ? 'border-[#1a73e8] bg-blue-50/40 text-[#1a73e8] shadow-xs ring-1 ring-blue-500/20 cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 cursor-pointer'
                        }`}
                    >
                      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{th.value}&quot;</span>
                      {/* Small rounded stock badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${hasStock
                          ? isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-500'
                          }`}
                      >
                        {thickStock}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Row */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Quantity</span>
            <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || currentAvailableStock === 0}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={1}
                max={Math.max(1, currentAvailableStock)}
                value={currentAvailableStock === 0 ? 0 : quantity}
                disabled={currentAvailableStock === 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setQuantity(Math.min(currentAvailableStock, Math.max(1, val)));
                }}
                className="w-10 text-center font-bold text-xs text-slate-800 border-none focus:outline-hidden disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(currentAvailableStock, q + 1))}
                disabled={quantity >= currentAvailableStock || currentAvailableStock === 0}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Price & Add To Cart Button */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-1 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 font-sans">Price: Rs.</span>
                <input
                  type="number"
                  min={0}
                  value={customPrice}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                    setCustomPrice(val);
                  }}
                  className="w-20 text-xs font-black text-slate-900 border-none focus:outline-hidden font-sans"
                  title="Click to edit unit price"
                />
              </div>
              {quantity > 1 && (
                <span className="text-[10px] font-bold text-[#0f9d58] mt-0.5 font-sans">
                  Total: Rs. {totalPrice.toLocaleString()}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={currentAvailableStock <= 0}
              className={`font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 select-none ${currentAvailableStock > 0
                ? 'bg-[#0f9d58] hover:bg-[#0b8043] text-white shadow-xs hover:shadow-md cursor-pointer active:scale-95'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
                }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{currentAvailableStock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
