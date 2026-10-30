'use client';

import React, { useState, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import {
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetSizesQuery,
  useGetThicknessQuery,
} from '@/store/services/apiSlice';
import {
  productsRepository,
  variantsRepository,
  priceListsRepository,
} from '@/lib/demo-db';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  Package,
  Maximize2,
  Sliders,
  DollarSign,
  Info,
  ArrowLeft,
  Save,
  Tag,
  CircleDot,
  Circle,
  Eye,
} from 'lucide-react';

// Helper functions for safe display labels
const getSizeLabel = (s?: { displayLabel?: string; name?: string; length?: number; width?: number; id?: string } | null): string => {
  if (!s) return '—';
  if (s.displayLabel) return s.displayLabel;
  if (s.name) return s.name;
  if (s.length && s.width) return `${s.length} × ${s.width}`;
  return s.id || '—';
};

const getThicknessLabel = (t?: { displayLabel?: string; value?: number; id?: string } | null): string => {
  if (!t) return '—';
  if (t.displayLabel) return t.displayLabel;
  if (t.value) return `${t.value} Inches`;
  return t.id || '—';
};

function NewProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSku = searchParams?.get('edit');

  // Queries
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: sizes = [] } = useGetSizesQuery();
  const { data: thicknesses = [] } = useGetThicknessQuery();

  // If in edit mode, lookup existing entity
  const editingVariant = useMemo(() => {
    if (!editSku) return null;
    return variantsRepository.getBySku(editSku) || null;
  }, [editSku]);

  const editingProduct = useMemo(() => {
    if (!editingVariant) return null;
    return productsRepository.getById(editingVariant.productId) || null;
  }, [editingVariant]);

  // Selected Step Overrides
  const [selectedBrandIdOverride, setSelectedBrandId] = useState<string>(() => editingProduct?.brandId || '');
  const [selectedCategoryIdOverride, setSelectedCategoryId] = useState<string>(() => editingProduct?.categoryId || '');
  const [selectedSizeIdOverride, setSelectedSizeId] = useState<string>(() => editingVariant?.sizeId || '');
  const [selectedThicknessIdOverride, setSelectedThicknessId] = useState<string>(() => editingVariant?.thicknessId || '');

  // Derived Brand
  const selectedBrandId = useMemo(() => {
    if (selectedBrandIdOverride) return selectedBrandIdOverride;
    if (editingProduct?.brandId) return editingProduct.brandId;
    if (brands.length === 0) return '';
    const molty = brands.find((b) => b.name.toLowerCase().includes('molty')) || brands[0];
    return molty?.id || '';
  }, [brands, selectedBrandIdOverride, editingProduct]);

  // Categories filtered by selected brand
  const filteredCategories = useMemo(() => {
    if (!selectedBrandId) return [];
    return categories.filter((c) => c.brandId === selectedBrandId);
  }, [categories, selectedBrandId]);

  // Derived Category
  const selectedCategoryId = useMemo(() => {
    if (selectedCategoryIdOverride && filteredCategories.some((c) => c.id === selectedCategoryIdOverride)) {
      return selectedCategoryIdOverride;
    }
    if (editingProduct?.categoryId && filteredCategories.some((c) => c.id === editingProduct.categoryId)) {
      return editingProduct.categoryId;
    }
    return filteredCategories.length > 0 ? filteredCategories[0].id : '';
  }, [filteredCategories, selectedCategoryIdOverride, editingProduct]);

  // Derived Size
  const selectedSizeId = useMemo(() => {
    if (selectedSizeIdOverride) return selectedSizeIdOverride;
    if (editingVariant?.sizeId) return editingVariant.sizeId;
    if (sizes.length === 0) return '';
    const defaultSize = sizes.find((s) => (s.displayLabel || s.name || '').includes('78')) || sizes[0];
    return defaultSize?.id || '';
  }, [sizes, selectedSizeIdOverride, editingVariant]);

  // Derived Thickness
  const selectedThicknessId = useMemo(() => {
    if (selectedThicknessIdOverride) return selectedThicknessIdOverride;
    if (editingVariant?.thicknessId) return editingVariant.thicknessId;
    if (thicknesses.length === 0) return '';
    const defaultThick =
      thicknesses.find((t) => t.value === 5 || (t.displayLabel && t.displayLabel.includes('5'))) ||
      thicknesses[0];
    return defaultThick?.id || '';
  }, [thicknesses, selectedThicknessIdOverride, editingVariant]);

  // Entities
  const selectedBrand = useMemo(() => brands.find((b) => b.id === selectedBrandId), [brands, selectedBrandId]);
  const selectedCategory = useMemo(() => categories.find((c) => c.id === selectedCategoryId), [categories, selectedCategoryId]);
  const selectedSize = useMemo(() => sizes.find((s) => s.id === selectedSizeId), [sizes, selectedSizeId]);
  const selectedThickness = useMemo(() => thicknesses.find((t) => t.id === selectedThicknessId), [thicknesses, selectedThicknessId]);

  // Auto Generated Product Name
  const autoProductName = useMemo(() => {
    const brandName = selectedBrand?.name || 'Brand';
    const catName = selectedCategory?.name || 'Category';
    return `${brandName} - ${catName}`;
  }, [selectedBrand, selectedCategory]);

  // Pricing & Stock State with Bidirectional Calculations
  const [listPrice, setListPrice] = useState<number>(() => {
    if (editingVariant) return Math.round(editingVariant.retailPrice / 1.02);
    return 18000;
  });
  const [purchasePct, setPurchasePct] = useState<number>(15);
  const [purchasePrice, setPurchasePrice] = useState<number>(() => {
    if (editingVariant) return Math.round(editingVariant.wholesalePrice * 0.95);
    return 15300;
  });
  const [retailPct, setRetailPct] = useState<number>(20);
  const [retailPrice, setRetailPrice] = useState<number>(() => {
    if (editingVariant) return editingVariant.retailPrice;
    return 18360;
  });
  const [wholesalePct, setWholesalePct] = useState<number>(10);
  const [wholesalePrice, setWholesalePrice] = useState<number>(() => {
    if (editingVariant) return editingVariant.wholesalePrice;
    return 16200;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Bidirectional Pricing Handlers
  const handleListPriceChange = (value: number) => {
    const lp = Math.max(0, value);
    setListPrice(lp);
    // Recalculate purchase price from discount %
    const newPurPrice = Math.round(lp * (1 - purchasePct / 100));
    setPurchasePrice(newPurPrice);
    // Recalculate retail price (markup on purchase price)
    setRetailPrice(Math.round(newPurPrice * (1 + retailPct / 100)));
    // Recalculate wholesale price (discount from list price)
    setWholesalePrice(Math.round(lp * (1 - wholesalePct / 100)));
  };

  const handlePurchasePctChange = (pct: number) => {
    setPurchasePct(pct);
    const newPurPrice = Math.round(listPrice * (1 - pct / 100));
    setPurchasePrice(newPurPrice);
    setRetailPrice(Math.round(newPurPrice * (1 + retailPct / 100)));
  };

  const handlePurchasePriceChange = (val: number) => {
    const pp = Math.max(0, val);
    setPurchasePrice(pp);
    if (listPrice > 0) {
      setPurchasePct(Math.round(((listPrice - pp) / listPrice) * 100));
    }
    setRetailPrice(Math.round(pp * (1 + retailPct / 100)));
  };

  const handleRetailPctChange = (pct: number) => {
    setRetailPct(pct);
    setRetailPrice(Math.round(purchasePrice * (1 + pct / 100)));
  };

  const handleRetailPriceChange = (val: number) => {
    const rp = Math.max(0, val);
    setRetailPrice(rp);
    if (purchasePrice > 0) {
      setRetailPct(Math.round(((rp - purchasePrice) / purchasePrice) * 100));
    }
  };

  const handleWholesalePctChange = (pct: number) => {
    setWholesalePct(pct);
    setWholesalePrice(Math.round(listPrice * (1 - pct / 100)));
  };

  const handleWholesalePriceChange = (val: number) => {
    const wp = Math.max(0, val);
    setWholesalePrice(wp);
    if (listPrice > 0) {
      setWholesalePct(Math.round(((listPrice - wp) / listPrice) * 100));
    }
  };

  const toastCounter = useRef(0);
  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, message?: string) => {
    toastCounter.current += 1;
    setToast({
      id: `toast-${toastCounter.current}`,
      type,
      title,
      message,
    });
  }, []);

  // Form Submission
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrandId || !selectedCategoryId || !selectedSizeId || !selectedThicknessId) {
      showToast('error', 'Missing Information', 'Please select brand, category, size and thickness.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Check or create parent product
      let product = productsRepository.getAll().find(
        (p) => p.brandId === selectedBrandId && p.categoryId === selectedCategoryId
      );

      if (!product) {
        const brandCode = selectedBrand?.code || 'MF';
        const catCode = selectedCategory?.name.substring(0, 2).toUpperCase() || 'UL';
        product = productsRepository.create({
          name: autoProductName,
          code: `${brandCode}-${catCode}`,
          brandId: selectedBrandId,
          categoryId: selectedCategoryId,
          description: `${autoProductName} high density foam mattress`,
          status: 'active',
        });
      }

      // 2. Generate clean SKU (e.g., MF-UL-78X78-5)
      const brandCode = (selectedBrand?.code || 'MF').toUpperCase();
      const catPart = (selectedCategory?.name || 'UL').replace(/[^A-Za-z0-9]/g, '').substring(0, 2).toUpperCase();
      const sizeClean = selectedSize
        ? (selectedSize.length && selectedSize.width
            ? `${selectedSize.length}X${selectedSize.width}`
            : (selectedSize.displayLabel || selectedSize.name || '78x78').split('(')[0].replace(/[^0-9xX]/g, '').toUpperCase())
        : '78X78';
      const thickClean = (selectedThickness?.value?.toString() || selectedThickness?.displayLabel || '5').replace(/[^0-9]/g, '');
      const baseSku = `${brandCode}-${catPart}-${sizeClean}-${thickClean}`;

      // Check if variant already exists
      let existingVariant = variantsRepository.getBySku(baseSku);
      if (!existingVariant) {
        const found = variantsRepository.getAll().find(
          (v) => v.productId === product!.id && v.sizeId === selectedSizeId && v.thicknessId === selectedThicknessId
        );
        if (found) existingVariant = found;
      }

      let variantId = existingVariant?.id;

      if (existingVariant) {
        // Update price
        variantsRepository.update(existingVariant.id, {
          retailPrice,
          wholesalePrice,
        });
      } else {
        const createdVariant = variantsRepository.create({
          productId: product.id,
          sizeId: selectedSizeId,
          thicknessId: selectedThicknessId,
          sku: baseSku,
          retailPrice,
          wholesalePrice,
          status: 'ACTIVE',
        });
        variantId = createdVariant.id;
      }

      // 3. Set Price Lists
      if (variantId) {
        priceListsRepository.setPrice('WALK_IN', variantId, retailPrice);
        priceListsRepository.setPrice('WHOLESALE', variantId, wholesalePrice);
        // Distributor price standard 5% below wholesale or 5% above purchase
        const distributorPrice = Math.round(wholesalePrice * 0.95);
        priceListsRepository.setPrice('DISTRIBUTOR', variantId, distributorPrice);
      }

      showToast('success', editingVariant ? 'Product Updated' : 'Product Saved', `${autoProductName} (${baseSku}) has been ${editingVariant ? 'updated' : 'created'} successfully.`);
      setTimeout(() => {
        router.push('/products');
      }, 900);
    } catch (err: unknown) {
      showToast('error', editingVariant ? 'Error Updating Product' : 'Error Saving Product', (err as Error)?.message || 'Could not save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-600 transition-colors cursor-pointer"
            title="Back to Products"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-sans">
              {editingVariant ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p className="text-xs text-gray-500 font-sans">
              {editingVariant
                ? `Modify specifications, pricing and stock for SKU ${editingVariant.sku}`
                : 'Create a new mattress product and variant with pricing and initial stock'}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout matching User Screenshots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
        {/* Left Column: Product Details Form (Screenshot 1) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs space-y-6">
          {/* Card Header */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
            <span className="p-1.5 bg-blue-50 text-brand-blue rounded-lg">
              <Package className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">
              Product Details
            </h2>
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-6">
            {/* Step 1: Brand */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="text-sm font-bold text-gray-900">Brand</span>
              </div>
              <div className="pl-8">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Select Brand <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer appearance-none pr-10"
                  >
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Category */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-gray-900">Category</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Based on selected brand)
                  </span>
                </div>
              </div>
              <div className="pl-8">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Select Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer appearance-none pr-10"
                  >
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No categories for this brand</option>
                    )}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Size (Radio Pill Cards) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-gray-900">Size</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Based on selected category)
                  </span>
                </div>
              </div>
              <div className="pl-8">
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Select Size <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {sizes.map((s) => {
                    const isSelected = selectedSizeId === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSizeId(s.id)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/70 border-brand-blue text-blue-900 ring-1 ring-blue-500/30'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {isSelected ? (
                          <CircleDot className="w-4 h-4 text-brand-blue shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                        )}
                        <span>{getSizeLabel(s)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 4: Thickness (Radio Pill Cards) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-gray-900">Thickness</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Based on selected size)
                  </span>
                </div>
              </div>
              <div className="pl-8">
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Select Thickness <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {thicknesses.map((t) => {
                    const isSelected = selectedThicknessId === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedThicknessId(t.id)}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/70 border-brand-blue text-blue-900 ring-1 ring-blue-500/30'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {isSelected ? (
                          <CircleDot className="w-4 h-4 text-brand-blue shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                        )}
                        <span>{getThicknessLabel(t)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Auto Product Name Banner & Readonly Input */}
            <div className="pl-8 space-y-3">
              <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-center gap-2.5 text-xs text-blue-900 font-medium">
                <Info className="w-4 h-4 text-brand-blue shrink-0" />
                <span>Product Name will be set automatically based on Brand and Category.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  readOnly
                  value={autoProductName}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 select-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                Pricing
              </h3>

              {/* Row 1: List Price, Purchase % OR Purchase Price */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    List Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                    <span className="px-3 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-r border-gray-200 flex items-center">
                      Rs
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={listPrice}
                      onChange={(e) => handleListPriceChange(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Purchase %
                  </label>
                  <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={purchasePct}
                      onChange={(e) => handlePurchasePctChange(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                    />
                    <span className="px-3 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-l border-gray-200 flex items-center">
                      %
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-1 flex items-center justify-center pb-2 text-[11px] font-bold text-gray-400">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">OR</span>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Purchase Price
                  </label>
                  <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                    <span className="px-3 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-r border-gray-200 flex items-center">
                      Rs
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={purchasePrice}
                      onChange={(e) => handlePurchasePriceChange(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Retail % / Retail Price, Wholesale % / Wholesale Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Retail Group */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Retail %
                    </label>
                    <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                      <input
                        type="number"
                        min="0"
                        value={retailPct}
                        onChange={(e) => handleRetailPctChange(Number(e.target.value))}
                        className="w-full px-2.5 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                      />
                      <span className="px-2.5 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-l border-gray-200 flex items-center">
                        %
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Retail Price
                    </label>
                    <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                      <span className="px-2 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-r border-gray-200 flex items-center">
                        Rs
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={retailPrice}
                        onChange={(e) => handleRetailPriceChange(Number(e.target.value))}
                        className="w-full px-2.5 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Wholesale Group */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Wholesale %
                    </label>
                    <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                      <input
                        type="number"
                        min="0"
                        value={wholesalePct}
                        onChange={(e) => handleWholesalePctChange(Number(e.target.value))}
                        className="w-full px-2.5 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                      />
                      <span className="px-2.5 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-l border-gray-200 flex items-center">
                        %
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Wholesale Price
                    </label>
                    <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                      <span className="px-2 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-r border-gray-200 flex items-center">
                        Rs
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={wholesalePrice}
                        onChange={(e) => handleWholesalePriceChange(Number(e.target.value))}
                        className="w-full px-2.5 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <Link
                href="/products"
                className="px-5 py-2.5 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-blue hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{editingVariant ? 'Updating Product...' : 'Saving Product...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingVariant ? 'Update Product' : 'Save Product'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Sticky Product Preview (Screenshot 2) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Eye className="w-4 h-4 text-brand-blue" />
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                Product Preview
              </h3>
            </div>

            {/* Mattress Vector Card */}
            <div className="bg-blue-50/60 border border-blue-100/70 rounded-2xl p-6 flex items-center justify-center">
              <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-40 h-24">
                {/* Isometric Mattress Top */}
                <path
                  d="M40 25 L120 25 C132 25 142 32 142 40 L122 70 C120 74 114 77 106 77 L26 77 C16 77 8 72 8 64 L26 34 C28 29 33 25 40 25 Z"
                  fill="#FFFFFF"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {/* Mattress Bottom/Border Depth */}
                <path
                  d="M8 64 L8 73 C8 81 16 86 26 86 L106 86 C114 86 120 83 122 79 L142 49 L142 40"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path d="M26 77 L26 86" stroke="#3B82F6" strokeWidth="2.5" />
                <path d="M122 70 L122 79" stroke="#3B82F6" strokeWidth="2.5" />
                {/* Quilted Tuft Dots */}
                <circle cx="50" cy="42" r="2.2" fill="#3B82F6" />
                <circle cx="80" cy="42" r="2.2" fill="#3B82F6" />
                <circle cx="110" cy="42" r="2.2" fill="#3B82F6" />
                <circle cx="40" cy="56" r="2.2" fill="#3B82F6" />
                <circle cx="70" cy="56" r="2.2" fill="#3B82F6" />
                <circle cx="100" cy="56" r="2.2" fill="#3B82F6" />
              </svg>
            </div>

            {/* Product Title and Type Pill */}
            <div>
              <h4 className="text-base font-bold text-gray-900 tracking-tight leading-snug">
                {autoProductName}
              </h4>
              <div className="mt-1.5">
                <span className="inline-block px-2.5 py-0.5 bg-blue-50 border border-blue-100 text-brand-blue rounded-full text-xs font-semibold">
                  Mattress
                </span>
              </div>
            </div>

            {/* Specification Breakdown */}
            <div className="space-y-2.5 text-xs border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-gray-400" />
                  <span>Brand</span>
                </span>
                <span className="font-bold text-gray-800">
                  {selectedBrand?.name || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  <span>Category</span>
                </span>
                <span className="font-bold text-gray-800">
                  {selectedCategory?.name || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-2">
                  <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>Size</span>
                </span>
                <span className="font-bold text-gray-800">
                  {getSizeLabel(selectedSize)}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-gray-400" />
                  <span>Thickness</span>
                </span>
                <span className="font-bold text-gray-800">
                  {getThicknessLabel(selectedThickness)}
                </span>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="space-y-2.5 text-xs border-t border-gray-100 pt-3">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 mb-2">
                <DollarSign className="w-3.5 h-3.5 text-brand-blue" />
                <span>Pricing</span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>List Price</span>
                <span className="font-bold text-gray-900 font-mono">
                  Rs {listPrice.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Purchase Price</span>
                <span className="font-bold text-gray-800 font-mono">
                  Rs {purchasePrice.toLocaleString()} <span className="font-normal text-gray-500">({purchasePct}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Retail Price</span>
                <span className="font-bold text-gray-800 font-mono">
                  Rs {retailPrice.toLocaleString()} <span className="font-normal text-gray-500">({retailPct}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Wholesale Price</span>
                <span className="font-bold text-gray-800 font-mono">
                  Rs {wholesalePrice.toLocaleString()} <span className="font-normal text-gray-500">({wholesalePct}%)</span>
                </span>
              </div>
            </div>

            {/* Stock Info Note */}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Info className="w-3.5 h-3.5 text-brand-blue shrink-0" />
              <span>Branch stocks are assigned via <strong>Manage Stock</strong>.</span>
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Loading Product Form...</div>}>
      <NewProductContent />
    </Suspense>
  );
}
