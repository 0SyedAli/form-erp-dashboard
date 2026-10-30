'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import {
  useGetSupplierByIdQuery,
  useGetSupplierLedgerSummaryQuery,
  useGetPurchaseOrdersQuery,
  useGetSupplierBillsQuery,
  useGetSupplierPaymentsQuery,
} from '@/store/services/apiSlice';
import {
  ArrowLeft,
  CreditCard,
  FileText,
} from 'lucide-react';

function SupplierProfileContent() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const { data: supplier, isLoading } = useGetSupplierByIdQuery(id);
  const { data: ledgerSummary } = useGetSupplierLedgerSummaryQuery(id);
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery({ supplierId: id });
  const { data: bills = [] } = useGetSupplierBillsQuery({ supplierId: id });
  const { data: payments = [] } = useGetSupplierPaymentsQuery({ supplierId: id });

  if (isLoading) {
    return (
      <AppLayout>
        <PurchasesNavTabs />
        <div className="p-8 text-center text-slate-500">Loading supplier profile...</div>
      </AppLayout>
    );
  }

  if (!supplier) {
    return (
      <AppLayout>
        <PurchasesNavTabs />
        <div className="p-8 text-center space-y-4">
          <p className="text-slate-600">Supplier not found.</p>
          <Link href="/suppliers" className="text-brand-burgundy font-medium hover:underline">
            Back to suppliers
          </Link>
        </div>
      </AppLayout>
    );
  }

  const currentBalance = ledgerSummary?.currentBalance ?? supplier.currentOutstanding;

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header & Back Link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/suppliers"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{supplier.name}</h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    supplier.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {supplier.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Code: {supplier.code}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/suppliers/${supplier.id}/ledger`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Accounts Payable Ledger</span>
            </Link>

            <Link
              href={`/payments/suppliers?supplierId=${supplier.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Make Payment</span>
            </Link>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Outstanding Balance (Payable)
            </span>
            <span
              className={`text-2xl font-bold mt-1 block ${
                currentBalance > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              Rs. {currentBalance.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              Credit Limit: Rs. {(supplier.creditLimit || 5000000).toLocaleString()}
            </span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Billed
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              Rs. {(ledgerSummary?.totalBilled || 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">{bills.length} vendor bills posted</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Payments Made
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">
              Rs. {(ledgerSummary?.totalPaid || 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">{payments.length} payment vouchers</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Debit Notes
            </span>
            <span className="text-2xl font-bold text-slate-700 mt-1 block">
              Rs. {(ledgerSummary?.totalDebitNotes || 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">Returns credited to ledger</span>
          </div>
        </div>

        {/* Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier Details & Contact Info */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Supplier Information
            </h2>

            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 block">Contact Person:</span>
                <span className="font-semibold text-slate-900 text-sm">{supplier.contactPerson}</span>
              </div>

              <div>
                <span className="text-slate-400 block">Phone:</span>
                <span className="font-medium">{supplier.phone}</span>
              </div>

              {supplier.email && (
                <div>
                  <span className="text-slate-400 block">Email:</span>
                  <span className="font-medium">{supplier.email}</span>
                </div>
              )}

              <div>
                <span className="text-slate-400 block">City & Address:</span>
                <span className="font-medium">
                  {supplier.city ? `${supplier.city} • ` : ''}
                  {supplier.address || 'Address not registered'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block">Payment Terms:</span>
                <span className="font-semibold text-brand-burgundy">{supplier.paymentTerms || 'Net 30'}</span>
              </div>

              {supplier.taxNumber && (
                <div>
                  <span className="text-slate-400 block">NTN / STRN:</span>
                  <span className="font-mono">{supplier.taxNumber}</span>
                </div>
              )}

              {supplier.bankName && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 block">Bank Account:</span>
                  <span className="font-semibold">{supplier.bankName}</span>
                  <span className="block text-[11px] font-mono text-slate-500">
                    {supplier.bankAccountNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Active POs and Bills Tables */}
          <div className="lg:col-span-2 space-y-6">
            {/* Purchase Orders */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Purchase Orders</h3>
                  <p className="text-xs text-slate-500">{purchaseOrders.length} orders issued</p>
                </div>
                <Link
                  href="/purchases/orders/new"
                  className="text-xs text-brand-burgundy font-medium hover:underline"
                >
                  + New PO
                </Link>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {purchaseOrders.length > 0 ? (
                  purchaseOrders.slice(0, 4).map((po) => (
                    <div key={po.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/purchases/orders/${po.id}`}
                            className="font-bold text-brand-burgundy hover:underline"
                          >
                            {po.poNumber}
                          </Link>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {po.status}
                          </span>
                        </div>
                        <span className="text-slate-400 mt-0.5 block">
                          {po.orderDate} • {po.destinationBranchName}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        Rs. {po.grandTotal.toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-xs text-slate-400 text-center">No purchase orders found.</p>
                )}
              </div>
            </div>

            {/* Recent Supplier Bills */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Recent Bills</h3>
                  <p className="text-xs text-slate-500">{bills.length} bills recorded</p>
                </div>
                <Link
                  href="/purchases/bills"
                  className="text-xs text-brand-burgundy font-medium hover:underline"
                >
                  View All Bills
                </Link>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {bills.length > 0 ? (
                  bills.slice(0, 4).map((b) => (
                    <div key={b.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{b.billNumber}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              b.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : b.paymentStatus === 'PARTIALLY_PAID'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {b.paymentStatus}
                          </span>
                        </div>
                        <span className="text-slate-400 mt-0.5 block">
                          Due: {b.dueDate} • Inv: {b.supplierInvoiceNumber}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">
                          Rs. {b.grandTotal.toLocaleString()}
                        </span>
                        {b.amountDue > 0 && (
                          <span className="text-[11px] text-rose-600 block">
                            Due: Rs. {b.amountDue.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-xs text-slate-400 text-center">No bills recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SupplierProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Supplier Profile...
        </div>
      }
    >
      <SupplierProfileContent />
    </Suspense>
  );
}
