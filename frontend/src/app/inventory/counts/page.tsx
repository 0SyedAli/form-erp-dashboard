'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetStockCountsQuery,
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetInventoryBalancesQuery,
  useCreateStockCountMutation,
  useUpdateStockCountItemsMutation,
  useReconcileAndPostStockCountMutation,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import { StockCount } from '@/types';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  ClipboardCheck,
  Plus,
  CheckCircle2,
  Save,
  Eye,
  X,
  FileCheck2,
} from 'lucide-react';

export default function StockCountsPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const { data: stockLocations = [] } = useGetStockLocationsQuery();

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    authorizedBranches[0]?.id || 'BR-MAIN-01'
  );

  // Active Count Session View
  const [activeSession, setActiveSession] = useState<StockCount | null>(null);
  const [sessionItemCounts, setSessionItemCounts] = useState<Record<string, number>>({});
  const [sessionItemNotes, setSessionItemNotes] = useState<Record<string, string>>({});

  // Modals
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isReconcileConfirmOpen, setIsReconcileConfirmOpen] = useState(false);
  const [selectedCountForView, setSelectedCountForView] = useState<StockCount | null>(null);

  // New Count Form State
  const [newCountLocationId, setNewCountLocationId] = useState<string>('LOC-MAIN-01');
  const [newCountNotes, setNewCountNotes] = useState<string>('');

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Queries & Mutations
  const { data: counts = [], isLoading: isCountsLoading } = useGetStockCountsQuery({
    branchId: selectedBranchId,
  });

  const { data: locationBalances = [] } = useGetInventoryBalancesQuery({
    stockLocationId: newCountLocationId,
  });

  const [createStockCountMutation, { isLoading: isStarting }] = useCreateStockCountMutation();
  const [updateStockCountItemsMutation, { isLoading: isSaving }] = useUpdateStockCountItemsMutation();
  const [reconcileAndPostStockCountMutation, { isLoading: isReconciling }] =
    useReconcileAndPostStockCountMutation();

  // Initialize counting session into workspace
  const handleOpenCountSheet = (count: StockCount) => {
    setActiveSession(count);
    const initialCounts: Record<string, number> = {};
    const initialNotes: Record<string, string> = {};
    count.items.forEach((item) => {
      initialCounts[item.sku] = item.physicalQuantity;
      initialNotes[item.sku] = item.notes || '';
    });
    setSessionItemCounts(initialCounts);
    setSessionItemNotes(initialNotes);
  };

  // Start New Count Session
  const handleStartCountSession = async (e: React.FormEvent) => {
    e.preventDefault();

    if (locationBalances.length === 0) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'No Balances in Location',
        message: 'The selected location has no existing inventory balances to audit.',
      });
      return;
    }

    try {
      const skusToAudit = locationBalances.map((b) => b.sku);
      const res = await createStockCountMutation({
        branchId: selectedBranchId,
        stockLocationId: newCountLocationId,
        skus: skusToAudit,
        notes: newCountNotes.trim() || undefined,
        countedBy: currentUser?.name || 'Stock Counter',
      }).unwrap();

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Count Session Initialized',
        message: `Audit session #${res.countNumber} opened for ${skusToAudit.length} SKUs.`,
      });

      setIsStartModalOpen(false);
      setNewCountNotes('');
      handleOpenCountSheet(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to start count session';
      setToast({
        id: 'count-init-error',
        type: 'error',
        title: 'Initialization Failed',
        message: msg,
      });
    }
  };

  // Save Progress
  const handleSaveProgress = async () => {
    if (!activeSession) return;

    try {
      const itemUpdates = activeSession.items.map((i) => ({
        sku: i.sku,
        physicalQuantity: sessionItemCounts[i.sku] ?? i.systemQuantity,
        notes: sessionItemNotes[i.sku]?.trim() || undefined,
      }));

      const updated = await updateStockCountItemsMutation({
        countId: activeSession.id,
        itemUpdates,
      }).unwrap();

      setActiveSession(updated);
      setToast({
        id: 'count-progress-saved',
        type: 'success',
        title: 'Count Progress Saved',
        message: `Physical quantities saved. Total variance: ${updated.totalDiscrepancy} units.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to update count progress';
      setToast({
        id: 'count-save-error',
        type: 'error',
        title: 'Save Failed',
        message: msg,
      });
    }
  };

  // Reconcile and Post Adjustments
  const handleConfirmReconciliation = async () => {
    if (!activeSession) return;

    try {
      // First save latest physical values
      await handleSaveProgress();

      // Post reconciliation
      const res = await reconcileAndPostStockCountMutation({
        countId: activeSession.id,
        approvedBy: currentUser?.name || 'Super Admin',
      }).unwrap();

      setToast({
        id: 'count-reconcile-success',
        type: 'success',
        title: 'Reconciliation Finalized & Posted',
        message: `Count #${res.count.countNumber} completed. ${res.movements.length} adjustment ledger movements posted.`,
      });

      setIsReconcileConfirmOpen(false);
      setActiveSession(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to finalize count reconciliation';
      setToast({
        id: 'count-reconcile-error',
        type: 'error',
        title: 'Reconciliation Failed',
        message: msg,
      });
    }
  };

  return (
    <AppLayout title="Stock Counting & Reconciliation" subtitle="Physical cycle counting, variance analysis & reconciliation">
      <InventoryNavTabs branchId={selectedBranchId} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Physical Stock Counting & Audit
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Verify floor inventory against system records, calculate variances, and post authorized ledger adjustments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Branch selector */}
            <select
              aria-label="Filter stock count by branch"
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setActiveSession(null);
              }}
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-hidden focus:border-brand-blue"
            >
              {authorizedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsStartModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Start Physical Count</span>
            </button>
          </div>
        </div>

        {/* Active Counting Sheet Workspace */}
        {activeSession && (
          <div className="bg-white p-6 rounded-xl border-2 border-brand-blue/30 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-brand-blue px-2.5 py-0.5 bg-blue-50 rounded-md">
                    {activeSession.countNumber}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      activeSession.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeSession.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mt-1">
                  Active Counting Sheet —{' '}
                  {stockLocations.find((l) => l.id === activeSession.stockLocationId)?.name}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveProgress}
                  disabled={isSaving || activeSession.status === 'COMPLETED'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg shadow-2xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Draft Count'}</span>
                </button>

                {activeSession.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => setIsReconcileConfirmOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Review & Reconcile Variances</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveSession(null)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Counting Table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Product Name & Size</th>
                    <th className="py-2.5 px-3 text-center">System On Hand</th>
                    <th className="py-2.5 px-3 w-32 text-center">Physical Count *</th>
                    <th className="py-2.5 px-3 text-center">Variance</th>
                    <th className="py-2.5 px-3">Count Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeSession.items.map((item) => {
                    const counted = sessionItemCounts[item.sku] ?? item.physicalQuantity;
                    const diff = counted - item.systemQuantity;

                    return (
                      <tr key={item.sku} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-800 text-xs">
                          {item.sku}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-gray-900 text-xs">{item.productName}</p>
                          <p className="text-[11px] text-gray-500">{item.sizeLabel} ({item.thicknessInches}&quot;)</p>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-gray-800 text-sm">
                          {item.systemQuantity}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            aria-label={`Physical count for ${item.sku}`}
                            type="number"
                            min="0"
                            disabled={activeSession.status === 'COMPLETED'}
                            value={counted}
                            onChange={(e) =>
                              setSessionItemCounts((prev) => ({
                                ...prev,
                                [item.sku]: Math.max(0, parseInt(e.target.value) || 0),
                              }))
                            }
                            className="w-24 px-2.5 py-1 text-center font-bold text-sm bg-white border border-gray-300 rounded-md focus:outline-hidden focus:border-brand-blue"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md ${
                              diff === 0
                                ? 'bg-gray-100 text-gray-700'
                                : diff > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            aria-label={`Notes for ${item.sku}`}
                            type="text"
                            placeholder="e.g. Scanned via barcode"
                            disabled={activeSession.status === 'COMPLETED'}
                            value={sessionItemNotes[item.sku] ?? ''}
                            onChange={(e) =>
                              setSessionItemNotes((prev) => ({
                                ...prev,
                                [item.sku]: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-hidden focus:border-brand-blue"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Existing Count Audits History */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Physical Stock Count Sessions</h3>
            <span className="text-xs text-gray-500">{counts.length} sessions recorded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Count Session #</th>
                  <th className="py-3 px-4">Stock Location</th>
                  <th className="py-3 px-4">Audited SKUs</th>
                  <th className="py-3 px-4 text-center">Discrepancy (Units)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Personnel</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isCountsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      Loading count sessions...
                    </td>
                  </tr>
                ) : counts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No stock counting sessions found for this branch. Click &ldquo;Start Physical Count&rdquo; to begin.
                    </td>
                  </tr>
                ) : (
                  counts.map((cnt) => {
                    const loc = stockLocations.find((l) => l.id === cnt.stockLocationId);
                    return (
                      <tr key={cnt.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-gray-900 text-xs">{cnt.countNumber}</span>
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            {new Date(cnt.countedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-800 text-xs">
                          {loc?.name || cnt.stockLocationId}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                          {cnt.items.length} mattress SKUs
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                              cnt.totalDiscrepancy === 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {cnt.totalDiscrepancy} units
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full ${
                              cnt.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {cnt.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          <p>Counted: <span className="font-medium text-gray-800">{cnt.countedBy}</span></p>
                          {cnt.approvedBy && (
                            <p className="text-[11px] text-emerald-700 font-medium">Reconciled: {cnt.approvedBy}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {cnt.status === 'IN_PROGRESS' ? (
                              <button
                                onClick={() => handleOpenCountSheet(cnt)}
                                className="px-3 py-1 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-semibold rounded-md shadow-2xs cursor-pointer"
                              >
                                Resume Count
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedCountForView(cnt)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Audit Summary</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Start Count Modal */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-blue" />
                <h3 className="font-bold text-gray-900 text-base">Initialize Cycle Count</h3>
              </div>
              <button onClick={() => setIsStartModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Select the stock location bay to freeze system quantities and generate a physical audit sheet.
            </p>

            <form onSubmit={handleStartCountSession} className="space-y-4 text-xs">
              <div>
                <label htmlFor="count-target-location-select" className="block font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Target Stock Location *
                </label>
                <select
                  id="count-target-location-select"
                  value={newCountLocationId}
                  onChange={(e) => setNewCountLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                >
                  {stockLocations
                    .filter((l) => l.branchId === selectedBranchId && l.isActive)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                </select>
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Found {locationBalances.length} SKU balances recorded at this location.
                </span>
              </div>

              <div>
                <label htmlFor="audit-scope-notes-input" className="block font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Audit Scope & Cycle Notes
                </label>
                <input
                  id="audit-scope-notes-input"
                  type="text"
                  placeholder="e.g. End of month mattress stock verification"
                  value={newCountNotes}
                  onChange={(e) => setNewCountNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(false)}
                  className="px-3.5 py-1.5 font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStarting}
                  className="px-4 py-1.5 bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold rounded-lg shadow-sm"
                >
                  {isStarting ? 'Generating...' : 'Open Count Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconciliation Confirmation Modal */}
      {isReconcileConfirmOpen && activeSession && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-gray-900 text-base">Reconcile & Finalize Count</h3>
            </div>

            <p className="text-gray-600">
              Confirming will automatically adjust on-hand balances for all items with discrepancies and write permanent adjustment records into the movement ledger.
            </p>

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 space-y-1">
              <div className="font-bold">Important Safeguard:</div>
              <p>Once finalized, this count session is locked and cannot be re-posted.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReconcileConfirmOpen(false)}
                className="px-3.5 py-1.5 font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmReconciliation}
                disabled={isReconciling}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                {isReconciling ? 'Posting Adjustments...' : 'Confirm & Post Reconciliation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Count View Modal */}
      {selectedCountForView && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden text-xs">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Audit Summary: {selectedCountForView.countNumber}</h3>
                <span className="text-[11px] text-gray-500">
                  Reconciled by {selectedCountForView.approvedBy} on {new Date(selectedCountForView.approvedAt || 0).toLocaleDateString()}
                </span>
              </div>
              <button onClick={() => setSelectedCountForView(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="p-2">SKU</th>
                      <th className="p-2 text-center">System</th>
                      <th className="p-2 text-center">Counted</th>
                      <th className="p-2 text-center">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedCountForView.items.map((i) => (
                      <tr key={i.sku}>
                        <td className="p-2 font-mono font-bold text-gray-800">{i.sku}</td>
                        <td className="p-2 text-center text-gray-600">{i.systemQuantity}</td>
                        <td className="p-2 text-center font-bold text-gray-900">{i.physicalQuantity}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`font-bold ${
                              i.variance === 0
                                ? 'text-gray-500'
                                : i.variance > 0
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            }`}
                          >
                            {i.variance > 0 ? `+${i.variance}` : i.variance}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedCountForView(null)}
                className="px-4 py-1.5 bg-gray-200 text-gray-800 font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
