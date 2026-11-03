'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetProductVariantsQuery,
  useReceiveStockMutation,
  useCreateOpeningStockMutation,
  useGetStockMovementsQuery,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches, hasPermission } from '@/lib/permissions';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  ArrowDownToLine,
  Layers,
  Plus,
  Trash2,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';

interface ReceivingLineItem {
  id: string;
  sku: string;
  quantity: number;
  unitCost?: number;
}

export default function StockReceivingPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const canReceive = hasPermission(currentUser, 'inventory:manage') || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'INVENTORY_OFFICER';

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const { data: stockLocations = [] } = useGetStockLocationsQuery();
  const { data: variants = [] } = useGetProductVariantsQuery();

  const [mode, setMode] = useState<'receiving' | 'opening'>('receiving');

  // Form State
  const [destinationBranchId, setDestinationBranchId] = useState<string>(
    authorizedBranches[0]?.id || 'BR-MAIN-01'
  );
  const [destinationLocationId, setDestinationLocationId] = useState<string>('LOC-MAIN-01');
  const [supplierName, setSupplierName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Items List
  const [items, setItems] = useState<ReceivingLineItem[]>([
    { id: '1', sku: 'DURA-LUX-7872-T6', quantity: 10, unitCost: 28000 },
  ]);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Mutations
  const [receiveStockMutation, { isLoading: isReceiving }] = useReceiveStockMutation();
  const [createOpeningStockMutation, { isLoading: isOpeningStock }] = useCreateOpeningStockMutation();

  // Recent movements for receipt history
  const { data: recentMovements = [] } = useGetStockMovementsQuery({
    movementType: mode === 'receiving' ? 'STOCK_RECEIPT' : 'OPENING_BALANCE',
  });

  // Filter locations for selected branch
  const availableLocations = stockLocations.filter(
    (l) => l.branchId === destinationBranchId && l.isActive
  );

  // Add Item Line
  const handleAddItem = () => {
    const defaultVariant = variants[0]?.sku || 'DURA-LUX-7872-T6';
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sku: defaultVariant,
        quantity: 5,
        unitCost: undefined,
      },
    ]);
  };

  // Remove Item Line
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'At least one item required',
        message: 'A receiving document must contain at least one line item.',
      });
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update Item Line
  const handleUpdateItem = (id: string, field: keyof ReceivingLineItem, value: string | number | undefined) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canReceive) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Access Denied',
        message: 'You lack authorization to process stock receiving.',
      });
      return;
    }

    if (items.length === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Empty items',
        message: 'Please add at least one line item.',
      });
      return;
    }

    // Validation
    for (const item of items) {
      if (!item.sku) {
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Invalid SKU',
          message: 'All line items must have a valid SKU selected.',
        });
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Invalid quantity',
          message: `Quantity for SKU ${item.sku} must be a positive integer.`,
        });
        return;
      }
    }

    try {
      if (mode === 'receiving') {
        const res = await receiveStockMutation({
          destinationBranchId,
          destinationLocationId,
          supplierName: supplierName.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          receivedBy: currentUser?.name || 'Authorized Staff',
          items: items.map((i) => ({
            sku: i.sku,
            quantity: i.quantity,
            unitCost: i.unitCost && i.unitCost > 0 ? i.unitCost : undefined,
          })),
        }).unwrap();

        setToast({
          id: Date.now().toString(),
          type: 'success',
          title: 'Stock Received Successfully',
          message: `Generated Goods Receipt Note #${res.receiptNumber}. Inventory balances updated immediately.`,
        });

        // Reset fields
        setSupplierName('');
        setReferenceNumber('');
        setNotes('');
        setItems([{ id: Date.now().toString(), sku: 'DURA-LUX-7872-T6', quantity: 5 }]);
      } else {
        // Opening stock mode
        const res = await createOpeningStockMutation({
          branchId: destinationBranchId,
          stockLocationId: destinationLocationId,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          createdBy: currentUser?.name || 'Super Admin',
          items: items.map((i) => ({
            sku: i.sku,
            openingQuantity: i.quantity,
            unitCost: i.unitCost && i.unitCost > 0 ? i.unitCost : undefined,
          })),
        }).unwrap();

        setToast({
          id: Date.now().toString(),
          type: 'success',
          title: 'Opening Balances Initialized',
          message: `Opening stock document #${res.referenceNumber} recorded. Traceable opening balances locked in ledger.`,
        });

        setReferenceNumber('');
        setNotes('');
        setItems([{ id: 'open-item-1', sku: 'DURA-LUX-7872-T6', quantity: 10 }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Error occurred while saving stock entry';
      setToast({
        id: 'rcv-post-error',
        type: 'error',
        title: 'Posting Failed',
        message: msg,
      });
    }
  };

  const totalUnits = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const estimatedCost = items.reduce(
    (acc, curr) => acc + (Number(curr.quantity) || 0) * (Number(curr.unitCost) || 0),
    0
  );

  return (
    <AppLayout title="Stock Receiving & Opening Stock" subtitle="Goods Receipt Note (GRN) & Initial Balances">
      <InventoryNavTabs branchId={destinationBranchId} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Workflow Mode Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-5 pt-3 rounded-t-xl border border-gray-200/80 shadow-2xs">
          <button
            onClick={() => setMode('receiving')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              mode === 'receiving'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Stock Receiving (Purchase / Inward Goods)</span>
          </button>

          <button
            onClick={() => setMode('opening')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              mode === 'opening'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Opening Stock Balance Entry</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200/80 shadow-xs space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {mode === 'receiving' ? 'New Goods Receipt Note (GRN)' : 'Opening Balance Initialization Sheet'}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {mode === 'receiving'
                  ? 'Record factory deliveries, wholesale consignments, and replenishment shipments.'
                  : 'Establish initial opening stock for a location. Note: Each SKU/location can only be initialized once.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Destination & Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/80 p-4 rounded-xl border border-gray-200/60">
                {/* Branch */}
                <div>
                  <label htmlFor="receiving-branch-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Destination Branch *
                  </label>
                  <select
                    id="receiving-branch-select"
                    value={destinationBranchId}
                    onChange={(e) => {
                      setDestinationBranchId(e.target.value);
                      const locs = stockLocations.filter((l) => l.branchId === e.target.value);
                      if (locs[0]) setDestinationLocationId(locs[0].id);
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-gray-900"
                  >
                    {authorizedBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.shopNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock Location */}
                <div>
                  <label htmlFor="receiving-location-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Target Stockroom / Bay *
                  </label>
                  <select
                    id="receiving-location-select"
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-gray-900"
                  >
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier (Receiving mode) */}
                {mode === 'receiving' && (
                  <div>
                    <label htmlFor="receiving-supplier-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Supplier / Factory Consignor
                    </label>
                    <input
                      id="receiving-supplier-input"
                      type="text"
                      placeholder="e.g. Molty Master Plant #2, Lahore"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                    />
                  </div>
                )}

                {/* Delivery / DC Reference */}
                <div>
                  <label htmlFor="receiving-reference-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    {mode === 'receiving' ? 'Delivery Challan / Invoice #' : 'Audited Opening Ref #'}
                  </label>
                  <input
                    id="receiving-reference-input"
                    type="text"
                    placeholder={mode === 'receiving' ? 'e.g. DC-98421 or BATCH-A' : 'e.g. AUDIT-2026-OB'}
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  />
                </div>
              </div>

              {/* Multi-Line Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Line Items to Inward ({items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-blue hover:text-brand-blue-hover hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another SKU</span>
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Catalogue SKU</th>
                        <th className="py-2.5 px-3">Specification</th>
                        <th className="py-2.5 px-3 w-28 text-center">Quantity *</th>
                        <th className="py-2.5 px-3 w-36">Unit Cost (PKR)</th>
                        <th className="py-2.5 px-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => {
                        const variant = variants.find((v) => v.sku === item.sku);

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50">
                            {/* SKU Select */}
                            <td className="py-2.5 px-3">
                              <select
                                aria-label="Select variant SKU"
                                value={item.sku}
                                onChange={(e) => handleUpdateItem(item.id, 'sku', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-white border border-gray-300 rounded-md focus:outline-hidden focus:border-brand-blue"
                              >
                                {variants
                                  .filter((v) => v.status === 'ACTIVE')
                                  .map((v) => (
                                    <option key={v.id} value={v.sku}>
                                      {v.sku}
                                    </option>
                                  ))}
                              </select>
                            </td>

                            {/* Specification Preview */}
                            <td className="py-2.5 px-3">
                              <p className="text-xs font-semibold text-gray-900 truncate max-w-[200px]">
                                {variant?.productName || 'Mattress'}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {variant?.sizeLabel} • {variant?.thicknessLabel}
                              </p>
                            </td>

                            {/* Quantity */}
                            <td className="py-2.5 px-3">
                              <input
                                aria-label="Item quantity"
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                                }
                                className="w-full px-2.5 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:outline-hidden focus:border-brand-blue"
                              />
                            </td>

                            {/* Unit Cost */}
                            <td className="py-2.5 px-3">
                              <input
                                aria-label="Item unit cost"
                                type="number"
                                min="0"
                                placeholder="Optional cost"
                                value={item.unitCost ?? ''}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.id,
                                    'unitCost',
                                    e.target.value ? parseFloat(e.target.value) : undefined
                                  )
                                }
                                className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md focus:outline-hidden focus:border-brand-blue"
                              />
                            </td>

                            {/* Remove Row */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                title="Remove item"
                                className="text-gray-400 hover:text-red-600 p-1 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="receiving-notes-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Document Notes & Vehicle Info
                </label>
                <textarea
                  id="receiving-notes-input"
                  rows={2}
                  placeholder="e.g. Delivery truck #KHI-9421, seal intact, packaging inspected."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>

              {/* Submit Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Total Units: <span className="font-bold text-gray-900 text-sm">{totalUnits}</span>
                  {estimatedCost > 0 && (
                    <span className="ml-3">
                      Est. Valuation: <span className="font-bold text-gray-900">PKR {estimatedCost.toLocaleString()}</span>
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isReceiving || isOpeningStock}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors ${
                    mode === 'receiving'
                      ? 'bg-brand-blue hover:bg-brand-blue-hover'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>
                    {isReceiving || isOpeningStock
                      ? 'Processing Stock Entry...'
                      : mode === 'receiving'
                      ? 'Confirm & Post Goods Receipt'
                      : 'Confirm & Lock Opening Balance'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar Feed: Recent Receipts & Guidance */}
          <div className="space-y-5">
            {/* Guidance Alert */}
            <div className="bg-blue-50/80 p-5 rounded-xl border border-blue-200/80 text-xs space-y-2">
              <div className="flex items-center gap-2 text-brand-blue font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Inventory Accounting Policy</span>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Stock receiving increases local inventory balances immediately upon posting and writes an immutable entry into the movement ledger.
              </p>
              <p className="text-gray-600 leading-relaxed font-semibold">
                Stock receiving and transfers never inflate retail/wholesale sales revenue.
              </p>
            </div>

            {/* Recent Receipts List */}
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">
                  Recent {mode === 'receiving' ? 'Receipts' : 'Opening Balances'}
                </h3>
                <span className="text-[11px] font-semibold text-gray-500">
                  {recentMovements.length} logged
                </span>
              </div>

              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {recentMovements.slice(0, 6).map((mov) => (
                  <div key={mov.id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-gray-800">{mov.documentReference}</span>
                      <span className="font-bold text-emerald-600">+{mov.quantity} units</span>
                    </div>
                    <p className="text-gray-600 font-medium mt-0.5">{mov.sku}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      By {mov.createdBy} • {new Date(mov.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
