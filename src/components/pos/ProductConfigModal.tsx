'use client';

import React, { useState, useMemo, useCallback } from 'react';
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
import { X, ShoppingCart, Minus, Plus, CheckCircle2, AlertCircle, Package } from 'lucide-react';

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
}: ProductConfigModalProps) {
  // Filter active variants belonging to this product
  const productVariants = useMemo(() => {
    if (!product) return [];
    return variants.filter((v) => v.productId === product.id && v.status === 'ACTIVE');
  }, [product, variants]);

  // Determine available size IDs and thickness IDs for this product
  const availableSizeIds = useMemo(() => {
    return Array.from(new Set(productVariants.map((v) => v.sizeId)));
  }, [productVariants]);

  const availableThicknessIds = useMemo(() => {
    return Array.from(new Set(productVariants.map((v) => v.thicknessId)));
  }, [productVariants]);

  // Available size objects sorted by width/dimensions
  const availableSizes = useMemo(() => {
    return sizes
      .filter((s) => availableSizeIds.includes(s.id))
      .sort((a, b) => (a.width || 0) - (b.width || 0));
  }, [sizes, availableSizeIds]);

  // Available thickness objects sorted
  const availableThicknesses = useMemo(() => {
    return thicknesses
      .filter((t) => availableThicknessIds.includes(t.id))
      .sort((a, b) => (a.value || 0) - (b.value || 0));
  }, [thicknesses, availableThicknessIds]);

  // State for user-chosen selections
  const [chosenSizeId, setChosenSizeId] = useState<string | null>(null);
  const [chosenThicknessId, setChosenThicknessId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // Derived default size & thickness
  const defaultSizeId = useMemo(() => {
    const preferredSize =
      availableSizes.find(
        (s) =>
          (s.displayLabel || s.name || '').toLowerCase().includes('single') ||
          s.width === 36
      ) || availableSizes[0];
    return preferredSize?.id || '';
  }, [availableSizes]);

  const selectedSizeId = chosenSizeId && availableSizeIds.includes(chosenSizeId) ? chosenSizeId : defaultSizeId;

  const defaultThicknessId = useMemo(() => {
    const matchingVariants = productVariants.filter((v) => v.sizeId === selectedSizeId);
    const preferredThickness =
      availableThicknesses.find(
        (t) =>
          (t.value === 6 || t.thicknessInches === 6) &&
          matchingVariants.some((v) => v.thicknessId === t.id)
      ) ||
      availableThicknesses.find((t) => matchingVariants.some((v) => v.thicknessId === t.id)) ||
      availableThicknesses[0];
    return preferredThickness?.id || '';
  }, [productVariants, selectedSizeId, availableThicknesses]);

  const selectedThicknessId =
    chosenThicknessId && availableThicknessIds.includes(chosenThicknessId)
      ? chosenThicknessId
      : defaultThicknessId;

  // Find exact matching variant
  const selectedVariant = useMemo(() => {
    return productVariants.find(
      (v) => v.sizeId === selectedSizeId && v.thicknessId === selectedThicknessId
    );
  }, [productVariants, selectedSizeId, selectedThicknessId]);

  // Compute live available stock for this variant
  const availableStock = useMemo(() => {
    if (!selectedVariant) return 0;
    const balance = inventoryBalances.find((b) => b.variantId === selectedVariant.id);
    const balanceOnHand = balance?.available ?? 0;
    return Math.max(0, balanceOnHand - existingCartQuantity);
  }, [selectedVariant, inventoryBalances, existingCartQuantity]);

  // Multi-tier price resolution based on active saleType
  const getVariantPrice = useCallback(
    (v?: ProductVariant | null) => {
      if (!v) return 0;
      if (saleType === 'WHOLESALE') return v.wholesalePrice || 0;
      if (saleType === 'DISTRIBUTOR') return v.distributorPrice || v.wholesalePrice || 0;
      return v.walkInPrice || v.retailPrice || 0;
    },
    [saleType]
  );

  // Format base starting price
  const basePrice = useMemo(() => {
    if (productVariants.length === 0) return 0;
    const prices = productVariants.map(getVariantPrice).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [productVariants, getVariantPrice]);

  // Dynamic unit price
  const unitPrice = getVariantPrice(selectedVariant) || basePrice;
  const totalPrice = unitPrice * quantity;

  // Selected size & thickness label helpers
  const selectedSizeObj = sizes.find((s) => s.id === selectedSizeId);
  const selectedThicknessObj = thicknesses.find((t) => t.id === selectedThicknessId);

  // Handle Add To Cart
  const handleAdd = () => {
    if (!product || !selectedVariant || quantity <= 0 || availableStock < quantity) return;

    const cartItem: POSCartItem = {
      variantId: selectedVariant.id,
      productId: product.id,
      sku: selectedVariant.sku,
      productName: product.name,
      brandName,
      categoryName,
      sizeLabel: selectedSizeObj?.displayLabel || selectedSizeObj?.name || 'Standard',
      dimensionInches: `${selectedSizeObj?.length || 78}×${selectedSizeObj?.width || 36}`,
      thicknessInches: selectedThicknessObj?.value ?? selectedThicknessObj?.thicknessInches ?? 6,
      unitPrice,
      quantity,
      lineTotal: totalPrice,
      imageUrl: product.imageUrl,
      availableStock,
      saleType,
      walkInPrice: selectedVariant.walkInPrice || selectedVariant.retailPrice,
      wholesalePrice: selectedVariant.wholesalePrice,
      distributorPrice: selectedVariant.distributorPrice,
    };

    onAddToCart(cartItem);
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-800 font-sans tracking-tight">
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

        {/* Product Details Header Row */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
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
                <Package className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-slate-900 font-sans">{product.name}</h4>
              <p className="text-xs text-slate-500 font-sans">
                {product.description || `${brandName} ${categoryName}`}
              </p>
              <p className="text-xs font-semibold text-slate-700 mt-1">
                Base Price:{' '}
                <span className="font-bold text-blue-900">
                  Rs. {basePrice.toLocaleString()}
                </span>
              </p>
            </div>
          </div>

          {/* Select Size */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 font-sans">
              Select Size
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {availableSizes.map((size) => {
                const isSelected = selectedSizeId === size.id;
                // Quick alias to display Single, Single XL, Double, Queen, King
                let displayName = size.displayLabel || size.name || 'Standard';
                if (displayName.includes('(')) {
                  displayName = displayName.split('(')[1].replace(')', '').trim();
                }

                return (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => {
                      setChosenSizeId(size.id);
                      // If current thickness is invalid for this size, auto-pick first valid
                      const matchingVariants = productVariants.filter((v) => v.sizeId === size.id);
                      if (!matchingVariants.some((v) => v.thicknessId === selectedThicknessId)) {
                        const firstValid = matchingVariants[0];
                        if (firstValid) setChosenThicknessId(firstValid.thicknessId);
                      }
                    }}
                    className={`py-2 px-1.5 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold ${
                        isSelected ? 'text-blue-900' : 'text-slate-800'
                      }`}
                    >
                      {displayName}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {size.dimensionsFormatted || `${size.width || 36}" × ${size.length || 78}"`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Select Thickness (Depth) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 font-sans">
              Select Thickness (Depth)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {availableThicknesses.map((th) => {
                const isSelected = selectedThicknessId === th.id;
                const isCompatible = productVariants.some(
                  (v) => v.sizeId === selectedSizeId && v.thicknessId === th.id
                );

                return (
                  <button
                    key={th.id}
                    type="button"
                    disabled={!isCompatible}
                    onClick={() => setChosenThicknessId(th.id)}
                    className={`h-10 rounded-xl border-2 font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 text-blue-900 shadow-xs'
                        : isCompatible
                        ? 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <span>{th.value ?? th.thicknessInches}&quot;</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SKU & Live Stock Notice */}
          <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
            <span className="text-slate-500 font-mono text-[11px]">
              SKU: <strong className="text-slate-800">{selectedVariant?.sku || 'N/A'}</strong>
            </span>
            <div>
              {availableStock > 0 ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  In Stock ({availableStock} available)
                </span>
              ) : (
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Out of Stock
                </span>
              )}
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
                disabled={quantity <= 1}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={1}
                max={availableStock}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setQuantity(Math.min(availableStock, Math.max(1, val)));
                }}
                className="w-10 text-center font-bold text-xs text-slate-800 border-none focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                disabled={quantity >= availableStock}
                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Price & Add To Cart Button */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {saleType === 'WHOLESALE' ? 'Wholesale' : saleType === 'DISTRIBUTOR' ? 'Distributor' : 'Walk-in'}
                </span>
                <span className="text-xs text-slate-500 font-medium">Price: </span>
              </div>
              <span className="text-base font-extrabold text-emerald-700 font-sans">
                Rs. {totalPrice.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedVariant || availableStock < quantity || quantity <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Add to Cart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
