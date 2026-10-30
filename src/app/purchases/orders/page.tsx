'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetPurchaseOrdersQuery,
  useGetSuppliersQuery,
  useGetBranchesQuery,
  useApprovePurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches, hasPermission } from '@/lib/permissions';
import {
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowRight,
} from 'lucide-react';

function PurchaseOrdersListContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);
  const { data: suppliers = [] } = useGetSuppliersQuery();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(
    isSuperAdmin ? 'ALL' : (currentUser?.assignedBranchId || 'ALL')
  );
  const [searchQuery, setSearchQuery] = useState('');

  const { data: purchaseOrders = [], isLoading } = useGetPurchaseOrdersQuery();
  const [approvePOMutation, { isLoading: isApproving }] = useApprovePurchaseOrderMutation();
  const [cancelPOMutation, { isLoading: isCancelling }] = useCancelPurchaseOrderMutation();

  const canApprove = hasPermission(currentUser, 'purchases.approve');
  const canCreate = hasPermission(currentUser, 'purchases.create');

  // Filtered List
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (statusFilter !== 'ALL' && po.status !== statusFilter) return false;
      if (supplierFilter !== 'ALL' && po.supplierId !== supplierFilter) return false;
      if (branchFilter !== 'ALL' && po.destinationBranchId !== branchFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPO = po.poNumber.toLowerCase().includes(q);
        const matchesSupplier = po.supplierName.toLowerCase().includes(q);
        const matchesNotes = po.notes?.toLowerCase().includes(q);
        if (!matchesPO && !matchesSupplier && !matchesNotes) return false;
      }

      return true;
    });
  }, [purchaseOrders, statusFilter, supplierFilter, branchFilter, searchQuery]);

  const handleQuickApprove = async (poId: string) => {
    if (!window.confirm('Are you sure you want to approve this purchase order?')) return;
    try {
      await approvePOMutation({
        id: poId,
        approvedBy: currentUser?.name || 'Authorized Manager',
      }).unwrap();
    } catch (err: unknown) {
      alert((err as { data?: string })?.data || 'Failed to approve purchase order.');
    }
  };

  const handleQuickCancel = async (poId: string) => {
    const reason = window.prompt('Please enter the reason for cancellation:');
    if (reason === null) return;
    try {
      await cancelPOMutation({ id: poId, reason }).unwrap();
    } catch (err: unknown) {
      alert((err as { data?: string })?.data || 'Failed to cancel purchase order.');
    }
  };

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
            <p className="text-sm text-slate-500 mt-1">
              Procurement orders issued to mattress suppliers across all retail locations
            </p>
          </div>

          {canCreate && (
            <Link
              href="/purchases/orders/new"
              className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </Link>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search PO #, supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="FULLY_RECEIVED">Fully Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Supplier Filter */}
            <div>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Branch Filter */}
            <div>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                disabled={!isSuperAdmin}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy focus:border-brand-burgundy disabled:opacity-60"
              >
                <option value="ALL">All Branches</option>
                {authorizedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* PO Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Destination Branch</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4 text-center">Items / Progress</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((po) => {
                    const totalOrderedQty = po.items.reduce((sum, i) => sum + i.orderedQuantity, 0);
                    const totalReceivedQty = po.items.reduce((sum, i) => sum + i.receivedQuantity, 0);
                    const percentReceived =
                      totalOrderedQty > 0 ? Math.round((totalReceivedQty / totalOrderedQty) * 100) : 0;

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/purchases/orders/${po.id}`}
                            className="font-semibold text-brand-burgundy hover:underline flex items-center gap-1"
                          >
                            <span>{po.poNumber}</span>
                          </Link>
                          {po.expectedDeliveryDate && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Exp: {po.expectedDeliveryDate}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-900 block">{po.supplierName}</span>
                          <span className="text-[11px] text-slate-500">{po.supplierCode || po.supplierId}</span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <span>{po.destinationBranchName}</span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {po.destinationLocationName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {po.orderDate}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-medium text-slate-700">
                              {totalReceivedQty} / {totalOrderedQty} units
                            </span>
                            <div className="w-20 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full ${
                                  percentReceived === 100
                                    ? 'bg-emerald-500'
                                    : percentReceived > 0
                                    ? 'bg-amber-500'
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${percentReceived}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                          Rs. {po.grandTotal.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              po.status === 'APPROVED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : po.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : po.status === 'PARTIALLY_RECEIVED'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : po.status === 'FULLY_RECEIVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : po.status === 'CANCELLED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {po.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/purchases/orders/${po.id}`}
                              className="p-1.5 text-slate-500 hover:text-brand-burgundy hover:bg-slate-100 rounded-md transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {canApprove && po.status === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => handleQuickApprove(po.id)}
                                disabled={isApproving}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                                title="Approve PO"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            {(po.status === 'DRAFT' || po.status === 'PENDING_APPROVAL') && (
                              <button
                                onClick={() => handleQuickCancel(po.id)}
                                disabled={isCancelling}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                                title="Cancel PO"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}

                            {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                              <Link
                                href={`/purchases/receiving?poId=${po.id}`}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                                title="Receive Goods"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No purchase orders match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PurchaseOrdersListPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Purchase Orders...
        </div>
      }
    >
      <PurchaseOrdersListContent />
    </Suspense>
  );
}
