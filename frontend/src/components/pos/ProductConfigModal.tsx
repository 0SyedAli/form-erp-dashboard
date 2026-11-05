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

  // Helper: compute stock for a size under this product
  const getSizeStock = useCallback(
    (sizeId: string) => {
      return productVariants
        .filter((v) => String(v.sizeId) === String(sizeId))
        .reduce((sum, v) => sum + (stockMap[v.id] || 0), 0);
    },
    [productVariants, stockMap]
  );

  // Helper: compute stock for a thickness given the selected size
  const getThicknessStock = useCallback(
    (sizeId: string, thicknessId: string) => {
      const v = productVariants.find(
        (pv) =>
          String(pv.sizeId) === String(sizeId) &&
          String(pv.thicknessId) === String(thicknessId)
      );
      return v ? stockMap[v.id] || 0 : 0;
    },
    [productVariants, stockMap]
  );

  // 4. Selected state
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [selectedThicknessId, setSelectedThicknessId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Auto-select initial size and thickness whenever the product changes or modal opens
  useEffect(() => {
    if (!isOpen || !product || activeSizes.length === 0) return;

    // Prefer size that has stock > 0
    let bestSize = activeSizes.find((s) => getSizeStock(s.id) > 0);
    if (!bestSize) {
      // Fallback to size that has configured variants for this product
      bestSize = activeSizes.find((s) =>
        productVariants.some((v) => String(v.sizeId) === String(s.id))
      );
    }
    if (!bestSize) {
      bestSize = activeSizes[0];
    }

    const initSizeId = bestSize ? bestSize.id : '';
    setSelectedSizeId(initSizeId);

    // Prefer thickness that has stock > 0 for this size
    let bestThick = activeThicknesses.find(
      (t) => getThicknessStock(initSizeId, t.id) > 0
    );
    if (!bestThick) {
      bestThick = activeThicknesses.find((t) =>
        productVariants.some(
          (v) =>
            String(v.sizeId) === String(initSizeId) &&
            String(v.thicknessId) === String(t.id)
        )
      );
    }
    if (!bestThick) {
      bestThick = activeThicknesses[0];
    }

    setSelectedThicknessId(bestThick ? bestThick.id : '');
    setQuantity(1);
  }, [isOpen, product, activeSizes, activeThicknesses, getSizeStock, getThicknessStock, productVariants]);

  // Handle Size change
  const handleSelectSize = (sizeId: string) => {
    setSelectedSizeId(sizeId);
    // Check if current thickness has stock for this newly selected size
    const currentStock = getThicknessStock(sizeId, selectedThicknessId);
    if (currentStock <= 0) {
      // Auto-switch to first thickness with stock > 0
      const bestThick = activeThicknesses.find(
        (t) => getThicknessStock(sizeId, t.id) > 0
      );
      if (bestThick) {
        setSelectedThicknessId(bestThick.id);
      }
    }
    setQuantity(1);
  };

  // Find currently selected entities
  const selectedSize = useMemo(() => {
    return activeSizes.find((s) => s.id === selectedSizeId);
  }, [activeSizes, selectedSizeId]);

  const selectedThickness = useMemo(() => {
    return activeThicknesses.find((t) => t.id === selectedThicknessId);
  }, [activeThicknesses, selectedThicknessId]);

  // Currently matching variant
  const selectedVariant = useMemo(() => {
    return (
      productVariants.find(
        (v) =>
          String(v.sizeId) === String(selectedSizeId) &&
          String(v.thicknessId) === String(selectedThicknessId)
      ) || null
    );
  }, [productVariants, selectedSizeId, selectedThicknessId]);

  // Available stock for selected configuration
  const currentAvailableStock = useMemo(() => {
    if (!selectedVariant) return 0;
    return stockMap[selectedVariant.id] || 0;
  }, [selectedVariant, stockMap]);

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

  const totalPrice = unitPrice * quantity;

  // Add to Cart handler
  const handleAdd = () => {
    if (!product || currentAvailableStock <= 0) return;

    const variantId =
      selectedVariant?.id || `synth-${product.id}-${selectedSizeId}-${selectedThicknessId}`;
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
      unitPrice,
      quantity,
      lineTotal: totalPrice,
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
            <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <svg viewBox="0 0 50 32" className="w-12 h-9 text-blue-500">
                  <polygon points="25,3 47,13 25,23 3,13" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
                  <polygon points="3,13 25,23 25,29 3,19" fill="#3b82f6" />
                  <polygon points="25,23 47,13 47,19 25,29" fill="#1d4ed8" />
                </svg>
              )}
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

            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
              {activeSizes.map((size) => {
                const isSelected = selectedSizeId === size.id;
                const sizeStock = getSizeStock(size.id);
                const hasStock = sizeStock > 0;

                // Format display label
                const labelMatch = size.displayLabel.match(/^(.*?)\s*\((.*?)\)$/);
                const mainName = labelMatch ? labelMatch[2] : size.displayLabel;
                const subDim = labelMatch ? labelMatch[1] : `${size.length}" × ${size.width}"`;

                return (
                  <button
                    key={size.id}
                    type="button"
                    disabled={!hasStock}
                    onClick={() => handleSelectSize(size.id)}
                    className={`py-2 px-1.5 rounded-xl border-2 flex flex-col items-center justify-center transition-all relative ${
                      !hasStock
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                        : isSelected
                        ? 'border-[#1a73e8] bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20 cursor-pointer'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    {/* Small rounded stock badge */}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1 leading-none ${
                        hasStock
                          ? isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {sizeStock}
                    </span>

                    <span
                      className={`text-xs font-bold truncate max-w-full ${
                        !hasStock
                          ? 'text-slate-400'
                          : isSelected
                          ? 'text-[#1a73e8]'
                          : 'text-slate-800'
                      }`}
                    >
                      {mainName}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                      {subDim}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Select Thickness (Depth) */}
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

            <div className="grid grid-cols-5 gap-2">
              {activeThicknesses.map((th) => {
                const isSelected = selectedThicknessId === th.id;
                const thickStock = getThicknessStock(selectedSizeId, th.id);
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
                    className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1 transition-all relative ${
                      !hasStock
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                        : isSelected
                        ? 'border-[#1a73e8] bg-blue-50/40 text-[#1a73e8] shadow-xs ring-1 ring-blue-500/20 cursor-pointer'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 cursor-pointer'
                    }`}
                  >
                    <span>{th.value}&quot;</span>
                    {/* Small rounded stock badge */}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                        hasStock
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">Price: </span>
              <span className="text-base font-extrabold text-[#0f9d58] font-sans">
                Rs. {totalPrice.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={currentAvailableStock <= 0}
              className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 select-none ${
                currentAvailableStock > 0
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
