'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store';
import {
  erpApi,
  useGetBranchesQuery,
  useGetBrandsQuery,
  useGetCategoriesQuery,
  useGetSizesQuery,
  useGetThicknessesQuery,
  useGetCatalogueProductsQuery,
  useGetProductVariantsQuery,
  useGetInventoryBalancesQuery,
  useGetPOSSettingsQuery,
  useUpdatePOSSettingsMutation,
  useGetHeldSalesQuery,
  useHoldSaleMutation,
  useDeleteHeldSaleMutation,
  useCompletePOSCheckoutMutation,
} from '@/store/services/apiSlice';
import {
  posApi,
  useGetBranchesQuery as useGetBackendBranchesQuery,
  useGetPOSCatalogueQuery as useGetBackendPOSCatalogueQuery,
  useGetHeldSalesQuery as useGetBackendHeldSalesQuery,
  useHoldSaleMutation as useHoldSaleBackendMutation,
  useDeleteHeldSaleMutation as useDeleteHeldSaleBackendMutation,
  useCompleteCheckoutMutation as useCompleteBackendCheckoutMutation,
  useGetInvoiceByIdQuery as useGetBackendInvoiceByIdQuery,
} from '@/store/services/posApi';
import {
  catalogueApi,
  useGetBrandsQuery as useGetBackendBrandsQuery,
  useGetCategoriesQuery as useGetBackendCategoriesQuery,
  useGetSizesQuery as useGetBackendSizesQuery,
  useGetThicknessesQuery as useGetBackendThicknessesQuery,
  useGetProductsQuery as useGetBackendProductsQuery,
  useGetSkusQuery as useGetBackendSkusQuery,
} from '@/store/services/catalogueApi';
import {
  inventoryApi,
  useGetStockBalancesQuery as useGetBackendStockBalancesQuery,
} from '@/store/services/inventoryApi';
import {
  saveMasterSnapshot,
  getMasterSnapshot,
  queueOfflineSale,
  POSMasterSnapshot,
} from '@/lib/offline/posOfflineDb';
import { usePOSOfflineSync, SyncResult } from '@/lib/offline/posOfflineSync';
import { hasPermission } from '@/lib/permissions';
import {
  CatalogueProduct,
  POSCartItem,
  PaymentMethod,
  HeldSale,
  Invoice,
  SaleType,
  PaymentArrangement,
  Customer,
  Branch,
  Brand,
  Category,
  MattressSize,
  MattressThickness,
  ProductVariant,
  InventoryBalance,
} from '@/types';
import { STORAGE_KEYS } from '@/lib/demo-db/schema';
import { demoStorage } from '@/lib/demo-db/storage';
import POSHeader from '@/components/pos/POSHeader';
import SaleTypeSelector from '@/components/pos/SaleTypeSelector';
import RepriceConfirmModal from '@/components/pos/RepriceConfirmModal';
import POSCustomerModal from '@/components/pos/POSCustomerModal';
import BrandSelector from '@/components/pos/BrandSelector';
import SizeThicknessSelector from '@/components/pos/SizeThicknessSelector';
import CategorySidebar from '@/components/pos/CategorySidebar';
import ProductGrid from '@/components/pos/ProductGrid';
import ProductConfigModal from '@/components/pos/ProductConfigModal';
import POSCart from '@/components/pos/POSCart';
import POSFooter from '@/components/pos/POSFooter';
import InvoiceReceiptModal from '@/components/pos/InvoiceReceiptModal';
import HeldSalesModal from '@/components/pos/HeldSalesModal';
import POSSettingsModal from '@/components/pos/POSSettingsModal';
import NewSaleConfirmModal from '@/components/pos/NewSaleConfirmModal';
import PaymentCheckoutModal, { CheckoutSubmitData } from '@/components/pos/PaymentCheckoutModal';

function computeDefaultDueDate(days: number = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function POSContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editInvoiceId = searchParams?.get('editInvoiceId');
  const [editingInvoice, setEditingInvoice] = useState<{ id: string; invoiceNumber: string } | null>(null);

  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const isBackendMode = process.env.NEXT_PUBLIC_DATA_MODE === 'backend';

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Optimistic tracking for smooth instant stock updates after checkout
  const [soldQuantitiesBySku, setSoldQuantitiesBySku] = useState<Record<string, number>>({});

  // Selected fulfilling branch for cross-branch stock viewing & selling
  const [selectedStockBranchId, setSelectedStockBranchId] = useState<string | null>(null);

  // Offline Resilience & Synchronization
  const [offlineSnapshot, setOfflineSnapshot] = useState<POSMasterSnapshot | null>(null);

  // Demo Queries
  const { data: demoBranches = [] } = useGetBranchesQuery(undefined, { skip: isBackendMode });
  const { data: demoBrands = [] } = useGetBrandsQuery(undefined, { skip: isBackendMode });
  const { data: demoCategories = [] } = useGetCategoriesQuery(undefined, { skip: isBackendMode });
  const { data: demoSizes = [] } = useGetSizesQuery(undefined, { skip: isBackendMode });
  const { data: demoThicknesses = [] } = useGetThicknessesQuery(undefined, { skip: isBackendMode });
  const { data: demoProducts = [], refetch: refetchDemoProducts } = useGetCatalogueProductsQuery(undefined, { skip: isBackendMode });
  const { data: demoVariants = [], refetch: refetchDemoVariants } = useGetProductVariantsQuery(undefined, { skip: isBackendMode });
  const { data: demoInventoryBalances = [], refetch: refetchDemoInventory } = useGetInventoryBalancesQuery(undefined, { skip: isBackendMode });
  const { data: posSettings } = useGetPOSSettingsQuery(undefined, { skip: isBackendMode });
  const { data: demoHeldSales = [] } = useGetHeldSalesQuery(undefined, { skip: isBackendMode });

  // Backend Queries
  const { data: backendBranches = [] } = useGetBackendBranchesQuery(undefined, { skip: !isBackendMode });
  const { data: backendBrands = [] } = useGetBackendBrandsQuery(undefined, { skip: !isBackendMode });
  const { data: backendCategories = [] } = useGetBackendCategoriesQuery(undefined, { skip: !isBackendMode });
  const { data: backendSizes = [] } = useGetBackendSizesQuery(undefined, { skip: !isBackendMode });
  const { data: backendThicknesses = [] } = useGetBackendThicknessesQuery(undefined, { skip: !isBackendMode });
  const { data: backendProducts = [], refetch: refetchProducts } = useGetBackendProductsQuery(undefined, { skip: !isBackendMode });
  const { data: backendSkusResponse, refetch: refetchSkus } = useGetBackendSkusQuery(undefined, { skip: !isBackendMode });

  // Unified Branches
  const branches: Branch[] = useMemo(() => {
    const backendList = Array.isArray(backendBranches)
      ? backendBranches
      : (backendBranches as any)?.data || [];
    const offlineList = offlineSnapshot?.branches || (offlineSnapshot?.activeBranch ? [offlineSnapshot.activeBranch] : []);
    const demoList = demoBranches || [];

    const list = backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;

    return list.map((b: any) => ({
      ...b,
      id: String(b.id || b._id || ''),
    })) as Branch[];
  }, [backendBranches, demoBranches, offlineSnapshot]);

  // Active Terminal Branch
  const activeBranch = useMemo(() => {
    const userBranchId = currentUser?.assignedBranchId || currentUser?.branchId;
    if (userBranchId && !isSuperAdmin) {
      const found = branches.find(
        (b) =>
          String(b.id) === String(userBranchId) ||
          String((b as any)._id) === String(userBranchId) ||
          String(b.code).toLowerCase() === String(userBranchId).toLowerCase()
      );
      if (found) return found;
    }

    if (isSuperAdmin && (posSettings?.selectedBranchId || posSettings?.branchId)) {
      const targetId = posSettings?.selectedBranchId || posSettings?.branchId;
      const found = branches.find((b) => b.id === targetId || (b as any)._id === targetId);
      if (found) return found;
    }

    if (userBranchId) {
      const found = branches.find(
        (b) =>
          String(b.id) === String(userBranchId) ||
          String((b as any)._id) === String(userBranchId) ||
          String(b.code).toLowerCase() === String(userBranchId).toLowerCase()
      );
      if (found) return found;
    }

    return branches[0] || null;
  }, [branches, currentUser, posSettings, isSuperAdmin]);

  // Effective stock branch (switched in header or own terminal branch)
  const effectiveStockBranchId = selectedStockBranchId || activeBranch?.id;

  const { data: backendStockBalances = [], refetch: refetchStockBalances } = useGetBackendStockBalancesQuery(
    effectiveStockBranchId ? { branchId: effectiveStockBranchId, limit: 1000 } : undefined,
    { skip: !isBackendMode }
  );
  const { data: backendHeldSales = [] } = useGetBackendHeldSalesQuery(undefined, { skip: !isBackendMode });

  // Mutations
  const [updateSettings] = useUpdatePOSSettingsMutation();
  const [holdSaleMutation] = useHoldSaleMutation();
  const [deleteHeldSaleMutation] = useDeleteHeldSaleMutation();
  const [completeCheckoutMutation, { isLoading: isDemoCheckingOut }] =
    useCompletePOSCheckoutMutation();

  const [holdSaleBackendMutation] = useHoldSaleBackendMutation();
  const [deleteHeldSaleBackendMutation] = useDeleteHeldSaleBackendMutation();
  const [completeCheckoutBackendMutation, { isLoading: isBackendCheckingOut }] =
    useCompleteBackendCheckoutMutation();

  const { data: backendEditingInvoice } = useGetBackendInvoiceByIdQuery(
    editInvoiceId || '',
    { skip: !isBackendMode || !editInvoiceId }
  );

  const isCheckingOut = isBackendMode ? isBackendCheckingOut : isDemoCheckingOut;

  // Sync manager hook
  const {
    isOnline,
    pendingCount,
    isSyncing,
    triggerSync,
    refreshPendingCount,
  } = usePOSOfflineSync(
    useCallback(
      async (payload) => {
        return await completeCheckoutBackendMutation(payload).unwrap();
      },
      [completeCheckoutBackendMutation]
    ),
    useCallback(
      (result: SyncResult) => {
        dispatch(inventoryApi.util.invalidateTags(['StockBalance', 'InventorySummary', 'StockMovement']));
        dispatch(catalogueApi.util.invalidateTags(['Variant', 'Product']));
        refetchStockBalances();
        refetchSkus();
      },
      [dispatch, refetchStockBalances, refetchSkus]
    )
  );

  // Load offline snapshot on mount
  useEffect(() => {
    getMasterSnapshot().then((snap) => {
      if (snap) setOfflineSnapshot(snap);
    });
  }, []);

  // Permission guard: If branch has POS permission disabled, redirect to unauthorized
  useEffect(() => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN' && !hasPermission(currentUser, 'pos:view')) {
      router.push('/unauthorized');
    }
  }, [currentUser, router]);

  // Unified Data (Online Primary with Offline Snapshot Fallback)
  const brands: Brand[] = useMemo(() => {
    const backendList = Array.isArray(backendBrands)
      ? backendBrands
      : (backendBrands as any)?.data || [];
    const offlineList = offlineSnapshot?.brands || [];
    const demoList = demoBrands || [];

    const list = backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;

    return list.map((b: any) => ({
      ...b,
      id: String(b.id || b._id || ''),
    })) as Brand[];
  }, [backendBrands, demoBrands, offlineSnapshot]);

  const categories: Category[] = useMemo(() => {
    const backendList = Array.isArray(backendCategories)
      ? backendCategories
      : (backendCategories as any)?.data || [];
    const offlineList = offlineSnapshot?.categories || [];
    const demoList = demoCategories || [];

    const list = backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;

    return list.map((c: any) => ({
      ...c,
      id: String(c.id || c._id || ''),
      brandId: String(c.brandId?._id || c.brandId || c.brand?._id || c.brand?.id || ''),
    })) as Category[];
  }, [backendCategories, demoCategories, offlineSnapshot]);

  const sizes: MattressSize[] = useMemo(() => {
    const backendList = Array.isArray(backendSizes)
      ? backendSizes
      : (backendSizes as any)?.data || [];
    const offlineList = offlineSnapshot?.sizes || [];
    const demoList = demoSizes || [];

    const list = backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;

    return list.map((s: any) => ({
      ...s,
      id: String(s.id || s._id || ''),
    })) as MattressSize[];
  }, [backendSizes, demoSizes, offlineSnapshot]);

  const thicknesses: MattressThickness[] = useMemo(() => {
    const backendList = Array.isArray(backendThicknesses)
      ? backendThicknesses
      : (backendThicknesses as any)?.data || [];
    const offlineList = offlineSnapshot?.thicknesses || [];
    const demoList = demoThicknesses || [];

    const list = backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;

    return list.map((t: any) => ({
      ...t,
      id: String(t.id || t._id || ''),
    })) as MattressThickness[];
  }, [backendThicknesses, demoThicknesses, offlineSnapshot]);

  const products: CatalogueProduct[] = useMemo(() => {
    const backendList = Array.isArray(backendProducts)
      ? backendProducts
      : (backendProducts as any)?.data || (backendProducts as any)?.items || [];
    const offlineList = offlineSnapshot?.products || [];
    const demoList = demoProducts || [];

    const list = backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;

    return list.map((p: any) => ({
      ...p,
      id: String(p.id || p._id || ''),
      brandId: String(p.brandId?._id || p.brandId || p.brand?._id || p.brand?.id || ''),
      categoryId: String(p.categoryId?._id || p.categoryId || p.category?._id || p.category?.id || ''),
      code: p.code || `${p.brand?.code || 'MF'}-${p.category?.code || 'CAT'}`.toUpperCase(),
      name: p.name || 'Unnamed Product',
      status: p.status || 'ACTIVE',
    })) as CatalogueProduct[];
  }, [backendProducts, demoProducts, offlineSnapshot]);

  const variants: ProductVariant[] = useMemo(() => {
    const backendList = Array.isArray(backendSkusResponse)
      ? backendSkusResponse
      : (backendSkusResponse as any)?.data || (backendSkusResponse as any)?.items || [];
    const offlineList = offlineSnapshot?.variants || [];
    const demoList = demoVariants || [];

    const list = backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;

    return list.map((v: any) => {
      const pId = String(v.productId?._id || v.productId || v.product?._id || v.product?.id || '');
      const bId = String(v.brandId?._id || v.brandId || v.brand?._id || v.brand?.id || '');
      const cId = String(v.categoryId?._id || v.categoryId || v.category?._id || v.category?.id || '');
      const sId = String(v.sizeId?._id || v.sizeId || v.size?._id || v.size?.id || '');
      const tId = String(v.thicknessId?._id || v.thicknessId || v.thickness?._id || v.thickness?.id || '');
      const retPrice = v.retailPrice || v.walkInPrice || 0;
      return {
        ...v,
        id: String(v.id || v._id || ''),
        sku: v.sku || '',
        productId: pId,
        brandId: bId,
        categoryId: cId,
        sizeId: sId,
        thicknessId: tId,
        retailPrice: retPrice,
        walkInPrice: v.walkInPrice || retPrice,
        wholesalePrice: v.wholesalePrice || 0,
        distributorPrice: v.distributorPrice || 0,
        stock: v.stock ?? v.onHand ?? 0,
        status: v.status || 'ACTIVE',
      };
    }) as ProductVariant[];
  }, [backendSkusResponse, demoVariants, offlineSnapshot]);

  const isRetailAllowed = activeBranch?.settings?.allowRetailSales ?? true;

  const rawStock = useMemo(() => {
    const backendList = Array.isArray(backendStockBalances)
      ? backendStockBalances
      : (backendStockBalances as any)?.items || (backendStockBalances as any)?.data || [];
    const offlineList = offlineSnapshot?.inventoryBalances || [];
    const demoList = demoInventoryBalances || [];

    return backendList.length > 0
      ? backendList
      : offlineList.length > 0
      ? offlineList
      : demoList;
  }, [backendStockBalances, offlineSnapshot, demoInventoryBalances]);

  const inventoryBalances: InventoryBalance[] = useMemo(() => {
    const list = Array.isArray(rawStock) ? rawStock : [];
    return list.map((b: any) => {
      const soldQty = soldQuantitiesBySku[b.sku] || 0;
      const av = Math.max(0, Number(b.available || 0) - soldQty);
      return {
        id: String(b.id || b._id || ''),
        sku: b.sku || '',
        branchId: String(b.branchId?._id || b.branchId?.id || b.branchId || ''),
        stockLocationId: String(b.stockLocationId?._id || b.stockLocationId || 'LOC-FLOOR'),
        productId: String(b.variant?.productId?._id || b.variant?.productId || b.productId || ''),
        variantId: String(b.variantId?._id || b.variantId || b.variant?._id || b.variant?.id || b.sku || ''),
        productName: b.variant?.productId?.name || b.productName || '',
        brandName: b.variant?.productId?.brandId?.name || b.brandName || '',
        categoryName: b.variant?.productId?.categoryId?.name || b.categoryName || '',
        sizeLabel: b.variant?.sizeId?.displayLabel || b.sizeLabel || '',
        thicknessInches: Number(b.variant?.thicknessId?.value || b.thicknessInches || 0),
        onHand: Math.max(0, Number(b.onHand || 0) - soldQty),
        reserved: Number(b.reserved || 0),
        available: av,
        reorderLevel: Number(b.reorderLevel || 5),
        stockStatus: (av > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK') as any,
        updatedAt: b.updatedAt || new Date().toISOString(),
      };
    });
  }, [rawStock, soldQuantitiesBySku]);

  const rawHeld = isBackendMode
    ? (Array.isArray(backendHeldSales) ? backendHeldSales : (backendHeldSales as any)?.data || [])
    : demoHeldSales;
  const heldSales: HeldSale[] = (Array.isArray(rawHeld) ? rawHeld : []) as HeldSale[];

  // Filtered inventory balances for effective stock branch
  const branchBalances = useMemo(() => {
    if (!effectiveStockBranchId) return inventoryBalances;
    return inventoryBalances.filter((b) => {
      const bId = String(b.branchId || '');
      return bId === effectiveStockBranchId;
    });
  }, [inventoryBalances, effectiveStockBranchId]);

  // Fast O(1) balance maps to eliminate O(N*M) lookup lag
  const { balanceByVariantId, balanceBySku } = useMemo(() => {
    const byVariant = new Map<string, InventoryBalance>();
    const bySku = new Map<string, InventoryBalance>();
    for (let i = 0; i < branchBalances.length; i++) {
      const b = branchBalances[i];
      if (b.variantId) byVariant.set(b.variantId, b);
      if (b.sku) bySku.set(b.sku, b);
    }
    return { balanceByVariantId: byVariant, balanceBySku: bySku };
  }, [branchBalances]);

  // Fast O(N) Variant Stock Map
  const variantStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const balance = balanceByVariantId.get(v.id) || balanceBySku.get(v.sku);
      const soldQty = soldQuantitiesBySku[v.sku] || 0;
      let baseStock = 0;
      if (balance) {
        baseStock = balance.available;
      } else if (!isBackendMode && effectiveStockBranchId === 'BR-MAIN-01') {
        baseStock = v.stock ?? (v as any).onHand ?? 0;
      }
      const stock = Math.max(0, baseStock - soldQty);
      map[v.id] = stock;
    }
    return map;
  }, [variants, balanceByVariantId, balanceBySku, soldQuantitiesBySku, isBackendMode, effectiveStockBranchId]);

  // Fast O(V) group variants by product ID
  const variantsByProductId = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (v.status !== 'ACTIVE' && v.status) continue;
      const pId = String(v.productId);
      const list = map.get(pId);
      if (list) {
        list.push(v);
      } else {
        map.set(pId, [v]);
      }
    }
    return map;
  }, [variants]);

  // Products associated with the effective stock branch
  const branchProductIds = useMemo(() => {
    const pIdSet = new Set<string>();

    // 1. Products that have a recorded StockBalance in this branch
    for (let i = 0; i < branchBalances.length; i++) {
      const b = branchBalances[i];
      if (b.productId) pIdSet.add(String(b.productId));
      if (b.variantId) {
        const v = variants.find((item) => item.id === b.variantId || item.sku === b.sku);
        if (v && v.productId) pIdSet.add(String(v.productId));
      }
    }

    // 2. Products explicitly owned by or created for this branch
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if ((p as any).branchId && String((p as any).branchId) === String(effectiveStockBranchId)) {
        pIdSet.add(String(p.id));
      }
    }

    // In demo mock mode for seed branch BR-MAIN-01, fallback to all demo products if no balances yet
    if (!isBackendMode && effectiveStockBranchId === 'BR-MAIN-01' && pIdSet.size === 0) {
      products.forEach((p) => pIdSet.add(String(p.id)));
    }

    return pIdSet;
  }, [branchBalances, variants, products, effectiveStockBranchId, isBackendMode]);

  // Fast O(P) Brand Stock Map (sum of variant stock for each brand within this branch)
  const brandStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if ((p.status && p.status !== 'ACTIVE') || !p.brandId) continue;
      if (!branchProductIds.has(String(p.id))) continue;
      const pVariants = variantsByProductId.get(String(p.id));
      if (!pVariants) continue;
      let pStock = 0;
      for (let j = 0; j < pVariants.length; j++) {
        pStock += variantStockMap[pVariants[j].id] || 0;
      }
      map[p.brandId] = (map[p.brandId] || 0) + pStock;
    }
    return map;
  }, [products, branchProductIds, variantsByProductId, variantStockMap]);

  // Brand products count helper (scoped to this branch)
  const brandProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (Array.isArray(products)) {
      products.forEach((p) => {
        if (p.status === 'ACTIVE' && p.brandId && branchProductIds.has(String(p.id))) {
          counts[p.brandId] = (counts[p.brandId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [products, branchProductIds]);

  // Auto-save snapshot to IndexedDB when live data is loaded online
  useEffect(() => {
    if (brands.length > 0 && products.length > 0 && isOnline) {
      saveMasterSnapshot({
        brands,
        categories,
        sizes,
        thicknesses,
        products,
        variants,
        inventoryBalances,
        activeBranch,
        branches,
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [brands, categories, sizes, thicknesses, products, variants, inventoryBalances, activeBranch, branches, isOnline]);

  // Auto-refresh when internet is restored from offline mode
  const wasOfflineRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current && isOnline) {
      wasOfflineRef.current = false;
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [isOnline]);

  // Selected Brand and Category States
  const [chosenBrandId, setChosenBrandId] = useState<string | null>(null);
  const selectedBrandId = useMemo(() => {
    // 1. If chosen brand has available stock (> 0) in this branch, keep it
    if (
      chosenBrandId &&
      brands.some((b) => String(b.id) === String(chosenBrandId)) &&
      (brandStockMap[chosenBrandId] || 0) > 0
    ) {
      return chosenBrandId;
    }

    // 2. High priority: First brand that has available stock (> 0) in this branch
    const brandInStock = brands.find((b) => (brandStockMap[b.id] || 0) > 0);
    if (brandInStock) return brandInStock.id;

    // 3. If chosen brand has products even if out of stock, retain it
    if (
      chosenBrandId &&
      brands.some((b) => String(b.id) === String(chosenBrandId)) &&
      (brandProductCounts[chosenBrandId] || 0) > 0
    ) {
      return chosenBrandId;
    }

    // 4. Second priority: First brand that has active products in this branch
    const brandWithProducts = brands.find((b) => (brandProductCounts[b.id] || 0) > 0);
    if (brandWithProducts) return brandWithProducts.id;

    // 5. Fallback: First brand
    return brands[0]?.id || '';
  }, [chosenBrandId, brands, brandStockMap, brandProductCounts]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  // Debounce search query to keep typing responsive at 60 FPS
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Flow 07 Unified POS Multi-Tier & Credit States
  const [saleType, setSaleType] = useState<SaleType>('WALK_IN');
  const [pendingSaleType, setPendingSaleType] = useState<SaleType | null>(null);
  const [isRepriceModalOpen, setIsRepriceModalOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const [paymentArrangement, setPaymentArrangement] = useState<PaymentArrangement>('FULL');
  const [dueDate, setDueDate] = useState<string>(() => computeDefaultDueDate(30));
  const [creditOverride, setCreditOverride] = useState(false);

  // Cart State (Persisted in localStorage)
  const [cartItems, setCartItems] = useState<POSCartItem[]>(() => {
    return demoStorage.getItem<POSCartItem[]>(STORAGE_KEYS.POS_CART, []);
  });

  // Pre-load existing invoice items and configuration when editing an invoice
  useEffect(() => {
    if (backendEditingInvoice && editInvoiceId) {
      setEditingInvoice({
        id: String(backendEditingInvoice.id || (backendEditingInvoice as any)._id),
        invoiceNumber: backendEditingInvoice.invoiceNumber,
      });

      if (backendEditingInvoice.items && backendEditingInvoice.items.length > 0) {
        const loadedItems: POSCartItem[] = backendEditingInvoice.items.map((it: any) => ({
          variantId: String(it.variantId || it.sku),
          productId: String(it.productId || it.variantId || it.sku),
          productName: it.productName,
          sku: it.sku,
          brandName: it.brandName || 'Molty',
          categoryName: it.categoryName || 'Foam',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          discount: it.discount || 0,
          lineTotal: it.lineTotal || (it.unitPrice || 0) * (it.quantity || 1),
          sizeLabel: it.sizeLabel || '',
          thicknessLabel: it.thicknessLabel || '',
          availableStock: 999,
          retailPrice: it.unitPrice,
          wholesalePrice: it.unitPrice,
          distributorPrice: it.unitPrice,
        }));
        setCartItems(loadedItems);
      }

      if (backendEditingInvoice.saleType) {
        setSaleType(backendEditingInvoice.saleType as any);
      }

      const invDiscount = (backendEditingInvoice as any).discount ?? (backendEditingInvoice as any).discountAmount ?? 0;
      if (invDiscount > 0) {
        setDiscountAmount(invDiscount);
      }

      if (backendEditingInvoice.customerId) {
        const custObj: any = typeof backendEditingInvoice.customerId === 'object'
          ? backendEditingInvoice.customerId
          : null;
        if (custObj) {
          setSelectedCustomer({
            id: String(custObj._id || custObj.id || backendEditingInvoice.customerId),
            name: custObj.name || backendEditingInvoice.customerName,
            phone: custObj.phone || backendEditingInvoice.customerPhone,
            customerType: custObj.customerType || backendEditingInvoice.customerType,
            outstandingBalance: custObj.outstandingBalance || 0,
            creditLimit: custObj.creditLimit || 0,
            creditEnabled: custObj.creditEnabled || true,
          } as any);
        } else if (backendEditingInvoice.customerName) {
          setSelectedCustomer({
            id: String(backendEditingInvoice.customerId),
            name: backendEditingInvoice.customerName,
            phone: backendEditingInvoice.customerPhone || '',
            customerType: backendEditingInvoice.customerType || 'WALK_IN',
            outstandingBalance: 0,
            creditLimit: 50000,
            creditEnabled: true,
          } as any);
        }
      }
    }
  }, [backendEditingInvoice, editInvoiceId]);

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [enteredAmountReceived, setEnteredAmountReceived] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Modal States
  const [configModalProduct, setConfigModalProduct] = useState<CatalogueProduct | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isHeldSalesModalOpen, setIsHeldSalesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewSaleConfirmOpen, setIsNewSaleConfirmOpen] = useState(false);
  const [isTabletCartOpen, setIsTabletCartOpen] = useState(false);

  // Active brand object
  const currentBrand = useMemo(() => {
    return brands.find((b) => b.id === selectedBrandId) || brands[0] || null;
  }, [brands, selectedBrandId]);

  // Filter categories strictly by selected brand
  const brandCategories = useMemo(() => {
    return categories.filter(
      (c) => String(c.brandId) === String(selectedBrandId) && c.status === 'ACTIVE'
    );
  }, [categories, selectedBrandId]);

  // Fast O(P) Category Stock Map (sum of variant stock for each category within active brand for this branch)
  const categoryStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.status !== 'ACTIVE' || !p.categoryId || p.brandId !== selectedBrandId) continue;
      if (!branchProductIds.has(String(p.id))) continue;
      const pVariants = variantsByProductId.get(String(p.id));
      if (!pVariants) continue;
      let pStock = 0;
      for (let j = 0; j < pVariants.length; j++) {
        pStock += variantStockMap[pVariants[j].id] || 0;
      }
      map[p.categoryId] = (map[p.categoryId] || 0) + pStock;
    }
    return map;
  }, [products, branchProductIds, variantsByProductId, variantStockMap, selectedBrandId]);

  // Category products count helper (scoped to this branch)
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (Array.isArray(products)) {
      products.forEach((p) => {
        if (p.brandId === selectedBrandId && p.status === 'ACTIVE' && p.categoryId && branchProductIds.has(String(p.id))) {
          counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [products, selectedBrandId, branchProductIds]);

  // Filter products strictly by Branch ownership, Brand, Category, and Debounced Search
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      // Strict branch isolation: Only show products belonging to or stocked in this branch!
      if (!branchProductIds.has(String(p.id))) return false;
      if (p.brandId !== selectedBrandId) return false;
      if (selectedCategoryId !== 'ALL' && p.categoryId !== selectedCategoryId) return false;

      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesDesc = (p.description || '').toLowerCase().includes(query);
        const matchesCode = (p.code || '').toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesCode) return false;
      }
      return true;
    });
  }, [products, branchProductIds, selectedBrandId, selectedCategoryId, debouncedSearchQuery]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cartItems]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Derived effective amount received
  const amountReceived = enteredAmountReceived !== null ? enteredAmountReceived : grandTotal;

  // Sale Type Switch & Repricing Handlers
  const handleRequestSaleTypeChange = (newType: SaleType) => {
    if (newType === saleType) return;
    if (cartItems.length === 0) {
      setSaleType(newType);
      return;
    }
    setPendingSaleType(newType);
    setIsRepriceModalOpen(true);
  };

  const handleConfirmReprice = () => {
    if (!pendingSaleType) return;
    const targetTier = pendingSaleType;

    // Recalculate each item in cart based on targetTier
    setCartItems((prev) =>
      prev.map((item) => {
        const variant = variants.find((v) => v.id === item.variantId);
        let newPrice = 0;
        if (targetTier === 'WHOLESALE') {
          newPrice = variant?.wholesalePrice ?? item.wholesalePrice ?? 0;
        } else if (targetTier === 'DISTRIBUTOR') {
          newPrice =
            variant?.distributorPrice ??
            item.distributorPrice ??
            variant?.wholesalePrice ??
            0;
        } else {
          newPrice =
            variant?.walkInPrice ??
            variant?.retailPrice ??
            item.walkInPrice ??
            0;
        }

        return {
          ...item,
          saleType: targetTier,
          unitPrice: newPrice,
          lineTotal: newPrice * item.quantity,
        };
      })
    );

    setSaleType(targetTier);
    setIsRepriceModalOpen(false);
    setPendingSaleType(null);
  };

  const handleSelectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    const days = customer?.defaultDueDays && customer.defaultDueDays > 0 ? customer.defaultDueDays : 30;
    setDueDate(computeDefaultDueDate(days));
  };

  // Cart Handlers
  const handleAddToCart = (item: POSCartItem) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.variantId === item.variantId);
      if (existingIdx >= 0) {
        // Merge identical SKU into single line item
        const updated = [...prev];
        const existing = updated[existingIdx];
        const newQty = existing.quantity + item.quantity;
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          lineTotal: existing.unitPrice * newQty,
        };
        return updated;
      }
      return [...prev, item];
    });
  };

  const handleUpdateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(variantId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.variantId === variantId) {
          const clampedQty = Math.min(item.availableStock, quantity);
          return {
            ...item,
            quantity: clampedQty,
            lineTotal: item.unitPrice * clampedQty,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (variantId: string) => {
    setCartItems((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const handleClearCart = useCallback(() => {
    setCartItems([]);
    setDiscountAmount(0);
    setEnteredAmountReceived(null);
    setCreditOverride(false);
  }, []);

  // Complete Sale (F5) Handler - Validates and Opens Payment Popup Modal
  const handleCompleteSale = () => {
    if (!activeBranch) {
      alert('Error: Please select an active branch.');
      return;
    }
    if (!isRetailAllowed) {
      alert(`Retail sales are disabled for branch "${activeBranch.name}".`);
      return;
    }
    if (cartItems.length === 0) {
      alert('Cart is empty. Add products before completing sale.');
      return;
    }

    // Missing price check
    if (cartItems.some((i) => i.unitPrice <= 0)) {
      alert(`One or more items do not have a valid price for the ${saleType} tier.`);
      return;
    }

    // If wholesale or distributor without customer, prompt to select customer
    if ((saleType === 'WHOLESALE' || saleType === 'DISTRIBUTOR') && !selectedCustomer) {
      setIsCustomerModalOpen(true);
      return;
    }

    setIsPaymentModalOpen(true);
  };

  const handleConfirmCheckout = async (submitData: CheckoutSubmitData) => {
    const finalDiscount = discountAmount + (submitData.discountConcession || 0);
    const finalGrandTotal = Math.max(0, subtotal - finalDiscount);
    const effectivePaid =
      submitData.paymentArrangement === 'FULL'
        ? finalGrandTotal
        : submitData.paymentArrangement === 'CREDIT'
        ? 0
        : Math.min(finalGrandTotal, submitData.amountReceived);

    const outstanding = Math.max(0, finalGrandTotal - effectivePaid);
    const changeAmount =
      submitData.paymentArrangement === 'FULL'
        ? Math.max(0, submitData.amountReceived - finalGrandTotal)
        : 0;

    const executeOfflineSale = async () => {
      const offlineId = `OFF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const offlineInvNumber = `OFF-${activeBranch?.code || 'POS'}-${Date.now().toString().slice(-6)}`;

      const isCrossBranch = Boolean(
        effectiveStockBranchId && effectiveStockBranchId !== activeBranch?.id
      );
      const sourceBranchObj = isCrossBranch
        ? branches.find((b) => b.id === effectiveStockBranchId)
        : null;

      const checkoutPayload: any = {
        branchId: activeBranch?.id || (activeBranch as any)?._id || 'MAIN',
        sourceBranchId: isCrossBranch ? effectiveStockBranchId : undefined,
        customerId: selectedCustomer?.id || (selectedCustomer as any)?._id,
        customerName: selectedCustomer
          ? selectedCustomer.name
          : submitData.walkInName?.trim() || 'Walk-in Customer',
        customerPhone: selectedCustomer
          ? selectedCustomer.phone
          : submitData.walkInPhone?.trim() || '',
        customerType: selectedCustomer?.customerType || (saleType === 'WALK_IN' ? 'WALK_IN' : saleType),
        saleType,
        paymentArrangement: submitData.paymentArrangement,
        paymentMethod: submitData.paymentMethod,
        discountAmount: finalDiscount,
        amountReceived: effectivePaid,
        cashReceived: effectivePaid,
        dueDate: outstanding > 0 ? submitData.dueDate || dueDate : undefined,
        creditOverride: true,
        creditApprovedBy: currentUser?.name || 'Cashier',
        overrideReason: 'Approved at terminal',
        items: cartItems.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: `${saleType} Sale (Offline Mode - Light/Internet Outage)${isCrossBranch ? ` - Dispatched from ${sourceBranchObj?.name}` : ''}`,
        idempotencyKey: offlineId,
      };

      const offlineInvoice: Invoice = {
        id: offlineId,
        invoiceNumber: offlineInvNumber,
        branchId: String(activeBranch?.id || 'MAIN'),
        branchName: activeBranch?.name || 'Main Branch',
        sourceBranchId: isCrossBranch ? effectiveStockBranchId : undefined,
        sourceBranchName: sourceBranchObj?.name,
        isInterBranch: isCrossBranch,
        customerType: (selectedCustomer?.customerType || (saleType === 'WALK_IN' ? 'WALK_IN' : saleType)) as any,
        customerName: selectedCustomer
          ? selectedCustomer.name
          : submitData.walkInName?.trim() || 'Walk-in Customer',
        customerPhone: selectedCustomer
          ? selectedCustomer.phone
          : submitData.walkInPhone?.trim() || '',
        grossAmount: subtotal,
        subtotal,
        discountAmount: finalDiscount,
        returnAmount: 0,
        taxAmount: 0,
        netAmount: finalGrandTotal,
        grandTotal: finalGrandTotal,
        amountPaid: effectivePaid,
        amountReceived: effectivePaid,
        amountDue: outstanding,
        changeAmount,
        paymentStatus: outstanding <= 0 ? 'PAID' : effectivePaid > 0 ? 'PARTIAL' : 'UNPAID',
        paymentMethod: submitData.paymentMethod as any,
        status: 'COMPLETED' as any,
        date: new Date().toISOString(),
        salesPerson: currentUser?.name || 'Cashier',
        items: cartItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: (it as any).discount || 0,
          total: it.unitPrice * it.quantity,
          lineTotal: it.unitPrice * it.quantity,
          sizeLabel: it.sizeLabel || '',
          thicknessLabel: it.thicknessLabel || '',
        })),
      };

      // 1. Queue into local IndexedDB
      await queueOfflineSale({
        id: offlineId,
        idempotencyKey: offlineId,
        checkoutPayload,
        invoice: offlineInvoice,
        status: 'PENDING',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });

      // 2. Immediate local stock decrement
      const soldMap: Record<string, number> = {};
      cartItems.forEach((item) => {
        soldMap[item.sku] = (soldMap[item.sku] || 0) + item.quantity;
      });
      setSoldQuantitiesBySku((prev) => {
        const next = { ...prev };
        Object.entries(soldMap).forEach(([sku, qty]) => {
          next[sku] = (next[sku] || 0) + qty;
        });
        return next;
      });

      await refreshPendingCount();

      // 3. Close payment modal, open receipt modal and clear cart
      setIsPaymentModalOpen(false);
      setCompletedInvoice(offlineInvoice);
      setIsReceiptModalOpen(true);
      handleClearCart();

      if (posSettings?.autoPrintReceipt) {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    };

    try {
      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        await executeOfflineSale();
        return;
      }

      if (isBackendMode) {
        const isCrossBranch = Boolean(
          effectiveStockBranchId && effectiveStockBranchId !== activeBranch?.id
        );
        const sourceBranchObj = isCrossBranch
          ? branches.find((b) => b.id === effectiveStockBranchId)
          : null;

        const result = await completeCheckoutBackendMutation({
          branchId: activeBranch.id || (activeBranch as any)._id,
          sourceBranchId: isCrossBranch ? effectiveStockBranchId : undefined,
          customerId: selectedCustomer?.id || (selectedCustomer as any)?._id,
          customerName: selectedCustomer
            ? selectedCustomer.name
            : submitData.walkInName?.trim() || 'Walk-in Customer',
          customerPhone: selectedCustomer
            ? selectedCustomer.phone
            : submitData.walkInPhone?.trim() || undefined,
          customerType: selectedCustomer?.customerType || (saleType === 'WALK_IN' ? 'WALK_IN' : saleType),
          saleType,
          paymentArrangement: submitData.paymentArrangement,
          paymentMethod: submitData.paymentMethod as any,
          discountAmount: finalDiscount,
          amountReceived: effectivePaid,
          cashReceived: effectivePaid,
          dueDate: outstanding > 0 ? submitData.dueDate || dueDate : undefined,
          creditOverride: true,
          creditApprovedBy: currentUser?.name || 'Cashier',
          overrideReason: 'Approved at terminal',
          items: cartItems.map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes: `${saleType} Sale - ${submitData.paymentArrangement} Arrangement${isCrossBranch ? ` - Stock from ${sourceBranchObj?.name}` : ''}`,
          editingInvoiceId: editingInvoice?.id || undefined,
        }).unwrap();

        const inv: any = result.invoice;
        const normalizedInvoice: Invoice = {
          ...inv,
          id: String(inv.id || inv._id || ''),
          invoiceNumber: inv.invoiceNumber,
          branchId: String(activeBranch?.id || inv.branchId || ''),
          branchName: activeBranch?.name || inv.branchName || 'Main Branch',
          sourceBranchId: isCrossBranch ? effectiveStockBranchId : undefined,
          sourceBranchName: sourceBranchObj?.name,
          isInterBranch: isCrossBranch,
          customerName: inv.customerName,
          customerPhone: inv.customerPhone,
          grossAmount: inv.subtotal ?? inv.grossAmount ?? inv.total ?? 0,
          subtotal: inv.subtotal ?? inv.grossAmount ?? inv.total ?? 0,
          discountAmount: inv.discount ?? inv.discountAmount ?? finalDiscount,
          netAmount: inv.total ?? inv.netAmount ?? inv.grandTotal ?? finalGrandTotal,
          grandTotal: inv.total ?? inv.grandTotal ?? inv.netAmount ?? finalGrandTotal,
          amountPaid: inv.paidAmount ?? inv.amountPaid ?? inv.amountReceived ?? effectivePaid,
          amountReceived: inv.paidAmount ?? inv.amountReceived ?? effectivePaid,
          amountDue: inv.balanceDue ?? inv.amountDue ?? outstanding,
          changeAmount: inv.changeReturned ?? inv.changeAmount ?? changeAmount,
          paymentStatus: inv.paymentStatus || (outstanding <= 0 ? 'PAID' : 'PARTIAL'),
          paymentMethod: inv.paymentArrangement || inv.paymentMethod || submitData.paymentMethod,
          status: inv.status || 'COMPLETED',
          date: inv.createdAt || inv.date || new Date().toISOString(),
          salesPerson: inv.cashierName || currentUser?.name || 'Cashier',
          items: (inv.items || []).map((it: any) => ({
            productId: it.variantId || it.productId || it.sku,
            productName: it.productName || it.sku,
            sku: it.sku,
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            discount: it.discount || 0,
            total: it.lineTotal ?? it.total ?? ((it.unitPrice || 0) * (it.quantity || 1)),
            lineTotal: it.lineTotal ?? it.total ?? ((it.unitPrice || 0) * (it.quantity || 1)),
            sizeLabel: it.sizeLabel || '',
            thicknessLabel: it.thicknessLabel || '',
          })),
        };

        setIsPaymentModalOpen(false);
        setCompletedInvoice(normalizedInvoice);
        setIsReceiptModalOpen(true);
        handleClearCart();
        setEditingInvoice(null);
        if (editInvoiceId) {
          router.replace('/pos');
        }

        // Immediate local stock decrement
        const soldMap: Record<string, number> = {};
        cartItems.forEach((item) => {
          soldMap[item.sku] = (soldMap[item.sku] || 0) + item.quantity;
        });
        setSoldQuantitiesBySku((prev) => {
          const next = { ...prev };
          Object.entries(soldMap).forEach(([sku, qty]) => {
            next[sku] = (next[sku] || 0) + qty;
          });
          return next;
        });

        // Tag invalidations across inventory and catalogue stores
        dispatch(inventoryApi.util.invalidateTags(['StockBalance', 'InventorySummary', 'StockMovement']));
        dispatch(catalogueApi.util.invalidateTags(['Variant', 'Product']));
        dispatch(posApi.util.invalidateTags(['POSAvailability', 'POSCatalogue', 'StockBalance']));
        dispatch(erpApi.util.invalidateTags(['InventoryBalances', 'Variants', 'Products']));

        Promise.allSettled([
          refetchStockBalances(),
          refetchSkus(),
          refetchProducts(),
        ]).then(() => {
          setSoldQuantitiesBySku({});
        });

        if (posSettings?.autoPrintReceipt) {
          setTimeout(() => {
            window.print();
          }, 300);
        }
      } else {
        const demoResult = await completeCheckoutMutation({
          branchId: activeBranch.id,
          cashierId: currentUser?.id || 'USR-ADMIN-01',
          cashierName: currentUser?.name || 'Admin',
          customerName: selectedCustomer ? selectedCustomer.name : (submitData.walkInName || 'Walk-in Retail Customer'),
          customerPhone: selectedCustomer ? selectedCustomer.phone : (submitData.walkInPhone || '0300-1234567'),
          customerId: selectedCustomer?.id,
          saleType,
          appliedPriceList: saleType,
          paymentArrangement: submitData.paymentArrangement,
          dueDate: outstanding > 0 ? submitData.dueDate || dueDate : undefined,
          creditOverride: true,
          creditApprovedBy: currentUser?.name || 'Supervisor',
          paymentMethod: submitData.paymentMethod as any,
          discountAmount: finalDiscount,
          subtotal,
          taxAmount: 0,
          grandTotal: finalGrandTotal,
          amountReceived: effectivePaid,
          changeAmount,
          items: cartItems.map((item) => ({
            sku: item.sku,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes: `${saleType} Sale - ${submitData.paymentArrangement} Arrangement`,
        }).unwrap();

        setIsPaymentModalOpen(false);
        setCompletedInvoice(demoResult.invoice);
        setIsReceiptModalOpen(true);
        handleClearCart();
      }
    } catch (err: any) {
      const isNetworkError =
        typeof navigator !== 'undefined' &&
        (!navigator.onLine ||
          err?.status === 'FETCH_ERROR' ||
          err?.status === 'PARSING_ERROR' ||
          err?.name === 'TypeError' ||
          !err?.status ||
          err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('NetworkError'));

      if (isNetworkError) {
        await executeOfflineSale();
        return;
      }

      const errorMsg =
        err?.data?.message ||
        err?.error ||
        (err as Error).message ||
        'Checkout failed';
      alert(`Checkout failed: ${errorMsg}`);
    }
  };

  // Hold Sale (F3) Handler
  const handleHoldSale = async () => {
    if (cartItems.length === 0) {
      setIsHeldSalesModalOpen(true);
      return;
    }
    if (!activeBranch) return;

    try {
      if (isBackendMode) {
        await holdSaleBackendMutation({
          branchId: activeBranch.id || (activeBranch as any)._id,
          customerId: selectedCustomer?.id || (selectedCustomer as any)?._id,
          customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
          customerPhone: selectedCustomer?.phone,
          saleType,
          paymentArrangement,
          items: cartItems.map((item) => ({
            sku: item.sku,
            productId: item.productId,
            productName: item.productName,
            sizeLabel: item.sizeLabel,
            thicknessLabel: item.thicknessLabel,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
          subtotal,
          discountAmount,
          taxAmount: 0,
          grandTotal,
          notes: `${saleType} held sale`,
        }).unwrap();

        handleClearCart();
        alert('Sale has been put on hold successfully. You can resume it anytime (F3).');
        return;
      }

      await holdSaleMutation({
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        cashierId: currentUser?.id || 'USR-ADMIN-01',
        cashierName: currentUser?.name || 'Admin',
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        subtotal,
        grandTotal,
        totalAmount: grandTotal,
        discountAmount,
        taxAmount: 0,
        items: cartItems,
      }).unwrap();

      handleClearCart();
      alert('Sale has been put on hold successfully. You can resume it anytime (F3).');
    } catch (err: any) {
      const errorMsg =
        err?.data?.message ||
        err?.error ||
        (err as Error).message ||
        'Failed to hold sale';
      alert(`Failed to hold sale: ${errorMsg}`);
    }
  };

  // Resume Held Sale Handler
  const handleResumeSale = (heldSale: HeldSale) => {
    setCartItems(heldSale.items);
    setDiscountAmount(heldSale.discountAmount || 0);
    const saleId = (heldSale as any)._id || heldSale.id;
    if (isBackendMode) {
      deleteHeldSaleBackendMutation(saleId);
    } else {
      deleteHeldSaleMutation(heldSale.id);
    }
    setIsHeldSalesModalOpen(false);
  };

  // New Sale (F2) Handler
  const handleNewSale = () => {
    if (cartItems.length > 0) {
      setIsNewSaleConfirmOpen(true);
    } else {
      handleClearCart();
      setSaleType('WALK_IN');
      setSelectedCustomer(null);
      setPaymentArrangement('FULL');
      setDueDate(computeDefaultDueDate(30));
    }
  };

  const handlersRef = useRef({
    handleNewSale,
    handleHoldSale,
    handleCompleteSale,
    completedInvoice,
    cartItems,
    isCheckingOut,
    router,
    configModalProduct,
    isReceiptModalOpen,
    isHeldSalesModalOpen,
    isSettingsModalOpen,
    isNewSaleConfirmOpen,
    isCustomerModalOpen,
    isRepriceModalOpen,
  });

  useEffect(() => {
    handlersRef.current = {
      handleNewSale,
      handleHoldSale,
      handleCompleteSale,
      completedInvoice,
      cartItems,
      isCheckingOut,
      router,
      configModalProduct,
      isReceiptModalOpen,
      isHeldSalesModalOpen,
      isSettingsModalOpen,
      isNewSaleConfirmOpen,
      isCustomerModalOpen,
      isRepriceModalOpen,
    };
  });

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const handlers = handlersRef.current;
      const target = e.target as HTMLElement;
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') &&
        e.key !== 'Escape' &&
        e.key !== 'F2' &&
        e.key !== 'F3' &&
        e.key !== 'F4' &&
        e.key !== 'F5' &&
        e.key !== 'F6'
      ) {
        return;
      }

      // Ctrl+K / Cmd+K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('pos-search-input');
        searchInput?.focus();
        return;
      }

      // Escape: Close any open modal
      if (e.key === 'Escape') {
        if (handlers.configModalProduct) setConfigModalProduct(null);
        if (handlers.isReceiptModalOpen) setIsReceiptModalOpen(false);
        if (handlers.isHeldSalesModalOpen) setIsHeldSalesModalOpen(false);
        if (handlers.isSettingsModalOpen) setIsSettingsModalOpen(false);
        if (handlers.isNewSaleConfirmOpen) setIsNewSaleConfirmOpen(false);
        if (handlers.isCustomerModalOpen) setIsCustomerModalOpen(false);
        if (handlers.isRepriceModalOpen) setIsRepriceModalOpen(false);
        return;
      }

      // F2: New Sale
      if (e.key === 'F2') {
        e.preventDefault();
        handlers.handleNewSale();
        return;
      }

      // F3: Hold Sale / View Held
      if (e.key === 'F3') {
        e.preventDefault();
        handlers.handleHoldSale();
        return;
      }

      // F4: Sales History
      if (e.key === 'F4') {
        e.preventDefault();
        handlers.router.push('/pos/history');
        return;
      }

      // F5: Complete Sale
      if (e.key === 'F5') {
        e.preventDefault();
        if (handlers.cartItems.length > 0 && !handlers.isCheckingOut) {
          handlers.handleCompleteSale();
        }
        return;
      }

      // F6: Print Invoice
      if (e.key === 'F6') {
        e.preventDefault();
        if (handlers.completedInvoice) {
          setIsReceiptModalOpen(true);
          setTimeout(() => window.print(), 200);
        } else if (handlers.cartItems.length > 0) {
          window.print();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Auto-refresh page once internet is restored (switching from offline to online)
  useEffect(() => {
    let wasOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const handleOffline = () => {
      wasOffline = true;
    };

    const handleOnline = () => {
      if (wasOffline) {
        // Automatically refresh once when online connection returns
        window.location.reload();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // 2. Block accidental refresh (F5, Ctrl+R, reload dialog) while offline
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        e.preventDefault();
        e.returnValue = 'Offline Mode Active. Data is safe in memory.';
        return e.returnValue;
      }
    };

    const handlePreventReloadKeys = (e: KeyboardEvent) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (
          (e.ctrlKey && (e.key === 'r' || e.key === 'R')) ||
          (e.metaKey && (e.key === 'r' || e.key === 'R')) ||
          (e.key === 'F5' && cartItems.length === 0)
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handlePreventReloadKeys, { capture: true });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handlePreventReloadKeys, { capture: true });
    };
  }, [cartItems.length]);

  const handleStockBranchChange = useCallback((branchId: string) => {
    setSelectedStockBranchId(branchId);
    setChosenBrandId(null);
    setSelectedCategoryId('ALL');
  }, []);

  if (!isMounted) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center font-sans text-white text-sm select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 text-xs font-semibold tracking-wide">Loading Unified POS Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f6fa] overflow-hidden font-sans select-none">
      {/* 1. Top Header */}
      <POSHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeBranch={activeBranch}
        branches={branches}
        selectedStockBranchId={effectiveStockBranchId}
        onStockBranchChange={handleStockBranchChange}
        heldCount={heldSales.length}
        onNewSaleClick={handleNewSale}
        onHoldSaleClick={() => {
          if (cartItems.length > 0) {
            handleHoldSale();
          } else {
            setIsHeldSalesModalOpen(true);
          }
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        isSuperAdmin={isSuperAdmin}
        onBranchChange={(newBranchId) => {
          updateSettings({ selectedBranchId: newBranchId, branchId: newBranchId });
        }}
        saleType={saleType}
        onChangeSaleType={handleRequestSaleTypeChange}
        isOnline={isOnline}
        pendingOfflineCount={pendingCount}
        isSyncing={isSyncing}
        onSyncClick={triggerSync}
      />

      {/* Editing Invoice Mode Banner */}
      {editingInvoice && (
        <div className="mx-3.5 mt-2 px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span>
              <strong>Editing Invoice #{editingInvoice.invoiceNumber}:</strong> Making changes and completing checkout will update this invoice, restore previous stock, and re-calculate dues.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              handleClearCart();
              setEditingInvoice(null);
              router.replace('/pos');
            }}
            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Cancel Edit & Start Fresh
          </button>
        </div>
      )}

      {/* Cross-Branch Stock Alert Banner */}
      {effectiveStockBranchId && effectiveStockBranchId !== activeBranch?.id && (
        <div className="mx-3.5 mt-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              <strong>Cross-Branch Stock Mode:</strong> Showing and fulfilling inventory from{' '}
              <strong>{branches.find((b) => b.id === effectiveStockBranchId)?.name || 'Supplying Branch'}</strong>.
              Sale receipt will be recorded at terminal <strong>{activeBranch?.name}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedStockBranchId(null)}
            className="text-[11px] font-bold text-amber-900 hover:text-amber-950 underline px-2 py-0.5 rounded hover:bg-amber-100 transition-colors cursor-pointer"
          >
            Reset to My Terminal Stock
          </button>
        </div>
      )}

      {/* 3. Main Workspace Area: Left Area (Brands + Categories + Products) and Right Cart (Full Height aligned with Brands top) */}
      <div className="flex-1 flex overflow-hidden px-3.5 pb-3 pt-2.5 gap-3.5 min-h-0 relative">
        {/* Left Column: Brand Selector at top + [Category Sidebar | Products Grid] below */}
        <div className="flex-1 flex flex-col min-w-0 gap-3 overflow-hidden h-full">
          {/* Horizontal Brand Carousel */}
          <BrandSelector
            brands={brands}
            selectedBrandId={selectedBrandId}
            onSelectBrand={(id) => {
              setChosenBrandId(id);
              setSelectedCategoryId('ALL');
            }}
            brandProductCounts={brandProductCounts}
            brandStockMap={brandStockMap}
          />

          {/* Categories Sidebar + Products Grid Row */}
          <div className="flex-1 flex overflow-hidden gap-3.5 min-h-0">
            {/* Left: Category Sidebar Card */}
            <CategorySidebar
              categories={brandCategories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              categoryProductCounts={categoryProductCounts}
              categoryStockMap={categoryStockMap}
              totalAllCount={products.filter((p) => p.brandId === selectedBrandId && p.status === 'ACTIVE').length}
            />

            {/* Center: Products Grid Card */}
            <ProductGrid
              brandName={currentBrand?.name || 'Products'}
              products={filteredProducts}
              variants={variants}
              inventoryBalances={branchBalances}
              onSelectProduct={(product) => setConfigModalProduct(product)}
              selectedProductId={configModalProduct?.id}
              saleType={saleType}
              sizes={sizes}
              thicknesses={thicknesses}
            />
          </div>
        </div>

        {/* Right: Cart Card (Aligned with the top of BrandSelector! Full Height!) */}
        <div
          className={`fixed inset-y-0 right-0 z-40 lg:static lg:z-auto transition-transform duration-200 ${
            isTabletCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          } flex shrink-0 shadow-2xl lg:shadow-none bg-slate-900/30 lg:bg-transparent h-full`}
        >
          <POSCart
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            discountAmount={discountAmount}
            onDiscountChange={setDiscountAmount}
            amountReceived={amountReceived}
            onAmountReceivedChange={setEnteredAmountReceived}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            onCompleteSale={handleCompleteSale}
            onHoldSale={handleHoldSale}
            onPrintInvoice={() => {
              if (completedInvoice) {
                setIsReceiptModalOpen(true);
              } else if (cartItems.length > 0) {
                window.print();
              }
            }}
            isProcessing={isCheckingOut}
            isRetailAllowed={isRetailAllowed}
            saleType={saleType}
            selectedCustomer={selectedCustomer}
            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
            paymentArrangement={paymentArrangement}
            onPaymentArrangementChange={setPaymentArrangement}
            dueDate={dueDate}
            onDueDateChange={setDueDate}
            creditOverride={creditOverride}
            onCreditOverrideChange={setCreditOverride}
          />
        </div>

        {/* Floating Cart Button for Tablet/Mobile View (< lg screens) */}
        <button
          type="button"
          onClick={() => setIsTabletCartOpen(!isTabletCartOpen)}
          className="lg:hidden fixed bottom-14 right-4 z-50 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-3.5 shadow-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          aria-label="Toggle Cart"
        >
          <ShoppingCart className="w-6 h-6" />
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-xs">
              {cartItems.reduce((s, it) => s + it.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* 4. Bottom Footer */}
      <POSFooter
        cashierName={currentUser?.name || 'Admin'}
        shiftName={posSettings?.shiftName || 'Morning'}
        version="1.0.0"
        isOnline={isOnline}
        pendingOfflineCount={pendingCount}
      />

      {/* 5. Product Configuration Popup Modal */}
      <ProductConfigModal
        isOpen={!!configModalProduct}
        onClose={() => setConfigModalProduct(null)}
        product={configModalProduct}
        brandName={currentBrand?.name || ''}
        categoryName={
          categories.find((c) => c.id === configModalProduct?.categoryId)?.name || 'Foam'
        }
        variants={variants}
        sizes={sizes}
        thicknesses={thicknesses}
        inventoryBalances={branchBalances}
        onAddToCart={handleAddToCart}
        existingCartQuantity={
          configModalProduct
            ? cartItems
                .filter((item) => item.productId === configModalProduct.id)
                .reduce((s, it) => s + it.quantity, 0)
            : 0
        }
        saleType={saleType}
        variantStockMap={variantStockMap}
      />

      {/* 6. Flow 07 Reprice Confirmation Modal */}
      <RepriceConfirmModal
        isOpen={isRepriceModalOpen}
        onClose={() => {
          setIsRepriceModalOpen(false);
          setPendingSaleType(null);
        }}
        onConfirm={handleConfirmReprice}
        currentSaleType={saleType}
        targetSaleType={pendingSaleType || 'WALK_IN'}
        itemCount={cartItems.length}
      />

      {/* 7. Flow 07 Customer Selection & Creation Modal */}
      <POSCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        selectedCustomerId={selectedCustomer?.id}
        onSelectCustomer={handleSelectCustomer}
        branchId={activeBranch?.id}
        recommendedType={
          saleType === 'WHOLESALE'
            ? 'WHOLESALE'
            : saleType === 'DISTRIBUTOR'
            ? 'DISTRIBUTOR'
            : 'WALK_IN'
        }
      />

      {/* 8. Flow Checkout Payment Popup Modal */}
      <PaymentCheckoutModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        subtotal={subtotal}
        discountAmount={discountAmount}
        totalAmount={grandTotal}
        saleType={saleType}
        selectedCustomer={selectedCustomer}
        onOpenCustomerModal={() => {
          setIsPaymentModalOpen(false);
          setIsCustomerModalOpen(true);
        }}
        onConfirmSale={handleConfirmCheckout}
        isProcessing={isCheckingOut}
      />

      {/* 9. Sale Success & Printable Receipt Modal */}
      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        invoice={completedInvoice}
        branch={activeBranch}
        cashierName={currentUser?.name || 'Admin'}
        onStartNewSale={() => {
          setIsReceiptModalOpen(false);
          handleClearCart();
        }}
      />

      {/* 9. Held Sales Management Modal */}
      <HeldSalesModal
        isOpen={isHeldSalesModalOpen}
        onClose={() => setIsHeldSalesModalOpen(false)}
        heldSales={heldSales}
        onResumeSale={handleResumeSale}
        onDeleteHeldSale={(id) => deleteHeldSaleMutation(id)}
      />

      {/* 10. POS Settings Modal */}
      {posSettings && (
        <POSSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={posSettings}
          branches={branches}
          isSuperAdmin={isSuperAdmin}
          onSave={(updated) => updateSettings(updated)}
        />
      )}

      {/* 11. New Sale Confirmation Modal */}
      <NewSaleConfirmModal
        isOpen={isNewSaleConfirmOpen}
        onClose={() => setIsNewSaleConfirmOpen(false)}
        onHoldAndStartNew={async () => {
          setIsNewSaleConfirmOpen(false);
          await handleHoldSale();
        }}
        onDiscardAndStartNew={() => {
          setIsNewSaleConfirmOpen(false);
          handleClearCart();
        }}
      />
    </div>
  );
}

export default POSContent;
