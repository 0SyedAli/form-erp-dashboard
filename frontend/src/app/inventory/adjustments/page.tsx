'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetInventoryBalancesQuery,
  useAdjustStockMutation,
  useGetStockMovementsQuery,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import { StockAdjustmentReason, InventoryBalance } from '@/types';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  SlidersHorizontal,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  FileCheck,
} from 'lucide-react';

export default function StockAdjustmentsPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const { data: stockLocations = [] } = useGetStockLocationsQuery();

  const [activeTab, setActiveTab] = useState<'adjust' | 'quarantine'>('adjust');

  // Branch & Location filter
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    authorizedBranches[0]?.id || 'BR-MAIN-01'
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>('LOC-MAIN-01');

  // Adjustment Form State
  const [selectedSku, setSelectedSku] = useState<string>('DURA-LUX-7872-T6');
  const [adjustmentType, setAdjustmentType] = useState<StockAdjustmentReason>('PHYSICAL_CORRECTION');
  const [quantityDifference, setQuantityDifference] = useState<number>(-1);
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Queries
  const { data: branchBalances = [] } = useGetInventoryBalancesQuery({
    branchId: selectedBranchId,
    stockLocationId: selectedLocationId,
  });

  const { data: damagedBalances = [] } = useGetInventoryBalancesQuery({
    branchId: selectedBranchId,
  });

  const { data: adjustmentMovements = [] } = useGetStockMovementsQuery({
    branchId: selectedBranchId,
  });

  const [adjustStockMutation, { isLoading: isAdjusting }] = useAdjustStockMutation();

  // Find selected balance
  const activeBalance = branchBalances.find((b) => b.sku === selectedSku);
  const currentQuantity = activeBalance?.onHand ?? 0;
  const resultingQuantity = currentQuantity + quantityDifference;

  // Filter damaged locations & balances
  const damagedLocs = stockLocations.filter(
    (l) => l.branchId === selectedBranchId && l.type === 'RETURNS_DAMAGED'
  );
  const damagedLocIds = damagedLocs.map((l) => l.id);
  const quarantineStockItems = damagedBalances.filter((b) => damagedLocIds.includes(b.stockLocationId));

  // Locations for current branch
  const normalLocations = stockLocations.filter(
    (l) => l.branchId === selectedBranchId && l.type !== 'RETURNS_DAMAGED' && l.isActive
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Mandatory Reason Required',
        message: 'A detailed business reason is strictly mandatory for every stock adjustment.',
      });
      return;
    }

    if (quantityDifference === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Zero Difference',
        message: 'Quantity difference cannot be zero.',
      });
      return;
    }

    if (resultingQuantity < 0) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Stock Floor Exceeded',
        message: `Adjustment would reduce on-hand balance below zero (${resultingQuantity}).`,
      });
      return;
    }

    // Open confirmation dialog before posting
    setIsConfirmModalOpen(true);
  };

  const handleConfirmPost = async () => {
    try {
      const res = await adjustStockMutation({
        branchId: selectedBranchId,
        stockLocationId: selectedLocationId,
        sku: selectedSku,
        adjustmentType,
        quantityDifference,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        authorizedBy: currentUser?.name || 'Authorized Supervisor',
      }).unwrap();

      setToast({
        id: 'adj-success',
        type: 'success',
        title: 'Adjustment Ledger Recorded',
        message: `Adjustment #${res.adjustmentId} successfully posted. Balance updated to ${res.updatedBalance.onHand} units.`,
      });

      setIsConfirmModalOpen(false);
      setReason('');
      setNotes('');
      setQuantityDifference(-1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to adjust stock';
      setToast({
        id: 'adj-error',
        type: 'error',
        title: 'Adjustment Failed',
        message: msg,
      });
    }
  };

  // Inspect & Return Quarantine to Saleable Stock
  const handleReturnToSaleable = async (item: InventoryBalance) => {
    const saleableLocation = normalLocations[0]?.id || 'LOC-MAIN-01';
    try {
      await adjustStockMutation({
        branchId: item.branchId,
        stockLocationId: item.stockLocationId,
        sku: item.sku,
        adjustmentType: 'RETURN_TO_SALEABLE',
        quantityDifference: -item.onHand, // Remove from damaged
        reason: 'Passed technical QA inspection: Re-bagged and returned to saleable retail stockroom',
        authorizedBy: currentUser?.name || 'QA Inspector',
      }).unwrap();

      // Inward to saleable location
      await adjustStockMutation({
        branchId: item.branchId,
        stockLocationId: saleableLocation,
        sku: item.sku,
        adjustmentType: 'RETURN_TO_SALEABLE',
        quantityDifference: item.onHand, // Add to saleable
        reason: `Re-admitted from quarantine bay into saleable inventory`,
        authorizedBy: currentUser?.name || 'QA Inspector',
      }).unwrap();

      setToast({
        id: 'return-success',
        type: 'success',
        title: 'Returned to Saleable Stock',
        message: `${item.onHand} units of ${item.sku} returned to ${saleableLocation} after inspection.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to return stock';
      setToast({
        id: 'return-error',
        type: 'error',
        title: 'Operation Failed',
        message: msg,
      });
    }
  };

  return (
    <AppLayout title="Stock Adjustments" subtitle="Manual stock corrections, damage write-offs & quarantine management">
      <InventoryNavTabs branchId={selectedBranchId} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-white px-5 pt-3 rounded-t-xl border border-gray-200/80 shadow-2xs">
          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'adjust'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Stock Adjustment & Write-Offs</span>
          </button>

          <button
            onClick={() => setActiveTab('quarantine')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'quarantine'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Damaged & Quarantine Inspection Bay</span>
            {quarantineStockItems.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                {quarantineStockItems.reduce((s, i) => s + i.onHand, 0)} units
              </span>
            )}
          </button>
        </div>

        {activeTab === 'adjust' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Adjustment Form */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200/80 shadow-xs space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Post Audited Stock Adjustment</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Adjustments modify local quantities immediately and record an immutable ledger event with required user attribution.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Branch & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
                  <div>
                    <label htmlFor="adjust-branch-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Branch *
                    </label>
                    <select
                      id="adjust-branch-select"
                      value={selectedBranchId}
                      onChange={(e) => {
                        setSelectedBranchId(e.target.value);
                        const locs = stockLocations.filter((l) => l.branchId === e.target.value);
                        if (locs[0]) setSelectedLocationId(locs[0].id);
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                    >
                      {authorizedBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="adjust-location-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Stock Location *
                    </label>
                    <select
                      id="adjust-location-select"
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                    >
                      {stockLocations
                        .filter((l) => l.branchId === selectedBranchId && l.isActive)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.code})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* SKU Selection & Current Balance Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="adjust-sku-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Select SKU to Adjust *
                    </label>
                    <select
                      id="adjust-sku-select"
                      value={selectedSku}
                      onChange={(e) => setSelectedSku(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono font-semibold bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                    >
                      {branchBalances.map((b) => (
                        <option key={b.id} value={b.sku}>
                          {b.sku} — {b.productName} ({b.sizeLabel})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Current on Hand preview */}
                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-col justify-center">
                    <span className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider">
                      Current On Hand
                    </span>
                    <span className="text-xl font-bold text-brand-blue">{currentQuantity} units</span>
                  </div>
                </div>

                {/* Adjustment Type & Quantity Difference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="adjustment-type-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Adjustment Type *
                    </label>
                    <select
                      id="adjustment-type-select"
                      value={adjustmentType}
                      onChange={(e) => setAdjustmentType(e.target.value as StockAdjustmentReason)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                    >
                      <option value="PHYSICAL_CORRECTION">Physical Stock Correction</option>
                      <option value="DAMAGED_MATTRESS">Damaged Mattress (Quarantine Route)</option>
                      <option value="LOST_STOCK">Lost Stock / Shrinkage</option>
                      <option value="ADMINISTRATIVE">Administrative Entry Correction</option>
                      <option value="RETURN_TO_SALEABLE">Return to Saleable Stock</option>
                      <option value="OTHER">Other Approved Reason</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="quantity-diff-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Quantity Difference (+ / -) *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="quantity-diff-input"
                        type="number"
                        value={quantityDifference}
                        onChange={(e) => setQuantityDifference(parseInt(e.target.value) || 0)}
                        className={`w-full px-3 py-2 text-sm font-bold text-center border rounded-lg focus:outline-hidden focus:border-brand-blue ${
                          quantityDifference < 0
                            ? 'border-red-300 text-red-600 bg-red-50/30'
                            : 'border-emerald-300 text-emerald-600 bg-emerald-50/30'
                        }`}
                      />
                      <div className="text-xs text-gray-500 shrink-0">
                        &rarr; Result: <span className="font-bold text-gray-900">{resultingQuantity}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mandatory Reason */}
                <div>
                  <label htmlFor="audit-reason-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Mandatory Audit Reason *
                  </label>
                  <textarea
                    id="audit-reason-input"
                    rows={2}
                    required
                    placeholder="Provide a mandatory explanation (e.g. Unloading forklift torn packaging, barcode miscount cycle #14)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="authorized-officer-notes-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Internal Inspection Notes
                  </label>
                  <input
                    id="authorized-officer-notes-input"
                    type="text"
                    placeholder="Optional inspection ticket # or supervisor initial"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Review & Confirm Adjustment
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar: Recent Adjustments Feed */}
            <div className="space-y-5">
              <div className="bg-amber-50/80 p-5 rounded-xl border border-amber-200/80 text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Audit Policy</span>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  Stock balances must never silently change. Every adjustment creates a permanent audit movement linked to your user account.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Selecting <strong>Damaged Mattress</strong> writes off saleable units and places them into quarantine bay.
                </p>
              </div>

              {/* Recent Ledger Adjustments */}
              <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Recent Branch Adjustments</h3>
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {adjustmentMovements
                    .filter(
                      (m) =>
                        m.movementType === 'ADJUSTMENT_IN' ||
                        m.movementType === 'ADJUSTMENT_OUT' ||
                        m.movementType === 'DAMAGED_STOCK' ||
                        m.movementType === 'RETURN_TO_SALEABLE'
                    )
                    .slice(0, 5)
                    .map((mov) => (
                      <div key={mov.id} className="py-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-gray-800">{mov.documentReference}</span>
                          <span
                            className={`font-bold ${
                              mov.movementType === 'ADJUSTMENT_IN' || mov.movementType === 'RETURN_TO_SALEABLE'
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }`}
                          >
                            {mov.movementType === 'ADJUSTMENT_IN' ? `+${mov.quantity}` : `-${mov.quantity}`}
                          </span>
                        </div>
                        <p className="text-gray-600 font-medium mt-0.5 truncate">{mov.notes}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {mov.createdBy} • {new Date(mov.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Quarantine & Damaged Bay Management */
          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Damaged & Quarantine Inventory Area
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Items with packaging tears, transit friction, or returns awaiting physical inspection before resale or vendor claim.
                </p>
              </div>

              <div className="text-xs font-semibold text-rose-800 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                Total Segregated: {quarantineStockItems.reduce((s, i) => s + i.onHand, 0)} units
              </div>
            </div>

            {quarantineStockItems.length === 0 ? (
              <div className="py-16 text-center text-gray-500 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-gray-800">
                  No damaged or quarantine stock in this branch.
                </p>
                <p className="text-xs text-gray-400">
                  All inventory is saleable and ready for retail/wholesale orders.
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">SKU / Product</th>
                      <th className="py-3 px-4">Quarantine Bay</th>
                      <th className="py-3 px-4 text-center">Damaged Units</th>
                      <th className="py-3 px-4">Est. Cost</th>
                      <th className="py-3 px-4 text-right">Inspection Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quarantineStockItems.map((item) => (
                      <tr key={item.id} className="hover:bg-rose-50/20">
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-gray-900 text-xs">{item.sku}</p>
                          <p className="text-xs text-gray-600">{item.productName} ({item.sizeLabel})</p>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            {stockLocations.find((l) => l.id === item.stockLocationId)?.name || item.stockLocationId}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-rose-700 text-base">{item.onHand}</span>
                        </td>

                        <td className="py-3 px-4 text-xs text-gray-600">
                          {item.unitCost ? `PKR ${(item.unitCost * item.onHand).toLocaleString()}` : 'Unavailable'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleReturnToSaleable(item)}
                            disabled={isAdjusting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pass Inspection & Return to Saleable</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-brand-blue" />
              <h3 className="font-bold text-gray-900 text-base">Confirm Stock Adjustment</h3>
            </div>

            <p className="text-xs text-gray-600">
              Please review and confirm this irreversible stock adjustment for ledger posting:
            </p>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">SKU:</span>
                <span className="font-mono font-bold text-gray-900">{selectedSku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type:</span>
                <span className="font-semibold text-gray-800">{adjustmentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current On Hand:</span>
                <span className="font-bold text-gray-800">{currentQuantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Adjustment:</span>
                <span className={`font-bold ${quantityDifference < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {quantityDifference > 0 ? `+${quantityDifference}` : quantityDifference} units
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 font-bold">
                <span className="text-gray-700">New Balance:</span>
                <span className="text-brand-blue">{resultingQuantity} units</span>
              </div>
              <div className="pt-1 text-[11px] text-gray-500 italic">
                Reason: &ldquo;{reason}&rdquo;
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmPost}
                disabled={isAdjusting}
                className="px-4 py-1.5 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                {isAdjusting ? 'Posting...' : 'Confirm & Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
