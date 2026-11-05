'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { useAppSelector } from '@/store';
import {
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
  useGetBranchesQuery as useGetBackendBranchesQuery,
  useGetPOSCatalogueQuery as useGetBackendPOSCatalogueQuery,
  useGetHeldSalesQuery as useGetBackendHeldSalesQuery,
  useHoldSaleMutation as useHoldSaleBackendMutation,
  useDeleteHeldSaleMutation as useDeleteHeldSaleBackendMutation,
  useCompleteCheckoutMutation as useCompleteBackendCheckoutMutation,
} from '@/store/services/posApi';
import {
  useGetBrandsQuery as useGetBackendBrandsQuery,
  useGetCategoriesQuery as useGetBackendCategoriesQuery,
  useGetSizesQuery as useGetBackendSizesQuery,
  useGetThicknessesQuery as useGetBackendThicknessesQuery,
  useGetProductsQuery as useGetBackendProductsQuery,
  useGetSkusQuery as useGetBackendSkusQuery,
} from '@/store/services/catalogueApi';
import {
  useGetStockBalancesQuery as useGetBackendStockBalancesQuery,
} from '@/store/services/inventoryApi';
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

function computeDefaultDueDate(days: number = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function POSContent() {
  const router = useRouter();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const isBackendMode = process.env.NEXT_PUBLIC_DATA_MODE === 'backend';

  // Demo Queries
  const { data: demoBranches = [] } = useGetBranchesQuery(undefined, { skip: isBackendMode });
  const { data: demoBrands = [] } = useGetBrandsQuery(undefined, { skip: isBackendMode });
  const { data: demoCategories = [] } = useGetCategoriesQuery(undefined, { skip: isBackendMode });
  const { data: demoSizes = [] } = useGetSizesQuery(undefined, { skip: isBackendMode });
  const { data: demoThicknesses = [] } = useGetThicknessesQuery(undefined, { skip: isBackendMode });
  const { data: demoProducts = [] } = useGetCatalogueProductsQuery(undefined, { skip: isBackendMode });
  const { data: demoVariants = [] } = useGetProductVariantsQuery(undefined, { skip: isBackendMode });
  const { data: demoInventoryBalances = [] } = useGetInventoryBalancesQuery(undefined, { skip: isBackendMode });
  const { data: posSettings } = useGetPOSSettingsQuery();
  const { data: demoHeldSales = [] } = useGetHeldSalesQuery(undefined, { skip: isBackendMode });

  // Backend Queries
  const { data: backendBranches = [] } = useGetBackendBranchesQuery(undefined, { skip: !isBackendMode });
  const { data: backendBrands = [] } = useGetBackendBrandsQuery(undefined, { skip: !isBackendMode });
  const { data: backendCategories = [] } = useGetBackendCategoriesQuery(undefined, { skip: !isBackendMode });
  const { data: backendSizes = [] } = useGetBackendSizesQuery(undefined, { skip: !isBackendMode });
  const { data: backendThicknesses = [] } = useGetBackendThicknessesQuery(undefined, { skip: !isBackendMode });
  const { data: backendProducts = [] } = useGetBackendProductsQuery(undefined, { skip: !isBackendMode });
  const { data: backendSkusResponse } = useGetBackendSkusQuery(undefined, { skip: !isBackendMode });
  const { data: backendStockBalances = [] } = useGetBackendStockBalancesQuery(undefined, { skip: !isBackendMode });
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

  const isCheckingOut = isBackendMode ? isBackendCheckingOut : isDemoCheckingOut;

  // Unified Data
  const branches: Branch[] = useMemo(() => {
    const raw = Array.isArray(backendBranches) ? backendBranches : (backendBranches as any)?.data || demoBranches || [];
    return (Array.isArray(raw) ? raw : []).map((b: any) => ({
      ...b,
      id: String(b.id || b._id || ''),
    })) as Branch[];
  }, [backendBranches]);

  const brands: Brand[] = useMemo(() => {
    const raw = Array.isArray(backendBrands) ? backendBrands : (backendBrands as any)?.data || demoBrands || [];
    return (Array.isArray(raw) ? raw : []).map((b: any) => ({
      ...b,
      id: String(b.id || b._id || ''),
    })) as Brand[];
  }, [backendBrands]);

  const categories: Category[] = useMemo(() => {
    const raw = Array.isArray(backendCategories) ? backendCategories : (backendCategories as any)?.data || demoCategories || [];
    return (Array.isArray(raw) ? raw : []).map((c: any) => ({
      ...c,
      id: String(c.id || c._id || ''),
      brandId: String(c.brandId?._id || c.brandId || c.brand?._id || c.brand?.id || ''),
    })) as Category[];
  }, [backendCategories]);

  const sizes: MattressSize[] = useMemo(() => {
    const raw = Array.isArray(backendSizes) ? backendSizes : (backendSizes as any)?.data || demoSizes || [];
    return (Array.isArray(raw) ? raw : []).map((s: any) => ({
      ...s,
      id: String(s.id || s._id || ''),
    })) as MattressSize[];
  }, [backendSizes]);

  const thicknesses: MattressThickness[] = useMemo(() => {
    const raw = Array.isArray(backendThicknesses) ? backendThicknesses : (backendThicknesses as any)?.data || demoThicknesses || [];
    return (Array.isArray(raw) ? raw : []).map((t: any) => ({
      ...t,
      id: String(t.id || t._id || ''),
    })) as MattressThickness[];
  }, [backendThicknesses]);
  
  const rawProducts = isBackendMode
    ? (Array.isArray(backendProducts)
        ? backendProducts
        : (backendProducts as any)?.data || (backendProducts as any)?.items || [])
    : demoProducts;
  const products: CatalogueProduct[] = useMemo(() => {
    const list = Array.isArray(rawProducts) ? rawProducts : [];
    return list.map((p: any) => ({
      ...p,
      id: String(p.id || p._id || ''),
      brandId: String(p.brandId?._id || p.brandId || p.brand?._id || p.brand?.id || ''),
      categoryId: String(p.categoryId?._id || p.categoryId || p.category?._id || p.category?.id || ''),
      code: p.code || `${p.brand?.code || 'MF'}-${p.category?.code || 'CAT'}`.toUpperCase(),
      name: p.name || 'Unnamed Product',
      status: p.status || 'ACTIVE',
    })) as CatalogueProduct[];
  }, [rawProducts]);

  const rawVariants = isBackendMode
    ? (Array.isArray(backendSkusResponse)
        ? backendSkusResponse
        : (backendSkusResponse as any)?.data || (backendSkusResponse as any)?.items || [])
    : demoVariants;
  const variants: ProductVariant[] = useMemo(() => {
    const list = Array.isArray(rawVariants) ? rawVariants : [];
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
  }, [rawVariants]);

  // Active Branch Resolution
  const activeBranch = useMemo(() => {
    if (isSuperAdmin && (posSettings?.selectedBranchId || posSettings?.branchId)) {
      const targetId = posSettings?.selectedBranchId || posSettings?.branchId;
      const found = branches.find((b) => b.id === targetId);
      if (found) return found;
    }
    const userBranchId = currentUser?.assignedBranchId || currentUser?.branchId;
    if (userBranchId) {
      const found = branches.find((b) => b.id === userBranchId);
      if (found) return found;
    }
    return branches[0] || null;
  }, [branches, currentUser, posSettings, isSuperAdmin]);

  const isRetailAllowed = activeBranch?.settings?.allowRetailSales ?? true;

  const rawStock = isBackendMode
    ? (Array.isArray(backendStockBalances)
        ? backendStockBalances
        : (backendStockBalances as any)?.items || (backendStockBalances as any)?.data || [])
    : demoInventoryBalances;
  const inventoryBalances: InventoryBalance[] = useMemo(() => {
    const list = Array.isArray(rawStock) ? rawStock : [];
    const directBalances: InventoryBalance[] = list.map((b: any) => ({
      id: String(b.id || b._id || ''),
      sku: b.sku || '',
      branchId: String(b.branchId?._id || b.branchId || ''),
      stockLocationId: String(b.stockLocationId?._id || b.stockLocationId || 'LOC-FLOOR'),
      productId: String(b.variant?.productId?._id || b.variant?.productId || b.productId || ''),
      variantId: String(b.variantId?._id || b.variantId || b.variant?._id || b.variant?.id || b.sku || ''),
      productName: b.variant?.productId?.name || b.productName || '',
      brandName: b.variant?.productId?.brandId?.name || b.brandName || '',
      categoryName: b.variant?.productId?.categoryId?.name || b.categoryName || '',
      sizeLabel: b.variant?.sizeId?.displayLabel || b.sizeLabel || '',
      thicknessInches: Number(b.variant?.thicknessId?.value || b.thicknessInches || 0),
      onHand: Number(b.onHand || 0),
      reserved: Number(b.reserved || 0),
      available: Number(b.available || 0),
      reorderLevel: Number(b.reorderLevel || 5),
      stockStatus: (Number(b.available || 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK') as any,
      updatedAt: b.updatedAt || new Date().toISOString(),
    }));

    // Ensure all variants have a balance entry even if stock API didn't report them
    const variantIdSet = new Set(directBalances.map((b) => b.variantId));
    const fallbackBalances: InventoryBalance[] = variants
      .filter((v) => !variantIdSet.has(v.id))
      .map((v) => ({
        id: `synth-${v.id}`,
        sku: v.sku,
        branchId: activeBranch?.id || '',
        stockLocationId: 'LOC-FLOOR',
        productId: v.productId,
        variantId: v.id,
        productName: v.productName || '',
        brandName: v.brandName || '',
        categoryName: v.categoryName || '',
        sizeLabel: v.sizeLabel || '',
        thicknessInches: 0,
        onHand: Number(v.stock ?? (v as any).onHand ?? 0),
        reserved: 0,
        available: Number(v.stock ?? (v as any).onHand ?? 0),
        reorderLevel: 5,
        stockStatus: (Number(v.stock ?? (v as any).onHand ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK') as any,
        updatedAt: new Date().toISOString(),
      }));

    return [...directBalances, ...fallbackBalances];
  }, [rawStock, variants, activeBranch?.id]);

  const rawHeld = isBackendMode
    ? (Array.isArray(backendHeldSales) ? backendHeldSales : (backendHeldSales as any)?.data || [])
    : demoHeldSales;
  const heldSales: HeldSale[] = (Array.isArray(rawHeld) ? rawHeld : []) as HeldSale[];

  // Filtered inventory balances for active branch
  const branchBalances = useMemo(() => {
    if (!activeBranch) return inventoryBalances;
    return inventoryBalances.filter(
      (b) => !b.branchId || b.branchId === activeBranch.id || b.id.startsWith('synth-')
    );
  }, [inventoryBalances, activeBranch]);

  // Selected Brand and Category States
  // Selected Brand and Category States (Only Created Real Data)
  const [chosenBrandId, setChosenBrandId] = useState<string | null>(null);
  const selectedBrandId = useMemo(() => {
    if (chosenBrandId && brands.some((b) => b.id === chosenBrandId)) {
      return chosenBrandId;
    }
    // Prefer first brand that has active products
    const brandWithProducts = brands.find((b) =>
      products.some((p) => p.brandId === b.id && p.status === 'ACTIVE')
    );
    if (brandWithProducts) return brandWithProducts.id;
    return brands[0]?.id || '';
  }, [chosenBrandId, brands, products]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [enteredAmountReceived, setEnteredAmountReceived] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Modal States
  const [configModalProduct, setConfigModalProduct] = useState<CatalogueProduct | null>(null);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
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

  // Brand products count helper
  const brandProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (Array.isArray(products)) {
      products.forEach((p) => {
        if (p.status === 'ACTIVE' && p.brandId) {
          counts[p.brandId] = (counts[p.brandId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [products]);

  // Variant Stock Map
  const variantStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    variants.forEach((v) => {
      const balance = branchBalances.find((b) => b.variantId === v.id);
      const stock = balance?.available ?? v.stock ?? (v as any).onHand ?? 0;
      map[v.id] = Math.max(0, stock);
    });
    return map;
  }, [variants, branchBalances]);

  // Brand Stock Map (sum of variant stock for each brand)
  const brandStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.status !== 'ACTIVE' || !p.brandId) return;
      const pVariants = variants.filter((v) => v.productId === p.id && v.status === 'ACTIVE');
      const pStock = pVariants.reduce((sum, v) => sum + (variantStockMap[v.id] || 0), 0);
      map[p.brandId] = (map[p.brandId] || 0) + pStock;
    });
    return map;
  }, [products, variants, variantStockMap]);

  // Category Stock Map (sum of variant stock for each category within active brand)
  const categoryStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.status !== 'ACTIVE' || !p.categoryId) return;
      if (p.brandId !== selectedBrandId) return;
      const pVariants = variants.filter((v) => v.productId === p.id && v.status === 'ACTIVE');
      const pStock = pVariants.reduce((sum, v) => sum + (variantStockMap[v.id] || 0), 0);
      map[p.categoryId] = (map[p.categoryId] || 0) + pStock;
    });
    return map;
  }, [products, variants, variantStockMap, selectedBrandId]);

  // Category products count helper
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (Array.isArray(products)) {
      products.forEach((p) => {
        if (p.brandId === selectedBrandId && p.status === 'ACTIVE' && p.categoryId) {
          counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [products, selectedBrandId]);

  // Filter products strictly by Brand, Category, and Search
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (p.brandId !== selectedBrandId) return false;
      if (selectedCategoryId !== 'ALL' && p.categoryId !== selectedCategoryId) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesDesc = (p.description || '').toLowerCase().includes(query);
        const matchesCode = (p.code || '').toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesCode) return false;
      }
      return true;
    });
  }, [products, selectedBrandId, selectedCategoryId, searchQuery]);

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

  // Complete Sale (F5) Handler
  const handleCompleteSale = async () => {
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

    // Customer requirement check:
    // Wholesale, Distributor, or Partial/Credit arrangement MUST have an identified customer account
    const requiresCustomer =
      paymentArrangement !== 'FULL' ||
      saleType === 'WHOLESALE' ||
      saleType === 'DISTRIBUTOR';

    if (requiresCustomer && !selectedCustomer) {
      alert(
        `${saleType} and Partial/Credit sales require an identified customer account. Please select or create a customer.`
      );
      setIsCustomerModalOpen(true);
      return;
    }

    // Calculate effective received & outstanding
    const effectivePaid =
      paymentArrangement === 'FULL'
        ? grandTotal
        : paymentArrangement === 'CREDIT'
        ? 0
        : Math.min(grandTotal, amountReceived);

    const outstanding = Math.max(0, grandTotal - effectivePaid);
    const changeAmount =
      paymentArrangement === 'FULL'
        ? Math.max(0, amountReceived - grandTotal)
        : 0;

    // Credit limit check
    if (outstanding > 0 && selectedCustomer) {
      const availCredit = Math.max(
        0,
        selectedCustomer.creditLimit - selectedCustomer.currentOutstanding
      );
      if (outstanding > availCredit && !creditOverride) {
        alert(
          `Credit limit exceeded for ${selectedCustomer.name}. Available credit: Rs. ${availCredit.toLocaleString()}, required: Rs. ${outstanding.toLocaleString()}. Please authorize supervisor override to proceed.`
        );
        return;
      }
    }

    try {
      if (isBackendMode) {
        const result = await completeCheckoutBackendMutation({
          branchId: activeBranch.id || (activeBranch as any)._id,
          customerId: selectedCustomer?.id || (selectedCustomer as any)?._id,
          customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Retail Customer',
          customerPhone: selectedCustomer ? selectedCustomer.phone : '0300-1234567',
          customerType: selectedCustomer?.customerType || (saleType === 'WALK_IN' ? 'WALK_IN' : saleType),
          saleType,
          paymentArrangement,
          paymentMethod: paymentArrangement === 'CREDIT' ? 'CREDIT_30D' : (paymentMethod as any),
          discountAmount,
          amountReceived: effectivePaid,
          cashReceived: effectivePaid,
          dueDate: outstanding > 0 ? dueDate : undefined,
          creditOverride,
          creditApprovedBy: creditOverride ? (currentUser?.name || 'Supervisor') : undefined,
          overrideReason: creditOverride ? 'Supervisor override' : undefined,
          items: cartItems.map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes: `${saleType} Sale - ${paymentArrangement} Arrangement`,
        }).unwrap();

        const inv: any = result.invoice;
        const normalizedInvoice: Invoice = {
          ...inv,
          id: String(inv.id || inv._id || ''),
          invoiceNumber: inv.invoiceNumber,
          branchId: String(activeBranch?.id || inv.branchId || ''),
          branchName: activeBranch?.name || inv.branchName || 'Main Branch',
          customerName: inv.customerName,
          customerPhone: inv.customerPhone,
          grossAmount: inv.subtotal ?? inv.grossAmount ?? inv.total ?? 0,
          subtotal: inv.subtotal ?? inv.grossAmount ?? inv.total ?? 0,
          discountAmount: inv.discount ?? inv.discountAmount ?? 0,
          netAmount: inv.total ?? inv.netAmount ?? inv.grandTotal ?? 0,
          grandTotal: inv.total ?? inv.grandTotal ?? inv.netAmount ?? 0,
          amountPaid: inv.paidAmount ?? inv.amountPaid ?? inv.amountReceived ?? 0,
          amountReceived: inv.paidAmount ?? inv.amountReceived ?? 0,
          amountDue: inv.balanceDue ?? inv.amountDue ?? 0,
          changeAmount: inv.changeReturned ?? inv.changeAmount ?? 0,
          paymentStatus: inv.paymentStatus || 'PAID',
          paymentMethod: inv.paymentArrangement || inv.paymentMethod || 'CASH',
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

        setCompletedInvoice(normalizedInvoice);
        setIsReceiptModalOpen(true);
        handleClearCart();

        if (posSettings?.autoPrintReceipt) {
          setTimeout(() => {
            window.print();
          }, 300);
        }
        return;
      }

      const result = await completeCheckoutMutation({
        branchId: activeBranch.id,
        cashierId: currentUser?.id || 'USR-ADMIN-01',
        cashierName: currentUser?.name || 'Admin',
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Retail Customer',
        customerPhone: selectedCustomer ? selectedCustomer.phone : '0300-1234567',
        customerId: selectedCustomer?.id,
        saleType,
        appliedPriceList: saleType,
        paymentArrangement,
        dueDate: outstanding > 0 ? dueDate : undefined,
        creditOverride,
        creditApprovedBy: creditOverride ? (currentUser?.name || 'Supervisor') : undefined,
        paymentMethod: paymentArrangement === 'CREDIT' ? 'CREDIT_30D' : paymentMethod,
        discountAmount,
        subtotal,
        taxAmount: 0,
        grandTotal,
        amountReceived: effectivePaid,
        changeAmount,
        items: cartItems.map((item) => ({
          sku: item.sku,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: `${saleType} Sale - ${paymentArrangement} Arrangement`,
      }).unwrap();

      // Show receipt modal and clear active cart
      setCompletedInvoice(result.invoice);
      setIsReceiptModalOpen(true);
      handleClearCart();

      // Auto-prompt print if enabled in settings
      if (posSettings?.autoPrintReceipt) {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (err: any) {
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

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f6fa] overflow-hidden font-sans select-none">
      {/* 1. Top Header */}
      <POSHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeBranch={activeBranch}
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
        branches={branches}
        isSuperAdmin={isSuperAdmin}
        onBranchChange={(newBranchId) => {
          updateSettings({ selectedBranchId: newBranchId, branchId: newBranchId });
        }}
        saleType={saleType}
        onChangeSaleType={handleRequestSaleTypeChange}
      />

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
        recommendedType={
          saleType === 'WHOLESALE'
            ? 'WHOLESALE'
            : saleType === 'DISTRIBUTOR'
            ? 'DISTRIBUTOR'
            : 'WALK_IN'
        }
      />

      {/* 8. Sale Success & Printable Receipt Modal */}
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
