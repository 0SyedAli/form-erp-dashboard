'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import InventoryNavTabs from '@/components/inventory/InventoryNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetStockTransfersQuery,
  useGetBranchesQuery,
  useGetStockLocationsQuery,
  useGetProductVariantsQuery,
  useGetInventoryBalancesQuery,
  useCreateStockTransferMutation,
  useApproveStockTransferMutation,
  useDispatchStockTransferMutation,
  useReceiveStockTransferMutation,
  useCancelStockTransferMutation,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import { StockTransfer, StockTransferStatus } from '@/types';
import Toast, { ToastMessage } from '@/components/common/Toast';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  Truck,
  XCircle,
  FileText,
  Eye,
  X,
  Trash2,
} from 'lucide-react';

export default function StockTransfersPage() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const { data: stockLocations = [] } = useGetStockLocationsQuery();
  const { data: variants = [] } = useGetProductVariantsQuery();

  const [statusFilter, setStatusFilter] = useState<StockTransferStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const branchFilter = isSuperAdmin ? 'all' : (currentUser?.assignedBranchId || 'all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTransferForDetails, setSelectedTransferForDetails] = useState<StockTransfer | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<StockTransfer | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Form State for New Transfer
  const [sourceBranchId, setSourceBranchId] = useState<string>(
    authorizedBranches[0]?.id || 'BR-MAIN-01'
  );
  const [sourceLocationId, setSourceLocationId] = useState<string>('LOC-MAIN-01');
  const [destBranchId, setDestBranchId] = useState<string>('BR-DISP-02');
  const [destLocationId, setDestLocationId] = useState<string>('LOC-DISP-01');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferItems, setTransferItems] = useState<Array<{ sku: string; requestedQuantity: number }>>([
    { sku: 'DURA-LUX-7872-T6', requestedQuantity: 3 },
  ]);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Queries & Mutations
  const { data: transfers = [], isLoading } = useGetStockTransfersQuery({
    branchId: branchFilter === 'all' ? undefined : branchFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search.trim() || undefined,
  });

  const { data: sourceBalances = [] } = useGetInventoryBalancesQuery({
    stockLocationId: sourceLocationId,
  });

  const [createStockTransferMutation, { isLoading: isCreating }] = useCreateStockTransferMutation();
  const [approveStockTransferMutation, { isLoading: isApproving }] = useApproveStockTransferMutation();
  const [dispatchStockTransferMutation, { isLoading: isDispatching }] = useDispatchStockTransferMutation();
  const [receiveStockTransferMutation, { isLoading: isReceiving }] = useReceiveStockTransferMutation();
  const [cancelStockTransferMutation, { isLoading: isCancelling }] = useCancelStockTransferMutation();

  // Helper locations
  const sourceAvailableLocations = stockLocations.filter(
    (l) => l.branchId === sourceBranchId && l.isActive
  );
  const destAvailableLocations = stockLocations.filter(
    (l) => l.branchId === destBranchId && l.isActive
  );

  // Stats calculation
  const totalTransfers = transfers.length;
  const pendingCount = transfers.filter((t) => t.status === 'PENDING_APPROVAL').length;
  const inTransitCount = transfers.filter((t) => t.status === 'DISPATCHED').length;
  const receivedCount = transfers.filter((t) => t.status === 'RECEIVED').length;

  // Add Item to Transfer
  const handleAddItem = () => {
    setTransferItems((prev) => [
      ...prev,
      { sku: variants[0]?.sku || 'DURA-LUX-7872-T6', requestedQuantity: 2 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (transferItems.length <= 1) {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Item Required',
        message: 'A transfer must contain at least one item.',
      });
      return;
    }
    setTransferItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: string | number) => {
    setTransferItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Submit New Transfer
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sourceLocationId === destLocationId) {
      setToast({
        id: 'xfer-loc-error',
        type: 'error',
        title: 'Validation Error',
        message: 'Source and destination locations cannot be identical.',
      });
      return;
    }

    try {
      const res = await createStockTransferMutation({
        sourceBranchId,
        sourceLocationId,
        destinationBranchId: destBranchId,
        destinationLocationId: destLocationId,
        items: transferItems,
        notes: transferNotes.trim() || undefined,
        requestedBy: currentUser?.name || 'Staff Member',
      }).unwrap();

      setToast({
        id: 'xfer-create-success',
        type: 'success',
        title: 'Transfer Request Created',
        message: `Transfer #${res.transferNumber} submitted for manager approval.`,
      });

      setIsCreateModalOpen(false);
      setTransferNotes('');
      setTransferItems([{ sku: 'DURA-LUX-7872-T6', requestedQuantity: 3 }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to create transfer';
      setToast({
        id: 'xfer-create-error',
        type: 'error',
        title: 'Creation Failed',
        message: msg,
      });
    }
  };

  // Approve Transfer
  const handleApprove = async (transferId: string) => {
    try {
      await approveStockTransferMutation({
        transferId,
        approvedBy: currentUser?.name || 'Authorized Manager',
      }).unwrap();

      setToast({
        id: 'xfer-approve-success',
        type: 'success',
        title: 'Transfer Approved',
        message: 'Transfer is now approved and ready for physical dispatch.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to approve transfer';
      setToast({
        id: 'xfer-approve-error',
        type: 'error',
        title: 'Approval Failed',
        message: msg,
      });
    }
  };

  // Dispatch Transfer
  const handleDispatch = async (transferId: string) => {
    try {
      await dispatchStockTransferMutation({
        transferId,
        dispatchedBy: currentUser?.name || 'Dispatch Officer',
      }).unwrap();

      setToast({
        id: 'xfer-dispatch-success',
        type: 'success',
        title: 'Transfer Dispatched (In Transit)',
        message: 'Source stock decremented immediately. Items are now tracked in transit.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to dispatch transfer';
      setToast({
        id: 'xfer-dispatch-error',
        type: 'error',
        title: 'Dispatch Failed',
        message: msg,
      });
    }
  };

  // Receive Transfer
  const handleReceive = async (transferId: string) => {
    try {
      await receiveStockTransferMutation({
        transferId,
        receivedBy: currentUser?.name || 'Receiving Staff',
      }).unwrap();

      setToast({
        id: 'xfer-receive-success',
        type: 'success',
        title: 'Stock Received & Completed',
        message: 'Destination stock incremented. Transfer lifecycle marked RECEIVED.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to confirm receipt';
      setToast({
        id: 'xfer-receive-error',
        type: 'error',
        title: 'Receipt Failed',
        message: msg,
      });
    }
  };

  // Cancel Transfer
  const handleConfirmCancel = async () => {
    if (!cancellationTarget) return;
    if (!cancellationReason.trim()) {
      setToast({
        id: 'xfer-cancel-reason',
        type: 'info',
        title: 'Reason Required',
        message: 'Please provide a valid cancellation reason.',
      });
      return;
    }

    try {
      await cancelStockTransferMutation({
        transferId: cancellationTarget.id,
        cancelledBy: currentUser?.name || 'Staff Member',
        cancellationReason: cancellationReason.trim(),
      }).unwrap();

      setToast({
        id: 'xfer-cancel-success',
        type: 'success',
        title: 'Transfer Cancelled',
        message: 'Transfer marked CANCELLED. Any dispatched stock has been returned to source.',
      });

      setCancellationTarget(null);
      setCancellationReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { data?: string })?.data || 'Failed to cancel transfer';
      setToast({
        id: 'xfer-cancel-error',
        type: 'error',
        title: 'Cancellation Failed',
        message: msg,
      });
    }
  };

  return (
    <AppLayout title="Stock Transfers" subtitle="Inter-branch replenishment & transit tracking">
      <InventoryNavTabs branchId={branchFilter === 'all' ? undefined : branchFilter} />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Stock Transfer Operations
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Controlled multi-stage workflow: Request &rarr; Approval &rarr; Dispatch &rarr; In-Transit &rarr; Receipt.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Transfer Request</span>
          </button>
        </div>

        {/* 4 Status KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Total Requests
            </span>
            <span className="text-2xl font-bold text-gray-900 mt-1 block">{totalTransfers}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">
              Pending Approval
            </span>
            <span className="text-2xl font-bold text-amber-700 mt-1 block">{pendingCount}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
            <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider block">
              In Transit (Dispatched)
            </span>
            <span className="text-2xl font-bold text-purple-700 mt-1 block">{inTransitCount}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
              Completed Transfers
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{receivedCount}</span>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {(['all', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'CANCELLED'] as const).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-brand-blue text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {status === 'all'
                    ? 'All Transfers'
                    : status === 'PENDING_APPROVAL'
                    ? 'Pending'
                    : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              )
            )}
          </div>

          {/* Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search transfer # or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:border-brand-blue"
            />
          </div>
        </div>

        {/* Transfers List */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Source & Destination</th>
                  <th className="py-3 px-4">Items / Total Units</th>
                  <th className="py-3 px-4">Lifecycle Status</th>
                  <th className="py-3 px-4">Personnel</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      Loading transfers...
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No transfer orders found matching the filter.
                    </td>
                  </tr>
                ) : (
                  transfers.map((trf) => {
                    const sourceLoc = stockLocations.find((l) => l.id === trf.sourceLocationId);
                    const destLoc = stockLocations.find((l) => l.id === trf.destinationLocationId);
                    const totalQty = trf.items.reduce((s, i) => s + i.requestedQuantity, 0);

                    return (
                      <tr key={trf.id} className="hover:bg-gray-50/50">
                        {/* Transfer # */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-gray-900 text-xs">{trf.transferNumber}</span>
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            {new Date(trf.requestedAt).toLocaleDateString()}
                          </span>
                        </td>

                        {/* Source -> Destination */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 text-xs">
                              {sourceLoc?.name || trf.sourceLocationId}
                            </span>
                            <span className="text-gray-400">&rarr;</span>
                            <span className="font-medium text-brand-blue text-xs">
                              {destLoc?.name || trf.destinationLocationId}
                            </span>
                          </div>
                          {trf.notes && (
                            <p className="text-[11px] text-gray-500 italic mt-0.5 truncate max-w-xs">
                              &ldquo;{trf.notes}&rdquo;
                            </p>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-900 text-xs">
                            {totalQty} units ({trf.items.length} SKUs)
                          </span>
                          <span className="text-[11px] text-gray-500 block truncate max-w-[200px]">
                            {trf.items.map((i) => `${i.sku} (${i.requestedQuantity})`).join(', ')}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                              trf.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-100 text-amber-800'
                                : trf.status === 'APPROVED'
                                ? 'bg-blue-100 text-blue-800'
                                : trf.status === 'DISPATCHED'
                                ? 'bg-purple-100 text-purple-800'
                                : trf.status === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {trf.status === 'DISPATCHED' && <Truck className="w-3 h-3" />}
                            {trf.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Personnel */}
                        <td className="py-3 px-4 text-xs text-gray-600">
                          <p>Req: <span className="font-medium text-gray-800">{trf.requestedBy}</span></p>
                          {trf.approvedBy && (
                            <p className="text-[11px] text-gray-500">Appr: {trf.approvedBy}</p>
                          )}
                          {trf.receivedBy && (
                            <p className="text-[11px] text-emerald-600">Recv: {trf.receivedBy}</p>
                          )}
                        </td>

                        {/* Workflow Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details */}
                            <button
                              onClick={() => setSelectedTransferForDetails(trf)}
                              title="View Order Details"
                              className="p-1.5 text-gray-500 hover:text-brand-blue hover:bg-gray-100 rounded-md"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Stage: Pending Approval -> Approve */}
                            {trf.status === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => handleApprove(trf.id)}
                                disabled={isApproving}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs"
                              >
                                Approve
                              </button>
                            )}

                            {/* Stage: Approved -> Dispatch */}
                            {trf.status === 'APPROVED' && (
                              <button
                                onClick={() => handleDispatch(trf.id)}
                                disabled={isDispatching}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-md shadow-2xs"
                              >
                                <Truck className="w-3 h-3" />
                                <span>Dispatch</span>
                              </button>
                            )}

                            {/* Stage: Dispatched -> Receive */}
                            {trf.status === 'DISPATCHED' && (
                              <button
                                onClick={() => handleReceive(trf.id)}
                                disabled={isReceiving}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-2xs"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Confirm Receipt</span>
                              </button>
                            )}

                            {/* Cancel Option (allowed if not RECEIVED or CANCELLED) */}
                            {trf.status !== 'RECEIVED' && trf.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setCancellationTarget(trf)}
                                title="Cancel Transfer"
                                className="p-1 text-gray-400 hover:text-red-600 rounded-md"
                              >
                                <XCircle className="w-4 h-4" />
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

      {/* Create Transfer Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-brand-blue" />
                <h3 className="font-bold text-gray-900 text-base">New Branch-to-Branch Stock Transfer</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-6 space-y-4 text-sm">
              {/* Origin & Destination Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
                {/* Source Branch */}
                <div>
                  <label htmlFor="source-branch-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Source Branch *
                  </label>
                  <select
                    id="source-branch-select"
                    value={sourceBranchId}
                    onChange={(e) => {
                      setSourceBranchId(e.target.value);
                      const locs = stockLocations.filter((l) => l.branchId === e.target.value);
                      if (locs[0]) setSourceLocationId(locs[0].id);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                  >
                    {authorizedBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="source-location-select" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-2 mb-1">
                    Source Stockroom
                  </label>
                  <select
                    id="source-location-select"
                    value={sourceLocationId}
                    onChange={(e) => setSourceLocationId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                  >
                    {sourceAvailableLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Branch */}
                <div>
                  <label htmlFor="destination-branch-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Destination Branch *
                  </label>
                  <select
                    id="destination-branch-select"
                    value={destBranchId}
                    onChange={(e) => {
                      setDestBranchId(e.target.value);
                      const locs = stockLocations.filter((l) => l.branchId === e.target.value);
                      if (locs[0]) setDestLocationId(locs[0].id);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                  >
                    {allBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="destination-location-select" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-2 mb-1">
                    Destination Bay
                  </label>
                  <select
                    id="destination-location-select"
                    value={destLocationId}
                    onChange={(e) => setDestLocationId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                  >
                    {destAvailableLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Transfer Items ({transferItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-brand-blue hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Available at Source</th>
                        <th className="p-2 w-28 text-center">Transfer Qty *</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transferItems.map((item, idx) => {
                        const balance = sourceBalances.find((b) => b.sku === item.sku);
                        const available = balance ? balance.available : 0;
                        const isExceeded = item.requestedQuantity > available;

                        return (
                          <tr key={idx} className={isExceeded ? 'bg-red-50/50' : ''}>
                            <td className="p-2">
                              <select
                                aria-label="Select variant SKU"
                                value={item.sku}
                                onChange={(e) => handleUpdateItem(idx, 'sku', e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-gray-300 rounded font-mono font-semibold"
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

                            <td className="p-2 font-medium text-gray-700">
                              <span
                                className={`font-bold ${
                                  available > 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                {available} units available
                              </span>
                            </td>

                            <td className="p-2">
                              <input
                                aria-label="Transfer quantity"
                                type="number"
                                min="1"
                                value={item.requestedQuantity}
                                onChange={(e) =>
                                  handleUpdateItem(idx, 'requestedQuantity', parseInt(e.target.value) || 0)
                                }
                                className={`w-full px-2 py-1 text-center font-bold bg-white border rounded ${
                                  isExceeded ? 'border-red-500 text-red-600' : 'border-gray-300'
                                }`}
                              />
                            </td>

                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-gray-400 hover:text-red-600"
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
                <label htmlFor="transfer-reason-notes-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Transfer Reason & Transport Notes
                </label>
                <input
                  id="transfer-reason-notes-input"
                  type="text"
                  placeholder="e.g. Replenishment for weekend showroom exhibition"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  {isCreating ? 'Creating...' : 'Submit Transfer Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {cancellationTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Cancel Stock Transfer</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to cancel transfer{' '}
              <span className="font-mono font-bold text-gray-900">
                {cancellationTarget.transferNumber}
              </span>
              ? If items were already dispatched, they will be automatically restored to the source stockroom.
            </p>

            <div>
              <label htmlFor="cancellation-reason-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Cancellation Reason *
              </label>
              <textarea
                id="cancellation-reason-input"
                rows={2}
                placeholder="e.g. Order cancelled by client or transport breakdown."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:border-brand-blue"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancellationTarget(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {isCancelling ? 'Processing...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Details Modal */}
      {selectedTransferForDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-blue" />
                <h3 className="font-bold text-gray-900 text-base">
                  Transfer #{selectedTransferForDetails.transferNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTransferForDetails(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <span className="text-gray-500 block">Status</span>
                  <span className="font-bold text-sm text-gray-900">
                    {selectedTransferForDetails.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Requested At</span>
                  <span className="font-medium text-gray-800">
                    {new Date(selectedTransferForDetails.requestedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-gray-800 uppercase tracking-wider mb-2">Item Dispatches</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 font-semibold text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Product</th>
                        <th className="p-2 text-center">Req Qty</th>
                        <th className="p-2 text-center">Dispatched</th>
                        <th className="p-2 text-center">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedTransferForDetails.items.map((i) => (
                        <tr key={i.sku}>
                          <td className="p-2 font-mono font-bold text-gray-800">{i.sku}</td>
                          <td className="p-2 text-gray-600">{i.productName}</td>
                          <td className="p-2 text-center font-bold text-gray-800">{i.requestedQuantity}</td>
                          <td className="p-2 text-center text-purple-700 font-bold">
                            {i.dispatchedQuantity ?? '-'}
                          </td>
                          <td className="p-2 text-center text-emerald-700 font-bold">
                            {i.receivedQuantity ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audit trail */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <p>Requested by: <span className="font-semibold text-gray-800">{selectedTransferForDetails.requestedBy}</span></p>
                {selectedTransferForDetails.approvedBy && (
                  <p>Approved by: <span className="font-semibold text-gray-800">{selectedTransferForDetails.approvedBy}</span> at {new Date(selectedTransferForDetails.approvedAt!).toLocaleString()}</p>
                )}
                {selectedTransferForDetails.dispatchedBy && (
                  <p>Dispatched by: <span className="font-semibold text-purple-700">{selectedTransferForDetails.dispatchedBy}</span> at {new Date(selectedTransferForDetails.dispatchedAt!).toLocaleString()}</p>
                )}
                {selectedTransferForDetails.receivedBy && (
                  <p>Received by: <span className="font-semibold text-emerald-700">{selectedTransferForDetails.receivedBy}</span> at {new Date(selectedTransferForDetails.receivedAt!).toLocaleString()}</p>
                )}
                {selectedTransferForDetails.cancellationReason && (
                  <p className="text-red-600">Cancellation: {selectedTransferForDetails.cancellationReason}</p>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedTransferForDetails(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg"
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
