'use client';

import React, { useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetPurchaseOrderByIdQuery,
  useApprovePurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useGetGoodsReceiptsQuery,
  useGetSupplierBillsQuery,
} from '@/store/services/apiSlice';
import { hasPermission } from '@/lib/permissions';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ArrowDownToLine,
  Receipt,
  Printer,
  AlertCircle,
} from 'lucide-react';

function PurchaseOrderDetailsContent() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: po, isLoading } = useGetPurchaseOrderByIdQuery(id);
  const { data: grns = [] } = useGetGoodsReceiptsQuery({ poId: id });
  const { data: allBills = [] } = useGetSupplierBillsQuery();
  const bills = allBills.filter((b) => b.poId === id);

  const [approvePOMutation, { isLoading: isApproving }] = useApprovePurchaseOrderMutation();
  const [cancelPOMutation, { isLoading: isCancelling }] = useCancelPurchaseOrderMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const canApprove = hasPermission(currentUser, 'purchases.approve');
  const canReceive = hasPermission(currentUser, 'purchases.receive');

  if (isLoading) {
    return (
      <AppLayout>
        <PurchasesNavTabs />
        <div className="p-8 text-center text-slate-500">Loading purchase order details...</div>
      </AppLayout>
    );
  }

  if (!po) {
    return (
      <AppLayout>
        <PurchasesNavTabs />
        <div className="p-8 text-center space-y-4">
          <p className="text-slate-600">Purchase order not found.</p>
          <Link href="/purchases/orders" className="text-brand-burgundy font-medium hover:underline">
            Back to purchase orders
          </Link>
        </div>
      </AppLayout>
    );
  }

  const handleApprove = async () => {
    if (!window.confirm(`Approve purchase order #${po.poNumber}?`)) return;
    setActionError(null);
    try {
      await approvePOMutation({
        id: po.id,
        approvedBy: currentUser?.name || 'Authorized Manager',
      }).unwrap();
    } catch (err: unknown) {
      setActionError((err as { data?: string })?.data || 'Failed to approve purchase order.');
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Please provide a reason for cancelling this order:');
    if (reason === null) return;
    setActionError(null);
    try {
      await cancelPOMutation({ id: po.id, reason }).unwrap();
    } catch (err: unknown) {
      setActionError((err as { data?: string })?.data || 'Failed to cancel purchase order.');
    }
  };

  const totalOrdered = po.items.reduce((sum, i) => sum + i.orderedQuantity, 0);
  const totalReceived = po.items.reduce((sum, i) => sum + i.receivedQuantity, 0);

  return (
    <AppLayout>
      <PurchasesNavTabs branchId={po.destinationBranchId} />

      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Print Layout Header (visible only on print) */}
        <div className="hidden print:block mb-8">
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">MOLTY FOAM ERP</h1>
              <p className="text-xs text-slate-600">Official Purchase Order</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-slate-900">{po.poNumber}</span>
              <p className="text-xs text-slate-600">Date: {po.orderDate}</p>
            </div>
          </div>
        </div>

        {/* Action Header & Back Link (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/purchases/orders"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{po.poNumber}</h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
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
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Created on {new Date(po.createdAt).toLocaleDateString()} by {po.createdBy}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print PO</span>
            </button>

            {canApprove && (po.status === 'PENDING_APPROVAL' || po.status === 'DRAFT') && (
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isApproving ? 'Approving...' : 'Approve Order'}</span>
              </button>
            )}

            {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && canReceive && (
              <Link
                href={`/purchases/receiving?poId=${po.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Receive Goods (GRN)</span>
              </Link>
            )}

            {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'FULLY_RECEIVED') && (
              <Link
                href={`/purchases/bills?createForPo=${po.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Create Bill</span>
              </Link>
            )}

            {(po.status === 'DRAFT' || po.status === 'PENDING_APPROVAL') && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-xs transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* PO Details Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Supplier Info */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Vendor / Supplier
            </span>
            <div>
              <Link
                href={`/suppliers/${po.supplierId}`}
                className="text-base font-bold text-slate-900 hover:text-brand-burgundy hover:underline"
              >
                {po.supplierName}
              </Link>
              <p className="text-xs text-slate-500 mt-0.5">Supplier Code: {po.supplierCode || po.supplierId}</p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Order Date:</span>
                <span className="font-medium text-slate-800">{po.orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expected Delivery:</span>
                <span className="font-medium text-slate-800">
                  {po.expectedDeliveryDate || 'Standard delivery schedule'}
                </span>
              </div>
            </div>
          </div>

          {/* Destination Branch & Location Info */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Ship To / Destination
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">{po.destinationBranchName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Location: {po.destinationLocationName}</p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-semibold text-slate-800">{po.status}</span>
              </div>
              {po.approvedByName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Approved By:</span>
                  <span className="font-medium text-slate-800">{po.approvedByName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Ordered Products</h2>
              <p className="text-xs text-slate-500">
                {po.items.length} SKUs • Total {totalOrdered} units ordered ({totalReceived} received)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">SKU / Mattress Details</th>
                  <th className="py-3 px-4 text-center">Ordered</th>
                  <th className="py-3 px-4 text-center">Received</th>
                  <th className="py-3 px-4 text-center">Remaining</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {po.items.map((item) => {
                  const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">{item.productName}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="font-mono text-slate-700">{item.sku}</span>
                          <span>•</span>
                          <span>{item.sizeLabel}</span>
                          <span>•</span>
                          <span>{item.thicknessLabel}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-medium">
                        {item.orderedQuantity}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-semibold ${
                            item.receivedQuantity >= item.orderedQuantity
                              ? 'text-emerald-700'
                              : item.receivedQuantity > 0
                              ? 'text-amber-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.receivedQuantity}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            remaining === 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {remaining}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-600">
                        Rs. {item.unitCost.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-500">
                        {item.lineDiscount ? `-Rs. ${item.lineDiscount.toLocaleString()}` : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        Rs. {item.lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row justify-end items-end gap-2 text-sm">
            <div className="w-full sm:w-72 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-800">
                  Rs. {po.subtotal.toLocaleString()}
                </span>
              </div>
              {po.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-medium">-Rs. {po.discountAmount.toLocaleString()}</span>
                </div>
              )}
              {po.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span className="font-medium text-slate-800">
                    Rs. {po.taxAmount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-brand-burgundy font-bold">
                  Rs. {po.grandTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Goods Receipts & Bills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
          {/* Related Goods Receipts */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Goods Receipt Notes (GRNs)</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {grns.length}
              </span>
            </div>

            {grns.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {grns.map((g) => (
                  <div key={g.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">{g.grnNumber}</span>
                      <span className="text-slate-400">
                        {g.receivedDate} • {g.receivedBy}
                      </span>
                    </div>
                    <span className="text-emerald-700 font-semibold">
                      {g.items.reduce((s, i) => s + i.receivedQuantity, 0)} items received
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3">No goods receipt notes recorded yet.</p>
            )}
          </div>

          {/* Related Supplier Bills */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Associated Vendor Bills</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {bills.length}
              </span>
            </div>

            {bills.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {bills.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">{b.billNumber}</span>
                      <span className="text-slate-400">
                        Due: {b.dueDate} • {b.paymentStatus}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900">
                      Rs. {b.grandTotal.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3">No vendor bills linked to this order yet.</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PurchaseOrderDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Purchase Order Details...
        </div>
      }
    >
      <PurchaseOrderDetailsContent />
    </Suspense>
  );
}
