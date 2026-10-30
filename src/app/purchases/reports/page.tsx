'use client';

import React, { useState, useMemo, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetSuppliersQuery,
  useGetPurchaseOrdersQuery,
  useGetSupplierBillsQuery,
  useGetSupplierPaymentsQuery,
  useGetPurchaseReturnsQuery,
  useGetBranchesQuery,
} from '@/store/services/apiSlice';
import { getUserAuthorizedBranches } from '@/lib/permissions';
import {
  Printer,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

function PurchasingReportsContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: allBranches = [] } = useGetBranchesQuery();
  const authorizedBranches = getUserAuthorizedBranches(currentUser, allBranches);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? 'all' : (currentUser?.assignedBranchId || 'all')
  );

  const branchArg = selectedBranchId === 'all' ? undefined : selectedBranchId;
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery(branchArg ? { branchId: branchArg } : undefined);
  const { data: bills = [] } = useGetSupplierBillsQuery(branchArg ? { branchId: branchArg } : undefined);
  const { data: payments = [] } = useGetSupplierPaymentsQuery(branchArg ? { branchId: branchArg } : undefined);
  const { data: returns = [] } = useGetPurchaseReturnsQuery(branchArg ? { branchId: branchArg } : undefined);

  // Financial Separation Totals
  const totalOrderedValue = purchaseOrders
    .filter((p) => p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + p.grandTotal, 0);

  const totalBilledValue = bills.reduce((sum, b) => sum + b.grandTotal, 0);
  const totalPaidValue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDebitNotesValue = returns.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalCurrentPayable = bills.reduce((sum, b) => sum + b.amountDue, 0);

  // Supplier Breakdown Data
  const supplierRows = useMemo(() => {
    return suppliers.map((s) => {
      const supPOs = purchaseOrders.filter((p) => p.supplierId === s.id && p.status !== 'CANCELLED');
      const supBills = bills.filter((b) => b.supplierId === s.id);
      const supPayments = payments.filter((p) => p.supplierId === s.id);
      const supReturns = returns.filter((r) => r.supplierId === s.id);

      const ordered = supPOs.reduce((sum, p) => sum + p.grandTotal, 0);
      const billed = supBills.reduce((sum, b) => sum + b.grandTotal, 0);
      const paid = supPayments.reduce((sum, p) => sum + p.amount, 0);
      const debited = supReturns.reduce((sum, r) => sum + r.totalAmount, 0);
      const balance = s.currentOutstanding;

      return {
        id: s.id,
        name: s.name,
        code: s.code,
        poCount: supPOs.length,
        ordered,
        billed,
        paid,
        debited,
        balance,
      };
    });
  }, [suppliers, purchaseOrders, bills, payments, returns]);

  // Chart Data: Billed vs Paid per Supplier
  const comparisonChartData = supplierRows
    .filter((s) => s.billed > 0 || s.paid > 0)
    .map((s) => ({
      name: s.name.length > 12 ? s.name.slice(0, 11) + '..' : s.name,
      Billed: s.billed,
      Paid: s.paid,
      Outstanding: s.balance,
    }))
    .slice(0, 6);

  return (
    <AppLayout>
      <PurchasesNavTabs branchId={branchArg} />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Print Header */}
        <div className="hidden print:block mb-8">
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">MOLTY FOAM ERP</h1>
              <p className="text-xs text-slate-600">Procurement & Accounts Payable Reconciliation Statement</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-slate-900">
                {selectedBranchId === 'all' ? 'All Branches Consolidated' : selectedBranchId}
              </span>
              <p className="text-xs text-slate-500">Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Screen Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Procurement & Accounts Payable Reports</h1>
            <p className="text-sm text-slate-500 mt-1">
              Reconciliation between ordered commitments, inventory receipts, posted liabilities, and disbursements
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
                <Building2 className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="text-sm font-medium bg-transparent border-none text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Branches (Consolidated)</option>
                  {authorizedBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Accounting Separation Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Ordered Commitment */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1. Ordered Value (POs)
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              Rs. {totalOrderedValue.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Procurement Commitment</span>
          </div>

          {/* Billed Liability */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              2. Posted Bills (A/P)
            </span>
            <span className="text-xl font-bold text-brand-burgundy mt-1 block">
              Rs. {totalBilledValue.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Official Accounts Payable</span>
          </div>

          {/* Payments Disbursed */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              3. Payments Made
            </span>
            <span className="text-xl font-bold text-emerald-700 mt-1 block">
              Rs. {totalPaidValue.toLocaleString()}
            </span>
            <span className="text-[11px] text-emerald-600 mt-0.5 block">Disbursements to Vendors</span>
          </div>

          {/* Debit Notes */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              4. Debit Notes
            </span>
            <span className="text-xl font-bold text-amber-700 mt-1 block">
              Rs. {totalDebitNotesValue.toLocaleString()}
            </span>
            <span className="text-[11px] text-amber-600 mt-0.5 block">Returns Credited</span>
          </div>

          {/* Net Outstanding Balance */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              5. Net Payable Due
            </span>
            <span className="text-xl font-bold text-rose-700 mt-1 block">
              Rs. {totalCurrentPayable.toLocaleString()}
            </span>
            <span className="text-[11px] text-rose-600 mt-0.5 block">Current Outstanding</span>
          </div>
        </div>

        {/* Visual Comparison Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs print:hidden">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Billed vs Paid vs Outstanding Comparison</h2>
            <p className="text-xs text-slate-500">Supplier-level financial reconciliation</p>
          </div>
          <div className="h-64 w-full">
            {comparisonChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(val) => `Rs. ${(val / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(val) => [`Rs. ${Number(val).toLocaleString()}`]}
                  />
                  <Legend />
                  <Bar dataKey="Billed" fill="#881337" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Paid" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Outstanding" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                No billing data recorded.
              </div>
            )}
          </div>
        </div>

        {/* Comprehensive Supplier Reconciliation Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Supplier Accounts Payable Reconciliation</h2>
            <span className="text-xs text-slate-500">{supplierRows.length} suppliers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">POs Issued</th>
                  <th className="py-3 px-4 text-right">Ordered (PKR)</th>
                  <th className="py-3 px-4 text-right">Billed (PKR)</th>
                  <th className="py-3 px-4 text-right">Paid (PKR)</th>
                  <th className="py-3 px-4 text-right">Debit Notes</th>
                  <th className="py-3 px-4 text-right">Outstanding (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {supplierRows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">{s.name}</span>
                      <span className="text-xs text-slate-400 font-mono mt-0.5">{s.code}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                      {s.poCount}
                    </td>

                    <td className="py-3.5 px-4 text-right text-slate-600">
                      Rs. {s.ordered.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                      Rs. {s.billed.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-emerald-700">
                      Rs. {s.paid.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right text-amber-700">
                      {s.debited > 0 ? `-Rs. ${s.debited.toLocaleString()}` : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                      <span className={s.balance > 0 ? 'text-rose-700' : 'text-slate-500'}>
                        Rs. {s.balance.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PurchasingReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Purchasing Reports...
        </div>
      }
    >
      <PurchasingReportsContent />
    </Suspense>
  );
}
