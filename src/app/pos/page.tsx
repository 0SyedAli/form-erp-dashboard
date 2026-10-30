'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
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
  CatalogueProduct,
  POSCartItem,
  PaymentMethod,
  HeldSale,
  Invoice,
  SaleType,
  PaymentArrangement,
  Customer,
} from '@/types';
import { STORAGE_KEYS } from '@/lib/demo-db/schema';
import { demoStorage } from '@/lib/demo-db/storage';
import POSHeader from '@/components/pos/POSHeader';
import SaleTypeSelector from '@/components/pos/SaleTypeSelector';
import RepriceConfirmModal from '@/components/pos/RepriceConfirmModal';
import POSCustomerModal from '@/components/pos/POSCustomerModal';
import BrandSelector from '@/components/pos/BrandSelector';
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

  // API Queries
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: sizes = [] } = useGetSizesQuery();
  const { data: thicknesses = [] } = useGetThicknessesQuery();
  const { data: products = [] } = useGetCatalogueProductsQuery();
  const { data: variants = [] } = useGetProductVariantsQuery();
  const { data: inventoryBalances = [] } = useGetInventoryBalancesQuery();
  const { data: posSettings } = useGetPOSSettingsQuery();
  const { data: heldSales = [] } = useGetHeldSalesQuery();

  // Mutations
  const [updateSettings] = useUpdatePOSSettingsMutation();
  const [holdSaleMutation] = useHoldSaleMutation();
  const [deleteHeldSaleMutation] = useDeleteHeldSaleMutation();
  const [completeCheckoutMutation, { isLoading: isCheckingOut }] =
    useCompletePOSCheckoutMutation();

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
    return branches.find((b) => b.id === 'BR-MAIN-01') || branches[0] || null;
  }, [branches, currentUser, posSettings, isSuperAdmin]);

  const isRetailAllowed = activeBranch?.settings?.allowRetailSales ?? true;

  // Filtered inventory balances for active branch
  const branchBalances = useMemo(() => {
    if (!activeBranch) return inventoryBalances;
    return inventoryBalances.filter((b) => b.branchId === activeBranch.id);
  }, [inventoryBalances, activeBranch]);

  // Selected Brand and Category States
  const [chosenBrandId, setChosenBrandId] = useState<string | null>(null);
  const selectedBrandId = useMemo(() => {
    if (chosenBrandId && brands.some((b) => b.id === chosenBrandId)) {
      return chosenBrandId;
    }
    const dura = brands.find((b) => b.code === 'DURA');
    return dura ? dura.id : brands[0]?.id || 'BRAND-DURA';
  }, [chosenBrandId, brands]);

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

  // Active brand object
  const currentBrand = useMemo(() => {
    return brands.find((b) => b.id === selectedBrandId) || brands[0];
  }, [brands, selectedBrandId]);

  // Filter categories by selected brand
  const brandCategories = useMemo(() => {
    return categories.filter(
      (c) => c.brandId === selectedBrandId && c.status === 'ACTIVE'
    );
  }, [categories, selectedBrandId]);

  // Brand products count helper
  const brandProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.status === 'ACTIVE') {
        counts[p.brandId] = (counts[p.brandId] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Category products count helper
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.brandId === selectedBrandId && p.status === 'ACTIVE') {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [products, selectedBrandId]);

  // Filter products by Brand, Category, and Search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (p.brandId !== selectedBrandId) return false;
      if (selectedCategoryId !== 'ALL' && p.categoryId !== selectedCategoryId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesDesc = (p.description || '').toLowerCase().includes(query);
        const matchesCode = p.code.toLowerCase().includes(query);
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
    } catch (err) {
      alert(`Checkout failed: ${(err as Error).message}`);
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
    } catch (err) {
      alert(`Failed to hold sale: ${(err as Error).message}`);
    }
  };

  // Resume Held Sale Handler
  const handleResumeSale = (heldSale: HeldSale) => {
    setCartItems(heldSale.items);
    setDiscountAmount(heldSale.discountAmount || 0);
    deleteHeldSaleMutation(heldSale.id);
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
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden font-sans">
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
      />

      {/* 2. Flow 07 Sale Type Selector (Walk-in | Wholesale | Distributor) */}
      <SaleTypeSelector
        saleType={saleType}
        onChangeSaleType={handleRequestSaleTypeChange}
      />

      {/* 3. Main Body: Split into Left Selection Area (68-70%) & Right Cart (30-32%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Section: Brand Carousel + (Category Sidebar + Product Grid) */}
        <section className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Horizontal Brand Selector Cards */}
          <BrandSelector
            brands={brands}
            selectedBrandId={selectedBrandId}
            onSelectBrand={(id) => {
              setChosenBrandId(id);
              setSelectedCategoryId('ALL');
            }}
            brandProductCounts={brandProductCounts}
          />

          {/* Categories Sidebar + Product Cards Grid */}
          <div className="flex-1 flex overflow-hidden">
            <CategorySidebar
              categories={brandCategories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              categoryProductCounts={categoryProductCounts}
              totalAllCount={products.filter((p) => p.brandId === selectedBrandId).length}
            />

            <ProductGrid
              brandName={currentBrand?.name || 'Products'}
              products={filteredProducts}
              variants={variants}
              inventoryBalances={branchBalances}
              onSelectProduct={(product) => setConfigModalProduct(product)}
              selectedProductId={configModalProduct?.id}
              saleType={saleType}
            />
          </div>
        </section>

        {/* Right Section: Shopping Cart & Checkout Calculations */}
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

export default function POSPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-slate-900 flex items-center justify-center font-sans text-white text-sm">
          Loading Unified POS...
        </div>
      }
    >
      <POSContent />
    </Suspense>
  );
}
