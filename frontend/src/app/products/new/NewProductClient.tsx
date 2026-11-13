'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import {
  useGetBrandsQuery as useGetDemoBrandsQuery,
  useGetCategoriesQuery as useGetDemoCategoriesQuery,
  useGetSizesQuery as useGetDemoSizesQuery,
  useGetThicknessQuery as useGetDemoThicknessQuery,
} from '@/store/services/apiSlice';
import {
  useGetBrandsQuery as useGetBackendBrandsQuery,
  useGetCategoriesQuery as useGetBackendCategoriesQuery,
  useGetProductLinesQuery as useGetBackendProductLinesQuery,
  useGetSizesQuery as useGetBackendSizesQuery,
  useGetThicknessesQuery as useGetBackendThicknessesQuery,
  useGetBranchesQuery,
  useCreateProductWithVariantMutation,
  useGetSkuByIdQuery,
  useUpdateSkuPricesMutation,
  useUpdateSkuMutation,
} from '@/store/services/catalogueApi';
import { useAppSelector } from '@/store';
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

interface ProductLineOption {
  id: string;
  brandId: string;
  categoryId: string;
  name: string;
  code: string;
}

function NewProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSku = searchParams?.get('edit');

  // Queries - Production MongoDB Backend Primary with Demo DB Fallback
  const { data: backendBrands } = useGetBackendBrandsQuery();
  const { data: demoBrands = [] } = useGetDemoBrandsQuery();
  const brands = useMemo(() => {
    if (backendBrands && backendBrands.length > 0) return backendBrands;
    return demoBrands;
  }, [backendBrands, demoBrands]);

  const { data: backendCategories } = useGetBackendCategoriesQuery();
  const { data: demoCategories = [] } = useGetDemoCategoriesQuery();
  const categories = useMemo(() => {
    if (backendCategories && backendCategories.length > 0) return backendCategories;
    return demoCategories;
  }, [backendCategories, demoCategories]);

  const { data: backendProductLines = [] } = useGetBackendProductLinesQuery();
  const productLines: ProductLineOption[] = useMemo(() => {
    return (Array.isArray(backendProductLines) ? backendProductLines : (backendProductLines as any)?.data || []).map((pl: any) => ({
      id: String(pl.id || pl._id || ''),
      brandId: String(pl.brandId?._id || pl.brandId || ''),
      categoryId: String(pl.categoryId?._id || pl.categoryId || ''),
      name: pl.name || '',
      code: pl.code || '',
    }));
  }, [backendProductLines]);

  const { data: backendSizes } = useGetBackendSizesQuery();
  const { data: demoSizes = [] } = useGetDemoSizesQuery();
  const sizes = useMemo(() => {
    if (backendSizes && backendSizes.length > 0) return backendSizes;
    return demoSizes;
  }, [backendSizes, demoSizes]);

  const { data: backendThicknesses } = useGetBackendThicknessesQuery();
  const { data: demoThicknesses = [] } = useGetDemoThicknessQuery();
  const thicknesses = useMemo(() => {
    if (backendThicknesses && backendThicknesses.length > 0) return backendThicknesses;
    return demoThicknesses;
  }, [backendThicknesses, demoThicknesses]);

  const isEditMode = Boolean(editSku);
  const { data: skuResponse, isLoading: isLoadingSku } = useGetSkuByIdQuery(editSku || '', {
    skip: !editSku,
  });
  const backendSku = skuResponse?.data;

  const [createProductWithVariant] = useCreateProductWithVariantMutation();
  const [updateSkuPrices] = useUpdateSkuPricesMutation();
  const [updateSku] = useUpdateSkuMutation();

  // If in edit mode, lookup existing entity (Production backend primary, demo fallback)
  const editingVariant = useMemo(() => {
    if (!editSku) return null;
    if (backendSku) return backendSku;
    return variantsRepository.getBySku(editSku) || null;
  }, [editSku, backendSku]);

  const editingProduct = useMemo(() => {
    if (!editingVariant) return null;
    if ((editingVariant as any).product) return (editingVariant as any).product;
    return productsRepository.getById((editingVariant as any).productId) || null;
  }, [editingVariant]);

  // Selected Step Overrides
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const { data: branches = [] } = useGetBranchesQuery();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentUser?.assignedBranchId || currentUser?.branchId || ''
  );
  const [selectedBrandIdOverride, setSelectedBrandId] = useState<string>('');
  const [selectedCategoryIdOverride, setSelectedCategoryId] = useState<string>('');
  const [selectedProductLineIdOverride, setSelectedProductLineId] = useState<string>('');
  const [selectedSizeIdOverride, setSelectedSizeId] = useState<string>('');
  const [selectedThicknessIdOverride, setSelectedThicknessId] = useState<string>('');

  // Pricing & Stock State with Bidirectional Calculations
  const [listPrice, setListPrice] = useState<number>(18000);
  const [purchasePct, setPurchasePct] = useState<number>(15);
  const [purchasePrice, setPurchasePrice] = useState<number>(15300);
  const [retailPct, setRetailPct] = useState<number>(20);
  const [retailPrice, setRetailPrice] = useState<number>(18360);
  const [wholesalePct, setWholesalePct] = useState<number>(10);
  const [wholesalePrice, setWholesalePrice] = useState<number>(16200);
  const [distributorPct, setDistributorPct] = useState<number>(15);
  const [distributorPrice, setDistributorPrice] = useState<number>(15300);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [minStockQty, setMinStockQty] = useState<number>(5);
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

  // Product Lines filtered by selected brand & category
  const filteredProductLines = useMemo(() => {
    if (!selectedBrandId || !selectedCategoryId) return [];
    return productLines.filter(
      (pl) => pl.brandId === selectedBrandId && pl.categoryId === selectedCategoryId
    );
  }, [productLines, selectedBrandId, selectedCategoryId]);

  // Derived Product Line
  const selectedProductLineId = useMemo(() => {
    if (selectedProductLineIdOverride && filteredProductLines.some((pl) => pl.id === selectedProductLineIdOverride)) {
      return selectedProductLineIdOverride;
    }
    if (editingProduct?.productLineId && filteredProductLines.some((pl) => pl.id === editingProduct.productLineId)) {
      return editingProduct.productLineId;
    }
    return filteredProductLines.length > 0 ? filteredProductLines[0].id : '';
  }, [filteredProductLines, selectedProductLineIdOverride, editingProduct]);

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
  const selectedProductLine = useMemo(() => productLines.find((pl) => pl.id === selectedProductLineId), [productLines, selectedProductLineId]);
  const selectedSize = useMemo(() => sizes.find((s) => s.id === selectedSizeId), [sizes, selectedSizeId]);
  const selectedThickness = useMemo(() => thicknesses.find((t) => t.id === selectedThicknessId), [thicknesses, selectedThicknessId]);

  // Auto Generated Product Name
  const autoProductName = useMemo(() => {
    if (selectedProductLine) return selectedProductLine.name;
    const brandName = selectedBrand?.name || 'Brand';
    const catName = selectedCategory?.name || 'Category';
    return `${brandName} - ${catName}`;
  }, [selectedProductLine, selectedBrand, selectedCategory]);

  // Sync state whenever backendSku or editingVariant is retrieved
  useEffect(() => {
    if (backendSku) {
      const bId =
        (backendSku.product as any)?.brandId?._id ||
        backendSku.product?.brandId ||
        (backendSku.product as any)?.brand?._id ||
        (backendSku.product as any)?.brand?.id;
      const cId =
        (backendSku.product as any)?.categoryId?._id ||
        backendSku.product?.categoryId ||
        (backendSku.product as any)?.category?._id ||
        (backendSku.product as any)?.category?.id;
      const sId =
        (backendSku.size as any)?._id ||
        (backendSku.size as any)?.id ||
        backendSku.sizeId;
      const tId =
        (backendSku.thickness as any)?._id ||
        (backendSku.thickness as any)?.id ||
        backendSku.thicknessId;

      if (bId) setSelectedBrandId(String(bId));
      if (cId) setSelectedCategoryId(String(cId));
      if (sId) setSelectedSizeId(String(sId));
      if (tId) setSelectedThicknessId(String(tId));

      if (backendSku.listPrice !== undefined) setListPrice(backendSku.listPrice);
      if (backendSku.purchasePrice !== undefined) setPurchasePrice(backendSku.purchasePrice);
      if (backendSku.purchaseDiscountPercent !== undefined) setPurchasePct(backendSku.purchaseDiscountPercent);
      if (backendSku.retailPrice !== undefined) setRetailPrice(backendSku.retailPrice);
      if (backendSku.retailMarkupPercent !== undefined) setRetailPct(backendSku.retailMarkupPercent);
      if (backendSku.wholesalePrice !== undefined) setWholesalePrice(backendSku.wholesalePrice);
      if (backendSku.wholesaleDiscountPercent !== undefined) setWholesalePct(backendSku.wholesaleDiscountPercent);
      if (backendSku.distributorPrice !== undefined) setDistributorPrice(backendSku.distributorPrice);
      if (backendSku.distributorDiscountPercent !== undefined) setDistributorPct(backendSku.distributorDiscountPercent);
      if (backendSku.stock !== undefined) setInitialStock(backendSku.stock);
      if (backendSku.minimumStock !== undefined) setMinStockQty(backendSku.minimumStock);
    } else if (editingVariant && !backendSku) {
      const demoProd = productsRepository.getById((editingVariant as any).productId);
      if (demoProd) {
        setSelectedBrandId(demoProd.brandId);
        setSelectedCategoryId(demoProd.categoryId);
      }
      if (editingVariant.sizeId) setSelectedSizeId(editingVariant.sizeId);
      if (editingVariant.thicknessId) setSelectedThicknessId(editingVariant.thicknessId);
      if (editingVariant.retailPrice) setRetailPrice(editingVariant.retailPrice);
      if (editingVariant.wholesalePrice) setWholesalePrice(editingVariant.wholesalePrice);
    }
  }, [backendSku, editingVariant]);

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
    // Recalculate distributor price
    setDistributorPrice(Math.round(lp * (1 - distributorPct / 100)));
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

  const handleDistributorPctChange = (pct: number) => {
    setDistributorPct(pct);
    setDistributorPrice(Math.round(listPrice * (1 - pct / 100)));
  };

  const handleDistributorPriceChange = (val: number) => {
    const dp = Math.max(0, val);
    setDistributorPrice(dp);
    if (listPrice > 0) {
      setDistributorPct(Math.round(((listPrice - dp) / listPrice) * 100));
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

    // 1. EDIT MODE WORKFLOW
    if (isEditMode) {
      setIsSubmitting(true);
      try {
        let isBackendSaved = false;
        try {
          const skuIdToUpdate = backendSku?.id || (backendSku as any)?._id || editSku;
          const backendRes = await updateSku({
            id: skuIdToUpdate,
            brandId: selectedBrandId,
            categoryId: selectedCategoryId,
            sizeId: selectedSizeId,
            thicknessId: selectedThicknessId,
            listPrice,
            purchasePercent: purchasePct,
            purchasePrice,
            retailPercent: retailPct,
            retailPrice,
            wholesalePercent: wholesalePct,
            wholesalePrice,
            distributorPercent: distributorPct,
            distributorPrice,
            stock: initialStock,
            minimumStock: minStockQty,
            reason: 'Product catalogue edit',
          }).unwrap();

          if (backendRes?.success) {
            isBackendSaved = true;
          }
        } catch (backendErr: unknown) {
          const errObj = backendErr as {
            status?: number | string;
            data?: { error?: { message?: string }; message?: string };
          };
          if (errObj?.status && errObj.status !== 'FETCH_ERROR') {
            const errDetail =
              errObj.data?.error?.message ||
              errObj.data?.message ||
              'Server rejected product update';
            showToast('error', 'Backend Update Error', errDetail);
            setIsSubmitting(false);
            return;
          }
        }

        if (isBackendSaved) {
          // Best effort sync demo-db cache without throwing
          try {
            if (editSku) {
              const demoVar = variantsRepository.getBySku(editSku);
              if (demoVar) {
                variantsRepository.update(demoVar.id, {
                  retailPrice,
                  wholesalePrice,
                  sizeId: selectedSizeId,
                  thicknessId: selectedThicknessId,
                } as any);
                if ((demoVar as any).productId) {
                  productsRepository.update((demoVar as any).productId, {
                    brandId: selectedBrandId,
                    categoryId: selectedCategoryId,
                    name: autoProductName,
                  });
                }
              }
            }
          } catch {
            // Ignore demo repository cache sync
          }

          showToast(
            'success',
            'Product Updated Successfully',
            `Product details, specifications, prices, and stock have been updated.`
          );
          setTimeout(() => {
            router.push('/products');
          }, 1000);
          return;
        }

        // Offline demo-db fallback
        if (editingVariant && !isBackendSaved) {
          try {
            variantsRepository.update(editingVariant.id, {
              retailPrice,
              wholesalePrice,
              sizeId: selectedSizeId,
              thicknessId: selectedThicknessId,
            } as any);
            if ((editingVariant as any).productId) {
              productsRepository.update((editingVariant as any).productId, {
                brandId: selectedBrandId,
                categoryId: selectedCategoryId,
                name: autoProductName,
              });
            }
          } catch {
            // Ignore
          }
        }

        showToast(
          'success',
          'Product Updated Successfully',
          `Product details, specifications, prices, and stock have been updated.`
        );
        setTimeout(() => {
          router.push('/products');
        }, 1000);
      } catch (err: unknown) {
        const error = err as Error;
        showToast('error', 'Update Failed', error.message || 'Could not update product.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. CREATE NEW PRODUCT WORKFLOW
    if (!selectedBranchId) {
      showToast('error', 'Branch Required', 'Please select a destination branch. Every product must belong to a branch.');
      return;
    }
    if (!selectedBrandId || !selectedCategoryId || !selectedSizeId || !selectedThicknessId) {
      showToast('error', 'Missing Information', 'Please select brand, category, size and thickness.');
      return;
    }
    if (!listPrice || listPrice <= 0) {
      showToast('error', 'Invalid Price', 'List Price must be greater than zero.');
      return;
    }
    if (!retailPrice || retailPrice <= 0) {
      showToast('error', 'Invalid Price', 'Retail Price must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      let createdVariantSku = '';
      let isBackendSaved = false;

      // 1. Attempt production backend creation first if connected
      try {
        const backendRes = await createProductWithVariant({
          brandId: selectedBrandId,
          categoryId: selectedCategoryId,
          productLineId: selectedProductLineId || undefined,
          sizeId: selectedSizeId,
          thicknessId: selectedThicknessId,
          destinationBranchId: selectedBranchId || undefined,
          targetBranchId: selectedBranchId || undefined,
          listPrice,
          purchasePercent: purchasePct,
          purchasePrice,
          retailPercent: retailPct,
          retailPrice,
          wholesalePercent: wholesalePct,
          wholesalePrice,
          distributorPercent: distributorPct,
          distributorPrice,
          stock: initialStock,
          minimumStock: minStockQty,
        }).unwrap();

        if (backendRes?.success && backendRes.data?.variant) {
          isBackendSaved = true;
          createdVariantSku = backendRes.data.variant.sku;
        }
      } catch (backendErr: unknown) {
        const errObj = backendErr as {
          status?: number | string;
          data?: { error?: { message?: string }; message?: string };
        };
        // If HTTP error response returned from backend (e.g. 409 conflict or 400 validation)
        if (errObj?.status && errObj.status !== 'FETCH_ERROR') {
          const errDetail =
            errObj.data?.error?.message ||
            errObj.data?.message ||
            'Server rejected product creation';
          showToast('error', 'Backend Validation Error', errDetail);
          setIsSubmitting(false);
          return;
        }
        // If FETCH_ERROR (e.g. backend server not running / offline in demo test), proceed with demo fallback
      }

      // If saved in production backend, notify and return immediately
      if (isBackendSaved) {
        try {
          const demoVar = variantsRepository.getBySku(createdVariantSku);
          if (demoVar) {
            variantsRepository.update(demoVar.id, { retailPrice, wholesalePrice });
          }
        } catch {
          // Ignore local demo-db cache errors
        }

        const toastTitle = 'Product Saved Successfully';
        const toastMsg = `${autoProductName} (${createdVariantSku}) saved to catalogue with ${initialStock} opening stock.`;

        showToast('success', toastTitle, toastMsg);
        setTimeout(() => {
          router.push('/products');
        }, 1000);
        return;
      }

      // 2. Sync to demo-db for local client demo persistence
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

      // 3. Generate clean SKU (e.g., MF-UL-78X78-5)
      const brandCode = (selectedBrand?.code || 'MF').toUpperCase();
      const catPart = (selectedCategory?.name || 'UL').replace(/[^A-Za-z0-9]/g, '').substring(0, 2).toUpperCase();
      const sizeClean = selectedSize
        ? (selectedSize.length && selectedSize.width
          ? `${selectedSize.length}X${selectedSize.width}`
          : (selectedSize.displayLabel || selectedSize.name || '78x78').split('(')[0].replace(/[^0-9xX]/g, '').toUpperCase())
        : '78X78';
      const thickClean = (selectedThickness?.value?.toString() || selectedThickness?.displayLabel || '5').replace(/[^0-9]/g, '');
      const baseSku = createdVariantSku || `${brandCode}-${catPart}-${sizeClean}-${thickClean}`;

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

      // 4. Set Price Lists
      if (variantId) {
        priceListsRepository.setPrice('WALK_IN', variantId, retailPrice);
        priceListsRepository.setPrice('WHOLESALE', variantId, wholesalePrice);
        // Distributor price standard 5% below wholesale or 5% above purchase
        const distributorPrice = Math.round(wholesalePrice * 0.95);
        priceListsRepository.setPrice('DISTRIBUTOR', variantId, distributorPrice);
      }

      const toastTitle = 'Product Saved Successfully';
      const toastMsg = `${autoProductName} (${baseSku}) saved to catalogue with ${initialStock} opening stock.`;

      showToast('success', toastTitle, toastMsg);
      setTimeout(() => {
        router.push('/products');
      }, 1000);
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
            {isEditMode && (
              <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 font-medium">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-brand-blue shrink-0" />
                  <span>Editing Product SKU: <strong className="font-mono">{editSku}</strong></span>
                </div>
                <span className="px-2.5 py-0.5 bg-blue-100 text-brand-blue rounded-full font-bold text-[10px] uppercase">
                  Edit Mode
                </span>
              </div>
            )}
            {/* Target Branch Assignment */}
            {branches && branches.length > 0 && !isEditMode && (
              <div className="space-y-2 pb-1 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">Destination Branch</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Branch catalogue and initial opening stock location)
                  </span>
                </div>
                <div>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={currentUser?.role !== 'SUPER_ADMIN' && !!(currentUser?.assignedBranchId || (currentUser as any)?.branchId)}
                    className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select Destination Branch (Required) * --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code || b.shopNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 1: Brand */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                {/* <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span> */}
                <span className="text-sm font-bold text-gray-900">Brand</span>
              </div>
              <div className="">
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
                {/* <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span> */}
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-gray-900">Category</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Based on selected brand)
                  </span>
                </div>
              </div>
              <div className="">
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

            {/* Step 2.5: Product Line (Sub-Category) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-gray-900">Product Line</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Sub-category / Model e.g. Crest, Bravo, Molty)
                  </span>
                </div>
              </div>
              <div className="">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Select Product Line <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedProductLineId}
                    onChange={(e) => setSelectedProductLineId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue cursor-pointer appearance-none pr-10"
                  >
                    {filteredProductLines.length > 0 ? (
                      filteredProductLines.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({pl.code})
                        </option>
                      ))
                    ) : (
                      <option value="">No product lines configured for this category</option>
                    )}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    ▼
                  </div>
                </div>
                {filteredProductLines.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Tip: Configure product lines in{' '}
                    <Link href="/settings/products" className="underline font-semibold">
                      Product Settings
                    </Link>{' '}
                    first.
                  </p>
                )}
              </div>
            </div>

            {/* Step 3: Size (Radio Pill Cards) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                {/* <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span> */}
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-gray-900">Size</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Based on selected category)
                  </span>
                </div>
              </div>
              <div className="">
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
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${isSelected
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
                {/* <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shrink-0">
                  4
                </span> */}
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-gray-900">Thickness</span>
                  <span className="text-xs text-gray-400 font-normal">
                    (Based on selected size)
                  </span>
                </div>
              </div>
              <div className="">
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
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-all ${isSelected
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
            <div className=" space-y-3">
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
                <div className="grid grid-cols-2 gap-2 sm:col-span-2 pt-2 border-t border-gray-100">
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
                <div className="grid grid-cols-2 gap-2 sm:col-span-2 pt-2 border-t border-gray-100">
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

                {/* Distributor Group */}
                <div className="grid grid-cols-2 gap-2 sm:col-span-2 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Distributor % (Discount)
                    </label>
                    <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                      <input
                        type="number"
                        min="0"
                        value={distributorPct}
                        onChange={(e) => handleDistributorPctChange(Number(e.target.value))}
                        className="w-full px-2.5 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                      />
                      <span className="px-2.5 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-l border-gray-200 flex items-center">
                        %
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Distributor Price
                    </label>
                    <div className="relative flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-brand-blue">
                      <span className="px-2 py-2 bg-gray-50 text-gray-500 text-xs font-semibold border-r border-gray-200 flex items-center">
                        Rs
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={distributorPrice}
                        onChange={(e) => handleDistributorPriceChange(Number(e.target.value))}
                        className="w-full px-2.5 py-2 text-sm font-semibold text-gray-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Initialization & Reorder Thresholds */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Initial Stock & Reorder Alerts</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Initial Opening Stock (Units)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={initialStock}
                      onChange={(e) => setInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue focus:outline-none"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Leave 0 if no initial floor inventory exists.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Minimum Stock (Reorder Threshold)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minStockQty}
                      onChange={(e) => setMinStockQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-brand-blue focus:outline-none"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Triggers low stock warnings when stock &le; threshold.</p>
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

              <div className="flex items-center justify-between text-gray-600">
                <span>Distributor Price</span>
                <span className="font-bold text-gray-800 font-mono">
                  Rs {distributorPrice.toLocaleString()} <span className="font-normal text-gray-500">({distributorPct}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600 pt-2 border-t border-gray-100">
                <span>Initial Stock / Min Threshold</span>
                <span className="font-bold text-gray-800 font-mono">
                  {initialStock} units <span className="font-normal text-gray-500">(Min: {minStockQty})</span>
                </span>
              </div>
            </div>

            {/* Stock Info Note */}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Info className="w-3.5 h-3.5 text-brand-blue shrink-0" />
              <span>Floor inventory is automatically synchronized with Opening Stock.</span>
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
