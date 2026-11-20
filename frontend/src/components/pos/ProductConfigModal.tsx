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
  searchQuery?: string;
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
  searchQuery = '',
}: ProductConfigModalProps) {
  // 1. Stock map for variants
  const stockMap = useMemo(() => {
    if (variantStockMap) return variantStockMap;
    const map: Record<string, number> = {};
    variants.forEach((v) => {
      const balance = inventoryBalances.find((b) => b.variantId === v.id || b.sku === v.sku);
      const stock =
        balance?.available !== undefined && balance.available !== null
          ? balance.available
          : balance?.onHand !== undefined
            ? balance.onHand
            : v.stock ?? (v as any).onHand ?? 0;
      map[v.id] = Math.max(0, stock);
    });
    return map;
  }, [variantStockMap, variants, inventoryBalances]);

  // 2. Active variants belonging to this product
  const productVariants = useMemo(() => {
    if (!product) return [];
    return variants.filter(
      (v) => String(v.productId) === String(product.id) && (v.status === 'ACTIVE' || !v.status)
    );
  }, [product, variants]);

  // 3. Active sizes and thicknesses from DB
  const activeSizes = useMemo(() => {
    return sizes.filter((s) => s.status === 'ACTIVE' || !s.status);
  }, [sizes]);

  const activeThicknesses = useMemo(() => {
    return thicknesses.filter((t) => t.status === 'ACTIVE' || !t.status);
  }, [thicknesses]);

  // All unique sizes configured for this product (sorted dimensionally)
  const uniqueProductSizes = useMemo<UniqueSizeOption[]>(() => {
    const map = new Map<string, UniqueSizeOption>();

    for (const v of productVariants) {
      const s = activeSizes.find(
        (sz) => String(sz.id) === String(v.sizeId) || String((sz as any)._id) === String(v.sizeId)
      );
      const dimKey = s && s.length && s.width
        ? `${s.length}x${s.width}`
        : s?.displayLabel || (v as any).sizeLabel || String(v.sizeId || 'default');
      const displayLabel = s && s.length && s.width
        ? `${s.length}" × ${s.width}"`
        : s?.displayLabel || (v as any).sizeLabel || `${dimKey}`;
      const sId = s ? String(s.id) : String(v.sizeId);

      if (!map.has(dimKey)) {
        map.set(dimKey, {
          dimKey,
          length: s?.length || 0,
          width: s?.width || 0,
          displayLabel,
          sizeIds: [sId],
        });
      } else {
        const existing = map.get(dimKey)!;
        if (!existing.sizeIds.includes(sId)) {
          existing.sizeIds.push(sId);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.length && b.length && a.length !== b.length) return a.length - b.length;
      if (a.width && b.width) return a.width - b.width;
      return a.displayLabel.localeCompare(b.displayLabel);
    });
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

  // Stock filter tab: 'in_stock' (default) vs 'out_of_stock'
  const [stockTab, setStockTab] = useState<'in_stock' | 'out_of_stock'>('in_stock');

  // Partition sizes into in-stock and out-of-stock
  const inStockSizes = useMemo(() => {
    return uniqueProductSizes.filter((s) => getSizeStock(s) > 0);
  }, [uniqueProductSizes, getSizeStock]);

  const outOfStockSizes = useMemo(() => {
    return uniqueProductSizes.filter((s) => getSizeStock(s) === 0);
  }, [uniqueProductSizes, getSizeStock]);

  // Available unique sizes according to active tab
  const availableSizes = useMemo(() => {
    if (stockTab === 'in_stock') {
      return inStockSizes;
    }
    return outOfStockSizes;
  }, [stockTab, inStockSizes, outOfStockSizes]);

  // Selected state
  const [selectedDimKey, setSelectedDimKey] = useState<string>('');
  const [selectedThicknessId, setSelectedThicknessId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Auto-switch stockTab on modal open or product change
  useEffect(() => {
    if (!isOpen || !product) return;
    if (inStockSizes.length > 0) {
      setStockTab('in_stock');
    } else {
      setStockTab('out_of_stock');
    }
  }, [isOpen, product?.id, inStockSizes.length]);

  // Currently selected unique size option
  const selectedSize = useMemo(() => {
    return availableSizes.find((s) => s.dimKey === selectedDimKey) || availableSizes[0] || null;
  }, [availableSizes, selectedDimKey]);

  // Available thicknesses for the selected size dimension, filtered by tab
  const availableThicknesses = useMemo(() => {
    if (!selectedSize) return [];
    const matchingVariants = productVariants.filter((v) =>
      selectedSize.sizeIds.includes(String(v.sizeId))
    );

    const map = new Map<string, { id: string; value: number; stock: number }>();
    for (const v of matchingVariants) {
      const th = activeThicknesses.find(
        (t) => String(t.id) === String(v.thicknessId) || String((t as any)._id) === String(v.thicknessId)
      );
      const thVal = th ? th.value : (Number((v as any).thicknessLabel?.replace?.(/[^0-9.]/g, '')) || 0);
      const thId = th ? String(th.id) : String(v.thicknessId);
      const thKey = String(thVal || thId);
      const vStock = stockMap[v.id] || 0;
      if (!map.has(thKey)) {
        map.set(thKey, {
          id: thId,
          value: thVal,
          stock: vStock,
        });
      } else {
        const existing = map.get(thKey)!;
        existing.stock += vStock;
      }
    }

    const allThicks = Array.from(map.values()).sort((a, b) => a.value - b.value);

    if (stockTab === 'in_stock') {
      const inStockThicks = allThicks.filter((t) => t.stock > 0);
      return inStockThicks.length > 0 ? inStockThicks : allThicks;
    } else {
      const outStockThicks = allThicks.filter((t) => t.stock === 0);
      return outStockThicks.length > 0 ? outStockThicks : allThicks;
    }
  }, [selectedSize, productVariants, activeThicknesses, stockMap, stockTab]);

  // Currently matching variant
  const selectedVariant = useMemo(() => {
    if (!selectedSize) return null;
    if (availableThicknesses.length === 0) {
      // Product or Brand does not have thickness specifications
      return (
        productVariants.find((v) => selectedSize.sizeIds.includes(String(v.sizeId))) || null
      );
    }
    if (!selectedThicknessId) return null;
    const targetThick = activeThicknesses.find(
      (t) => String(t.id) === String(selectedThicknessId) || String((t as any)._id) === String(selectedThicknessId)
    );

    return (
      productVariants.find((v) => {
        const matchesSize = selectedSize.sizeIds.includes(String(v.sizeId));
        if (!matchesSize) return false;
        if (String(v.thicknessId) === String(selectedThicknessId)) return true;
        if (targetThick) {
          const vThick = activeThicknesses.find(
            (t) => String(t.id) === String(v.thicknessId) || String((t as any)._id) === String(v.thicknessId)
          );
          return vThick && vThick.value === targetThick.value;
        }
        return false;
      }) || null
    );
  }, [productVariants, selectedSize, selectedThicknessId, activeThicknesses, availableThicknesses]);

  // Available stock for selected configuration
  const currentAvailableStock = useMemo(() => {
    if (!selectedVariant) return 0;
    return stockMap[selectedVariant.id] || 0;
  }, [selectedVariant, stockMap]);

  // Auto-select initial size and thickness whenever the product changes or modal opens
  useEffect(() => {
    if (!isOpen || !product || availableSizes.length === 0) return;

    // Check if searchQuery mentions a specific size dimension (e.g. "72x42", "78x60")
    let bestSize: UniqueSizeOption | undefined;
    if (searchQuery) {
      const normQuery = searchQuery.toLowerCase().replace(/(\d+)\s*[xX*×]\s*(\d+)/g, '$1x$2');
      bestSize = availableSizes.find((s) => {
        const dim = s.dimKey.toLowerCase();
        return normQuery.includes(dim);
      });
    }

    if (!bestSize) {
      if (stockTab === 'in_stock') {
        bestSize = availableSizes.find((s) => getSizeStock(s) > 0);
      }
    }
    if (!bestSize) {
      bestSize = availableSizes[0];
    }

    const initDimKey = bestSize ? bestSize.dimKey : '';
    setSelectedDimKey(initDimKey);

    if (bestSize) {
      const matchingVariants = productVariants.filter((v) =>
        bestSize!.sizeIds.includes(String(v.sizeId))
      );

      // If searchQuery mentions a thickness number (e.g. 5, 6, 8, 4), match it
      let chosenVar: ProductVariant | undefined;
      if (searchQuery) {
        const thickMatch = searchQuery.match(/\b([1-9]|1[0-2])(?:"|''|inch)?\b/);
        if (thickMatch) {
          const targetVal = Number(thickMatch[1]);
          chosenVar = matchingVariants.find((v) => {
            const th = activeThicknesses.find((t) => String(t.id) === String(v.thicknessId));
            return th && th.value === targetVal;
          });
        }
      }

      if (!chosenVar) {
        if (stockTab === 'in_stock') {
          chosenVar = matchingVariants.find((v) => (stockMap[v.id] || 0) > 0) || matchingVariants[0];
        } else {
          chosenVar = matchingVariants.find((v) => (stockMap[v.id] || 0) === 0) || matchingVariants[0];
        }
      }

      if (chosenVar) {
        setSelectedThicknessId(String(chosenVar.thicknessId));
      }
    }

    setQuantity(1);
  }, [isOpen, product, availableSizes, productVariants, stockMap, getSizeStock, searchQuery, activeThicknesses, stockTab]);

  // Handle Tab Switch
  const handleTabChange = (newTab: 'in_stock' | 'out_of_stock') => {
    setStockTab(newTab);
    const targetSizes = newTab === 'in_stock' ? inStockSizes : outOfStockSizes;
    if (targetSizes.length > 0) {
      const firstSize = targetSizes[0];
      setSelectedDimKey(firstSize.dimKey);
      const matchingVariants = productVariants.filter((v) =>
        firstSize.sizeIds.includes(String(v.sizeId))
      );
      if (newTab === 'in_stock') {
        const inStockVar = matchingVariants.find((v) => (stockMap[v.id] || 0) > 0);
        setSelectedThicknessId(String(inStockVar ? inStockVar.thicknessId : (matchingVariants[0]?.thicknessId || '')));
      } else {
        const outStockVar = matchingVariants.find((v) => (stockMap[v.id] || 0) === 0);
        setSelectedThicknessId(String(outStockVar ? outStockVar.thicknessId : (matchingVariants[0]?.thicknessId || '')));
      }
    }
  };

  // Handle Size change
  const handleSelectSize = (dimKey: string) => {
    setSelectedDimKey(dimKey);
    const newSize = availableSizes.find((s) => s.dimKey === dimKey);
    if (newSize) {
      const matchingVariants = productVariants.filter((v) =>
        newSize.sizeIds.includes(String(v.sizeId))
      );
      if (stockTab === 'in_stock') {
        const inStockVar = matchingVariants.find((v) => (stockMap[v.id] || 0) > 0);
        const chosenVar = inStockVar || matchingVariants[0];
        if (chosenVar) {
          setSelectedThicknessId(String(chosenVar.thicknessId));
        }
      } else {
        const outStockVar = matchingVariants.find((v) => (stockMap[v.id] || 0) === 0);
        const chosenVar = outStockVar || matchingVariants[0];
        if (chosenVar) {
          setSelectedThicknessId(String(chosenVar.thicknessId));
        }
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
    const posDisplayName = (selectedVariant as any)?.posDisplayName 
      || product.posDisplayName 
      || `${product.name} ${selectedSize?.displayLabel || ''}${selectedThickness?.value ? `x${selectedThickness.value}` : ''}`.trim();

    const cartItem: POSCartItem = {
      variantId,
      productId: product.id,
      productName: product.name,
      posDisplayName,
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

          {/* Stock Filter Tab Bar (In Stock / Out of Stock) */}
          <div className="flex items-center gap-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200 select-none">
            <button
              type="button"
              onClick={() => handleTabChange('in_stock')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stockTab === 'in_stock'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${inStockSizes.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>In Stock</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  stockTab === 'in_stock'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {inStockSizes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('out_of_stock')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stockTab === 'out_of_stock'
                  ? 'bg-white text-rose-700 shadow-xs border border-rose-200 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${outOfStockSizes.length > 0 ? 'bg-rose-500' : 'bg-slate-300'}`} />
              <span>Out of Stock</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  stockTab === 'out_of_stock'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {outOfStockSizes.length}
              </span>
            </button>
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
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-2">
                <p className="text-xs font-semibold text-amber-800">
                  {stockTab === 'in_stock'
                    ? 'No sizes currently in stock for this product at this branch.'
                    : 'No out of stock sizes for this product.'}
                </p>
                {stockTab === 'in_stock' && outOfStockSizes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleTabChange('out_of_stock')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    View Out of Stock Sizes ({outOfStockSizes.length})
                  </button>
                )}
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
                      onClick={() => handleSelectSize(size.dimKey)}
                      className={`py-2 px-1.5 rounded-xl border-2 flex flex-col items-center justify-center transition-all relative cursor-pointer ${
                        isSelected
                          ? hasStock
                            ? 'border-[#1a73e8] bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20'
                            : 'border-slate-500 bg-slate-100 shadow-xs ring-1 ring-slate-400/20'
                          : hasStock
                            ? 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                            : 'border-slate-200/80 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100'
                      }`}
                    >
                      {/* Small rounded stock badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1 leading-none ${
                          hasStock
                            ? isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isSelected
                              ? 'bg-slate-500 text-white'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {sizeStock}
                      </span>

                      <span
                        className={`text-[15px] font-bold mt-0.5 whitespace-nowrap ${
                          hasStock
                            ? isSelected
                              ? 'text-[#1a73e8]'
                              : 'text-slate-900'
                            : isSelected
                              ? 'text-slate-800'
                              : 'text-slate-600'
                        }`}
                      >
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
                      onClick={() => {
                        setSelectedThicknessId(th.id);
                        setQuantity(1);
                      }}
                      className={`h-11 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1 transition-all relative cursor-pointer ${
                        isSelected
                          ? hasStock
                            ? 'border-[#1a73e8] bg-blue-50/40 text-[#1a73e8] shadow-xs ring-1 ring-blue-500/20'
                            : 'border-slate-500 bg-slate-100 text-slate-800 shadow-xs ring-1 ring-slate-400/20'
                          : hasStock
                            ? 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                            : 'border-slate-200/80 hover:border-slate-300 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{th.value}&quot;</span>
                      {/* Small rounded stock badge */}
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                          hasStock
                            ? isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isSelected
                              ? 'bg-slate-500 text-white'
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
