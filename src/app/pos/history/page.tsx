'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useGetInvoicesQuery,
  useGetBranchesQuery,
  useGetCustomersQuery,
} from '@/store/services/apiSlice';
import { useAppSelector } from '@/store';
import { Invoice, SaleType, InvoicePaymentStatus } from '@/types';
import {
  ArrowLeft,
  Search,
  Printer,
  Store,
  DollarSign,
  TrendingUp,
  CreditCard,
  FileText,
  Building2,
  Truck,
  User,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import InvoiceReceiptModal from '@/components/pos/InvoiceReceiptModal';

export default function SalesHistoryPage() {
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: invoices = [], isLoading } = useGetInvoicesQuery({});
  const { data: branches = [] } = useGetBranchesQuery();
  const { data: customers = [] } = useGetCustomersQuery();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const userBranchId = currentUser?.assignedBranchId || currentUser?.branchId;
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    userBranchId || 'ALL'
  );
  const [selectedSaleType, setSelectedSaleType] = useState<string>('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');

  // Detail & Print modal state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Filtered sales list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Branch filter
      if (!isSuperAdmin && userBranchId && inv.branchId !== userBranchId) {
        return false;
      }
      if (selectedBranchId !== 'ALL' && inv.branchId !== selectedBranchId) {
        return false;
      }

      // Sale type filter
      const invSaleType = inv.saleType || (inv.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'WALK_IN');
      if (selectedSaleType !== 'ALL' && invSaleType !== selectedSaleType) {
        return false;
      }

      // Payment Status filter
      if (selectedPaymentStatus !== 'ALL') {
        const isOverdue =
          inv.isOverdue ||
          (inv.amountDue > 0 &&
            inv.dueDate &&
            new Date(inv.dueDate).getTime() < new Date().getTime());

        if (selectedPaymentStatus === 'OVERDUE') {
          if (!isOverdue) return false;
        } else if (inv.paymentStatus !== selectedPaymentStatus) {
          return false;
        }
      }

      // Customer filter
      if (selectedCustomerId !== 'ALL' && inv.customerId !== selectedCustomerId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesNum = inv.invoiceNumber.toLowerCase().includes(query);
        const matchesCust = (inv.customerName || '').toLowerCase().includes(query);
        const matchesCashier = (inv.salesPerson || inv.cashierName || '').toLowerCase().includes(query);
        if (!matchesNum && !matchesCust && !matchesCashier) return false;
      }
      return true;
    });
  }, [
    invoices,
    isSuperAdmin,
    userBranchId,
    selectedBranchId,
    selectedSaleType,
    selectedPaymentStatus,
    selectedCustomerId,
    searchQuery,
  ]);

  // Summary Metrics
  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.netAmount ?? inv.grandTotal ?? 0), 0);
  }, [filteredInvoices]);

  const totalCollected = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.amountPaid ?? 0), 0);
  }, [filteredInvoices]);

  const totalOutstanding = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (inv.amountDue ?? 0), 0);
  }, [filteredInvoices]);

  const activeBranch = branches.find((b) => b.id === selectedInvoice?.branchId) || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <Link
            href="/pos"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to POS</span>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight font-sans">
              POS Sales History & Invoices
            </h1>
            <p className="text-xs text-slate-500 font-sans">
              Browse Walk-in, Wholesale, and Distributor counter sales, credit invoices, and receipts
            </p>
          </div>
        </div>

        <Link
          href="/payments/collections"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Recovery / Collections</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Total Sales Value</p>
              <h3 className="text-xl font-black text-slate-900 mt-1 font-sans">
                Rs. {totalRevenue.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filteredInvoices.length} Invoices
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Payments Collected</p>
              <h3 className="text-xl font-black text-emerald-700 mt-1 font-sans">
                Rs. {totalCollected.toLocaleString()}
              </h3>
              <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">Realized Cash &amp; Bank</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Outstanding Receivables</p>
              <h3 className="text-xl font-black text-purple-700 mt-1 font-sans">
                Rs. {totalOutstanding.toLocaleString()}
              </h3>
              <p className="text-[11px] text-purple-600 mt-0.5 font-medium">Pending Recovery</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Average Order Value</p>
              <h3 className="text-xl font-black text-slate-900 mt-1 font-sans">
                Rs.{' '}
                {filteredInvoices.length > 0
                  ? Math.round(totalRevenue / filteredInvoices.length).toLocaleString()
                  : 0}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Across filtered sales</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer or cashier..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sale Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Tier:</span>
            <select
              value={selectedSaleType}
              onChange={(e) => setSelectedSaleType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Sale Tiers</option>
              <option value="WALK_IN">Walk-in</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="UNPAID">Unpaid (Credit)</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Customer:</span>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden max-w-[160px] truncate"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customerType})
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5">
              <Store className="w-4 h-4 text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Sale Tier</th>
                  <th className="py-3.5 px-4">Branch</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 text-right">Net Total</th>
                  <th className="py-3.5 px-4 text-right">Paid</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      Loading sales records...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No matching sales invoices found.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const formattedDate = new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'short',
                    }).format(new Date(inv.date || inv.createdAt || inv.issueDate || '2024-10-25'));

                    const branchName =
                      branches.find((b) => b.id === inv.branchId)?.name || 'Main Branch';
                    const sType = inv.saleType || (inv.customerType === 'WHOLESALE' ? 'WHOLESALE' : 'WALK_IN');
                    const isOverdue =
                      inv.isOverdue ||
                      (inv.amountDue > 0 &&
                        inv.dueDate &&
                        new Date(inv.dueDate).getTime() < new Date().getTime());

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{formattedDate}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sType === 'DISTRIBUTOR'
                                ? 'bg-purple-100 text-purple-700'
                                : sType === 'WHOLESALE'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {sType === 'DISTRIBUTOR' ? (
                              <Truck className="w-3 h-3" />
                            ) : sType === 'WHOLESALE' ? (
                              <Building2 className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            <span>{sType}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{branchName}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900">{inv.customerName}</span>
                          {inv.customerPhone && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {inv.customerPhone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans">
                          Rs. {inv.netAmount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-sans">
                          Rs. {inv.amountPaid.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-purple-800 font-sans">
                          {inv.amountDue > 0 ? `Rs. ${inv.amountDue.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-sans">
                          {inv.amountDue > 0 && inv.dueDate ? (
                            <span
                              className={`flex items-center gap-1 ${
                                isOverdue ? 'text-rose-600 font-bold' : ''
                              }`}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              {inv.dueDate}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isOverdue ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </span>
                          ) : inv.paymentStatus === 'PAID' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Paid
                            </span>
                          ) : inv.paymentStatus === 'PARTIALLY_PAID' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              Partial
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                              Credit (Unpaid)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsReceiptModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="Print / View Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Invoice Receipt Modal */}
      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        invoice={selectedInvoice}
        branch={activeBranch}
        cashierName={selectedInvoice?.salesPerson || selectedInvoice?.cashierName || 'Cashier'}
        onStartNewSale={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
}
