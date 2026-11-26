'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import { useAppSelector, RootState } from '@/store';
import { useCreateStockReceiptMutation } from '@/store/services/inventoryApi';
import {
  useGetSkusQuery,
  useGetSkuByIdQuery,
  useGetBranchesQuery,
} from '@/store/services/catalogueApi';
import { rankSearchResults } from '@/utils/searchRanker';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  PackagePlus,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Boxes,
  Search,
  X,
  Package,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Building2,
} from 'lucide-react';

interface ReceivingItem {
  id: string;
  sku: string;
  productName: string;
  posDisplayName?: string;
  brandName?: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  currentStock: number;
  quantity: number | '';
  unitCost?: number;
}

function StockReceivingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSku = searchParams.get('sku') || '';

  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Optimized branch resolution
  const { data: allBranches = [] } = useGetBranchesQuery(undefined, { skip: !isSuperAdmin });
  const duraBranch = useMemo(() => {
    return (
      allBranches.find(
        (b: any) =>
          b.name?.toLowerCase().includes('dura') ||
          b.code?.toLowerCase().includes('312')
      ) || allBranches[0]
    );
  }, [allBranches]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentUser?.assignedBranchId || ''
  );

  useEffect(() => {
    if (isSuperAdmin && !selectedBranchId && duraBranch?.id) {
      setSelectedBranchId(duraBranch.id);
    }
  }, [isSuperAdmin, selectedBranchId, duraBranch]);

  const activeBranchId = isSuperAdmin
    ? selectedBranchId || duraBranch?.id
    : currentUser?.assignedBranchId;

  // If page was opened with ?sku=... from Stock Balances, fetch that exact SKU directly
  const { data: initialSkuResponse, isLoading: isInitialSkuLoading } = useGetSkuByIdQuery(paramSku, {
    skip: !paramSku,
  });

  // Selected Products to Add
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Top Search Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 200ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for search suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-load all active SKUs strictly for the selected branch
  const { data: allSkusData, isLoading: isCatalogueLoading, refetch: refetchCatalogue } = useGetSkusQuery(
    {
      all: true,
      status: 'ACTIVE',
      ...(activeBranchId ? { branchId: activeBranchId } : {}),
    },
    {
      skip: isSuperAdmin && !activeBranchId,
    }
  );

  const rawCatalogue = useMemo(() => {
    if (Array.isArray(allSkusData?.data)) return allSkusData.data;
    if (Array.isArray((allSkusData as any)?.items)) return (allSkusData as any).items;
    return [];
  }, [allSkusData]);

  // Normalized catalogue items exactly matching Stock Balance page
  const allCatalogueSkus = useMemo(() => {
    return rawCatalogue.map((item: any) => {
      const productName =
        item.productName ||
        item.product?.name ||
        item.productId?.name ||
        item.sku;
      const posDisplayName =
        item.posDisplayName ||
        item.productId?.posDisplayName ||
        '';
      const productLineName =
        item.productLineName ||
        item.productLine?.name ||
        (typeof item.productLineId === 'object' ? item.productLineId?.name : '') ||
        item.product?.productLineName ||
        '';
      const brandName =
        item.brand?.name ||
        item.brandName ||
        item.productId?.brandId?.name ||
        'MoltyFoam';
      const brandId = String(item.brandId || item.brand?._id || item.brand?.id || item.productId?.brandId?._id || item.productId?.brandId || '');
      const sizeLabel =
        item.size?.displayLabel ||
        item.sizeLabel ||
        (item.size?.length && item.size?.width ? `${item.size.length} × ${item.size.width}` : 'Standard');
      const thicknessLabel =
        item.thickness?.displayLabel ||
        item.thicknessLabel ||
        (item.thickness?.value ? `${item.thickness.value}"` : '');

      const onHand = Number(item.onHand ?? item.stock ?? 0);
      const reserved = Number(item.reserved ?? 0);
      const available = item.available !== undefined ? Number(item.available) : Math.max(0, onHand - reserved);
      const reorderLevel = Number(item.reorderLevel ?? item.minimumStock ?? 1);

      return {
        ...item,
        productName,
        posDisplayName,
        productLineName,
        brandName,
        brandId,
        sizeLabel,
        thicknessLabel,
        onHand,
        reserved,
        available,
        reorderLevel,
      };
    });
  }, [rawCatalogue]);

  // High-performance 0ms In-Memory Search with posDisplayName + productLineName First Priority!
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return rankSearchResults(allCatalogueSkus, searchQuery, 15);
  }, [allCatalogueSkus, searchQuery]);

  // Auto-load paramSku when initialSkuResponse arrives
  useEffect(() => {
    if (initialSkuResponse?.data) {
      const v = initialSkuResponse.data as any;
      const sku = v.sku;
      const productName = v.product?.name || v.productName || sku;
      const posDisplayName = v.posDisplayName || '';
      const brandName = v.product?.brandId?.name || v.brandName || v.brand?.name || 'MoltyFoam';
      const sizeLabel = v.size?.displayLabel || v.sizeLabel || (v.size ? `${v.size.length} × ${v.size.width}` : 'Standard');
      const thicknessLabel = v.thickness?.displayLabel || v.thicknessLabel || (v.thickness?.value ? `${v.thickness.value}"` : '');
      const currentStock = Number(v.stock ?? v.onHand ?? 0);

      setItems((prev) => {
        // If already in list, do not overwrite
        if (prev.some((p) => p.sku === sku)) return prev;
        return [
          {
            id: `${sku}-${Date.now()}`,
            sku,
            productName,
            posDisplayName,
            brandName,
            sizeLabel,
            thicknessLabel,
            currentStock,
            quantity: 5,
          },
          ...prev,
        ];
      });
    }
  }, [initialSkuResponse]);

  // Add a product selected from the search dropdown
  const handleSelectProduct = (skuItem: any) => {
    const sku = skuItem.sku;
    const productName = skuItem.productName || skuItem.product?.name || sku;
    const posDisplayName = skuItem.posDisplayName || '';
    const brandName = skuItem.brand?.name || skuItem.brandName || 'MoltyFoam';
    const sizeLabel = skuItem.size?.displayLabel || skuItem.sizeLabel || (skuItem.size ? `${skuItem.size.length} × ${skuItem.size.width}` : 'Standard');
    const thicknessLabel = skuItem.thickness?.displayLabel || skuItem.thicknessLabel || (skuItem.thickness?.value ? `${skuItem.thickness.value}"` : '');
    const currentStock = Number(skuItem.onHand ?? skuItem.stock ?? 0);

    setItems((prev) => {
      const existing = prev.find((p) => p.sku === sku);
      if (existing) {
        // If already selected, increase quantity by 1
        return prev.map((p) => (p.sku === sku ? { ...p, quantity: (Number(p.quantity) || 0) + 1 } : p));
      }
      return [
        {
          id: `${sku}-${Date.now()}`,
          sku,
          productName,
          posDisplayName,
          brandName,
          sizeLabel,
          thicknessLabel,
          currentStock,
          quantity: 5,
        },
        ...prev,
      ];
    });

    setSearchQuery('');
    setDebouncedSearch('');
    setIsDropdownOpen(false);
  };

  // Stepper & Quantity Handlers
  const handleQuantityChange = (id: string, rawVal: string) => {
    if (rawVal === '') {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: '' } : i)));
      return;
    }
    const parsed = parseInt(rawVal, 10);
    if (!isNaN(parsed)) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, parsed) } : i)));
    }
  };

  const handleQuantityBlur = (id: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const q = typeof i.quantity === 'number' ? i.quantity : 0;
        return { ...i, quantity: q >= 1 ? q : 1 };
      })
    );
  };

  const stepQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const current = typeof i.quantity === 'number' ? i.quantity : 0;
        return { ...i, quantity: Math.max(1, current + delta) };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Mutation
  const [createStockReceipt, { isLoading: isSubmitting }] = useCreateStockReceiptMutation();

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Koi product add nahi kiya',
        message: 'Stock add karne k liye pehle search bar se kam az kam aik product add karein.',
      });
      return;
    }

    try {
      const payload = {
        branchId: activeBranchId,
        supplierReference: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          sku: i.sku,
          quantityReceived: Math.max(1, Number(i.quantity) || 1),
          unitCost: i.unitCost && i.unitCost > 0 ? Number(i.unitCost) * 100 : undefined,
        })),
      };

      await createStockReceipt(payload).unwrap();

      // Silently refresh current catalogue immediately so autocomplete has updated stock without page refresh
      refetchCatalogue();

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Stock Added Successfully!',
        message: `Total ${totalUnits} units stock me kamyabi se shamil ho gaye hain.`,
      });

      // Clear form
      setReferenceNumber('');
      setNotes('');
      setItems([]);
    } catch (err: unknown) {
      const msg =
        (err as any)?.data?.error?.message ||
        (err as any)?.data?.message ||
        (err as Error).message ||
        'Stock add karne me error aaya';
      setToast({
        id: 'rcv-error',
        type: 'error',
        title: 'Stock Addition Failed',
        message: msg,
      });
    }
  };

  const totalUnits = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  return (
    <AppLayout
      title="Add Stock"
      subtitle="Quickly add new stock to your branch inventory"
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Add Stock to Inventory
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Search products, enter inward quantities, and confirm. Stock updates instantly with full audit trail.
              </p>
            </div>
          </div>

          <Link
            href="/inventory/stock"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-sm font-semibold rounded-xl shadow-2xs transition-all shrink-0"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            <span>View Stock Balances</span>
          </Link>
        </div>

        {/* Destination Branch Selector for Super Admin */}
        {isSuperAdmin && allBranches.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label
                htmlFor="rcv-branch-select"
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                <Building2 className="w-4 h-4 text-brand-blue" />
                <span>Destination Branch (Receiving Stock Into) *</span>
              </label>
              <p className="text-xs text-slate-500">
                Stock will be added strictly to this branch's inventory and catalogue.
              </p>
            </div>
            <select
              id="rcv-branch-select"
              value={activeBranchId || ''}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setItems([]);
              }}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:border-brand-blue cursor-pointer"
            >
              {allBranches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Search Bar to Add Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Search Product to Add
          </label>
          <div ref={searchContainerRef} className="relative w-full">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search product by Name, SKU, Brand, or Size (e.g. Molty Topper, 78x72, Bravo)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setIsDropdownOpen(true);
                }}
                className="w-full pl-12 pr-12 py-3.5 text-sm sm:text-base bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-slate-900 transition-all placeholder:text-slate-400 shadow-2xs"
              />
              {isCatalogueLoading && allCatalogueSkus.length === 0 && (
                <div className="absolute right-11 pointer-events-none">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-blue" />
                </div>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearch('');
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {isDropdownOpen && searchQuery.trim() && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500 font-semibold px-4">
                  <span>Matching Products ({searchResults.length})</span>
                  <span className="text-[11px] text-slate-400">Click to add to list</span>
                </div>
                {isCatalogueLoading && allCatalogueSkus.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-brand-blue" />
                    Searching catalogue...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    <Package className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                    No products matching &quot;<strong className="text-slate-800">{searchQuery}</strong>&quot;
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {searchResults.map((item: any) => {
                      const onHand = Number(item.onHand ?? item.stock ?? 0);
                      const isAlreadyAdded = items.some((p) => p.sku === item.sku);

                      return (
                        <li key={item.id || item._id || item.sku}>
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(item)}
                            className="w-full text-left p-3.5 px-4 hover:bg-blue-50/60 transition-colors flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 text-brand-blue flex items-center justify-center shrink-0">
                                <Plus className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                {/* <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-blue">
                                  {item.productName || item.product?.name || item.sku}
                                </p> */}
                                {item.posDisplayName && (
                                  <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-blue">{item.posDisplayName}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                  {/* <span className="font-mono text-[11px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.sku}
                                  </span>
                                  <span>•</span> */}
                                  <span>{item.brand?.name || item.brandName || 'Molty'}</span>
                                  <span>•</span>
                                  <span>{item.size?.displayLabel || item.sizeLabel || 'Standard'}</span>
                                  {item.thickness?.displayLabel && (
                                    <>
                                      <span>•</span>
                                      <span>{item.thickness.displayLabel}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {/* <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Current: {onHand} in stock
                              </span> */}
                              <span className="px-2 py-0.5 text-[14px] rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {onHand}
                              </span>
                              {isAlreadyAdded ? (
                                <span className="text-xs font-bold text-brand-blue bg-blue-50 px-2 py-0.5 rounded">
                                  Added (+1)
                                </span>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-blue transition-colors" />
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected Products Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Card Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Selected Products to Add
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-brand-blue">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-brand-rose whitespace-nowrap"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Items List */}
            <div className="p-5 space-y-4">
              {isInitialSkuLoading && items.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-blue" />
                  Loading selected product from catalogue...
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl p-6">
                  <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No products added yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Search any product using the search box above to add it to this receiving batch.
                  </p>
                </div>
              ) : (
                items.map((item, index) => {
                  const newStockPreview = item.currentStock + (Number(item.quantity) || 0);

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-all space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Number badge & Product Details */}
                        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                          {/* <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                            {index + 1}
                          </span> */}

                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-sm sm:text-base truncate">
                              {item.productName}
                            </p>
                            {item.posDisplayName && (
                              <p className="text-xs text-brand-blue font-medium">{item.posDisplayName}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                              {/* <span className="font-mono text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                {item.sku}
                              </span> */}
                              {item.brandName && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  {item.brandName}
                                </span>
                              )}
                              {item.sizeLabel && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  Size: {item.sizeLabel}
                                </span>
                              )}
                              {item.thicknessLabel && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  Thick: {item.thicknessLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quantity Counter & Remove */}
                        <div className="flex items-center gap-4 shrink-0 self-end lg:self-center">
                          <div>
                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">
                              Quantity
                            </span>
                            <div className="flex items-center border border-slate-300 rounded-xl bg-white shadow-2xs overflow-hidden">
                              <button
                                type="button"
                                onClick={() => stepQuantity(item.id, -1)}
                                className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                onBlur={() => handleQuantityBlur(item.id)}
                                className="w-16 py-2 text-center text-sm font-bold text-slate-900 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => stepQuantity(item.id, 1)}
                                className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="mt-4 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Live Stock Comparison */}
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500">
                          Current Stock: <strong className="text-slate-800">{item.currentStock}</strong>
                        </span>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            After Inward: {newStockPreview} units
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Optional Details (Invoice Ref & Notes) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              Optional Details (Challan / Invoice / Notes)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="receiving-ref-input"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Invoice / Challan Reference #
                </label>
                <input
                  id="receiving-ref-input"
                  type="text"
                  placeholder="e.g. FACTORY-CHALLAN-9021"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="receiving-notes-input"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Notes / Remarks
                </label>
                <input
                  id="receiving-notes-input"
                  type="text"
                  placeholder="e.g. Direct factory delivery verified"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:border-brand-blue text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Bottom Confirmation Bar */}
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center font-bold text-base shrink-0">
                {totalUnits}
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total Items to Inward</span>
                <span className="text-sm font-bold text-slate-900">
                  {totalUnits} {totalUnits === 1 ? 'unit' : 'units'} across {items.length} {items.length === 1 ? 'product' : 'products'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => router.push('/inventory/stock')}
                className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-hover rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
}

export default function StockReceivingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 font-medium">
          Loading Add Stock page...
        </div>
      }
    >
      <StockReceivingContent />
    </Suspense>
  );
}
