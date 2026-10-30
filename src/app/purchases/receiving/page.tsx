'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetGoodsReceiptsQuery,
  useGetPurchaseOrdersQuery,
  useGetStockLocationsQuery,
  useReceiveGoodsMutation,
} from '@/store/services/apiSlice';
import { hasPermission } from '@/lib/permissions';
import { GoodsReceiptNote } from '@/types';
import {
  ArrowDownToLine,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  Printer,
  X,
} from 'lucide-react';

function GoodsReceivingContent() {
  const searchParams = useSearchParams();
  const preselectedPoId = searchParams?.get('poId');

  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: grns = [], isLoading: isGRNsLoading } = useGetGoodsReceiptsQuery();
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery();
  const { data: stockLocations = [] } = useGetStockLocationsQuery();
  const [receiveGoodsMutation, { isLoading: isReceiving }] = useReceiveGoodsMutation();

  const canReceive = hasPermission(currentUser, 'purchases.receive');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(() => Boolean(preselectedPoId));
  const [selectedPOId, setSelectedPOId] = useState<string>(() => preselectedPoId || '');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successGRN, setSuccessGRN] = useState<GoodsReceiptNote | null>(null);

  // Line item receiving quantities: key = sku
  const [receivingQuantities, setReceivingQuantities] = useState<
    Record<string, { received: number; damaged: number; batch?: string }>
  >({});

  // View GRN details modal
  const [viewingGRN, setViewingGRN] = useState<GoodsReceiptNote | null>(null);

  // Filter state for GRN history
  const [searchQuery, setSearchQuery] = useState('');

  // Eligible POs for receiving (APPROVED or PARTIALLY_RECEIVED)
  const eligiblePOs = useMemo(() => {
    return purchaseOrders.filter(
      (p) => p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED'
    );
  }, [purchaseOrders]);

  // Selected PO object
  const activePO = useMemo(() => {
    return eligiblePOs.find((p) => p.id === selectedPOId) || null;
  }, [eligiblePOs, selectedPOId]);

  const handleSelectPO = (poId: string) => {
    setSelectedPOId(poId);
    const target = eligiblePOs.find((p) => p.id === poId);
    if (target) {
      setDestinationLocationId(target.destinationLocationId);
      const initial: Record<string, { received: number; damaged: number; batch?: string }> = {};
      target.items.forEach((item) => {
        const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity);
        initial[item.sku] = { received: remaining, damaged: 0, batch: '' };
      });
      setReceivingQuantities(initial);
    } else {
      setReceivingQuantities({});
    }
  };

  // Locations for active PO's branch
  const availableLocations = useMemo(() => {
    if (!activePO) return [];
    return stockLocations.filter(
      (loc) => loc.branchId === activePO.destinationBranchId && loc.isActive
    );
  }, [stockLocations, activePO]);

  // Filtered GRNs
  const filteredGRNs = useMemo(() => {
    return grns.filter((g) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          g.grnNumber.toLowerCase().includes(q) ||
          g.poNumber.toLowerCase().includes(q) ||
          g.supplierName.toLowerCase().includes(q) ||
          g.deliveryReference.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [grns, searchQuery]);

  const handleSubmitReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!activePO) {
      setErrorMessage('Please select a purchase order.');
      return;
    }

    if (!deliveryReference.trim()) {
      setErrorMessage('Supplier delivery reference / DC number is required.');
      return;
    }

    const itemsToSubmit = activePO.items
      .map((item) => {
        const entry = receivingQuantities[item.sku] || { received: 0, damaged: 0 };
        return {
          sku: item.sku,
          receivedQuantity: Number(entry.received) || 0,
          damagedQuantity: Number(entry.damaged) || 0,
          batchNumber: entry.batch?.trim() || undefined,
        };
      })
      .filter((i) => i.receivedQuantity > 0 || i.damagedQuantity > 0);

    if (itemsToSubmit.length === 0) {
      setErrorMessage('Please enter at least one item with received quantity > 0.');
      return;
    }

    // Over-receiving validation
    for (const item of activePO.items) {
      const remaining = item.orderedQuantity - item.receivedQuantity;
      const entering = receivingQuantities[item.sku]?.received || 0;
      if (entering > remaining) {
        setErrorMessage(
          `Over-receiving prevented: You entered ${entering} units for ${item.sku}, but only ${remaining} remain unreceived on this PO.`
        );
        return;
      }
    }

    try {
      const res = await receiveGoodsMutation({
        poId: activePO.id,
        deliveryReference: deliveryReference.trim(),
        destinationLocationId: destinationLocationId || activePO.destinationLocationId,
        receivedDate,
        receivedBy: currentUser?.name || 'Warehouse Staff',
        notes: notes.trim() || undefined,
        items: itemsToSubmit,
      }).unwrap();

      setSuccessGRN(res.grn);
      setIsModalOpen(false);
      // Reset
      setSelectedPOId('');
      setDeliveryReference('');
      setNotes('');
    } catch (err: unknown) {
      setErrorMessage((err as { data?: string })?.data || 'Failed to process goods receipt.');
    }
  };

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Goods Receiving (GRN)</h1>
            <p className="text-sm text-slate-500 mt-1">
              Verify incoming mattress deliveries, inspect stock, and update physical store inventory
            </p>
          </div>

          {canReceive && (
            <button
              onClick={() => {
                setSuccessGRN(null);
                setErrorMessage(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Receive New Shipment</span>
            </button>
          )}
        </div>

        {/* Success Banner */}
        {successGRN && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold text-sm">
                  Shipment received successfully under {successGRN.grnNumber}!
                </span>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Stock has been deposited into {successGRN.locationName || successGRN.branchName}. Inventory balances and movements updated.
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewingGRN(successGRN)}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              View / Print GRN
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search GRN #, PO #, supplier name, delivery reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
            />
          </div>
        </div>

        {/* GRN History Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Goods Receipt History</h2>
            <span className="text-xs text-slate-500">{filteredGRNs.length} GRNs processed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">GRN Number</th>
                  <th className="py-3 px-4">PO Reference</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Receiving Branch & Location</th>
                  <th className="py-3 px-4">Received Date</th>
                  <th className="py-3 px-4 text-center">Items Received</th>
                  <th className="py-3 px-4 text-right">Received By</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {isGRNsLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading goods receipts...
                    </td>
                  </tr>
                ) : filteredGRNs.length > 0 ? (
                  filteredGRNs.map((grn) => {
                    const totalQty = grn.items.reduce((s, i) => s + i.receivedQuantity, 0);

                    return (
                      <tr key={grn.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => setViewingGRN(grn)}
                            className="font-semibold text-brand-burgundy hover:underline text-left"
                          >
                            {grn.grnNumber}
                          </button>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Ref: {grn.deliveryReference}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                          {grn.poNumber}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-900">{grn.supplierName}</span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <span>{grn.branchName}</span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {grn.locationName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {grn.receivedDate}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            {totalQty} units ({grn.items.length} SKUs)
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right text-slate-600">
                          {grn.receivedBy}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setViewingGRN(grn)}
                            className="p-1.5 text-slate-500 hover:text-brand-burgundy hover:bg-slate-100 rounded-md transition-colors"
                            title="View GRN"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No goods receipt notes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Receive Goods Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Receive Stock from Purchase Order</h2>
                <p className="text-xs text-slate-500">Record physical goods receiving against an approved PO</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReceiving} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select PO */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Purchase Order <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={selectedPOId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="">Select an approved order...</option>
                    {eligiblePOs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} — {p.supplierName} ({p.destinationBranchName}) [Status: {p.status}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delivery Reference */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Note / DC Reference <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DC-99823 or Bilty #..."
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Receiving Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Received Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Destination Location */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receiving Location
                  </label>
                  <select
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                  >
                    {availableLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                  <input
                    type="text"
                    placeholder="Seal number, driver name, condition..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>
              </div>

              {/* Items receiving table */}
              {activePO && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    Verify Quantities for {activePO.poNumber}
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3 text-center">Ordered</th>
                        <th className="py-2 px-3 text-center">Prev. Received</th>
                        <th className="py-2 px-3 text-center">Remaining</th>
                        <th className="py-2 px-3 w-28 text-center">Receive Now</th>
                        <th className="py-2 px-3 w-28 text-center">Damaged</th>
                        <th className="py-2 px-3 w-28">Batch / Serial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activePO.items.map((item) => {
                        const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity);
                        const current = receivingQuantities[item.sku] || { received: 0, damaged: 0 };

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-800 block">{item.sku}</span>
                              <span className="text-[11px] text-slate-500">{item.productName}</span>
                            </td>
                            <td className="py-2 px-3 text-center font-medium">{item.orderedQuantity}</td>
                            <td className="py-2 px-3 text-center text-slate-500">{item.receivedQuantity}</td>
                            <td className="py-2 px-3 text-center font-semibold text-brand-burgundy">
                              {remaining}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={remaining}
                                value={current.received}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setReceivingQuantities((prev) => ({
                                    ...prev,
                                    [item.sku]: { ...prev[item.sku], received: val },
                                  }));
                                }}
                                className="w-20 px-2 py-1 text-center bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-burgundy"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                value={current.damaged}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setReceivingQuantities((prev) => ({
                                    ...prev,
                                    [item.sku]: { ...prev[item.sku], damaged: val },
                                  }));
                                }}
                                className="w-16 px-2 py-1 text-center bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-burgundy"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder="Batch..."
                                value={current.batch || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceivingQuantities((prev) => ({
                                    ...prev,
                                    [item.sku]: { ...prev[item.sku], batch: val },
                                  }));
                                }}
                                className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-burgundy"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReceiving || !activePO}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{isReceiving ? 'Receiving...' : 'Post Goods Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View GRN Modal */}
      {viewingGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{viewingGRN.grnNumber}</h2>
                <p className="text-xs text-slate-500">PO #{viewingGRN.poNumber} • DC Ref: {viewingGRN.deliveryReference}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                  title="Print"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewingGRN(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Supplier:</span>
                <span className="font-semibold text-slate-800">{viewingGRN.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Received At:</span>
                <span className="font-semibold text-slate-800">
                  {viewingGRN.branchName} ({viewingGRN.locationName})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Date Received:</span>
                <span className="font-semibold text-slate-800">{viewingGRN.receivedDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Received By:</span>
                <span className="font-semibold text-slate-800">{viewingGRN.receivedBy}</span>
              </div>
            </div>

            {/* GRN Items */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2 px-3">SKU / Item</th>
                    <th className="py-2 px-3 text-center">Ordered</th>
                    <th className="py-2 px-3 text-center">Received</th>
                    <th className="py-2 px-3 text-right">Unit Cost</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingGRN.items.map((i, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-800 block">{i.productName}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{i.sku}</span>
                      </td>
                      <td className="py-2 px-3 text-center">{i.orderedQuantity}</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-700">
                        {i.receivedQuantity}
                      </td>
                      <td className="py-2 px-3 text-right">Rs. {i.unitCost.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right font-semibold">
                        Rs. {i.lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingGRN(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function GoodsReceivingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Goods Receiving Module...
        </div>
      }
    >
      <GoodsReceivingContent />
    </Suspense>
  );
}
