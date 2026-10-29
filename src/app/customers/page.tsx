'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useGetCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useToggleCustomerStatusMutation,
} from '@/store/services/apiSlice';
import { Customer, CustomerType, CustomerStatus } from '@/types';
import {
  Users,
  Search,
  UserPlus,
  Building2,
  Truck,
  User,
  CreditCard,
  Edit2,
  Power,
  FileSpreadsheet,
  ArrowRight,
  Receipt,
  AlertCircle,
  X,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(8, 'Valid phone number is required'),
  customerType: z.enum(['WALK_IN', 'WHOLESALE', 'DISTRIBUTOR', 'RETAIL']),
  businessName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  taxNumber: z.string().optional(),
  creditEnabled: z.boolean(),
  creditLimit: z.number().min(0, 'Credit limit must be positive'),
  creditTerms: z.string().min(1, 'Credit terms required'),
  defaultDueDays: z.number().min(0, 'Due days must be positive'),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useGetCustomersQuery();
  const [createCustomerMutation, { isLoading: isCreating }] = useCreateCustomerMutation();
  const [updateCustomerMutation, { isLoading: isUpdating }] = useUpdateCustomerMutation();
  const [toggleStatusMutation] = useToggleCustomerStatusMutation();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Drawer / Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      customerType: 'WHOLESALE',
      businessName: '',
      email: '',
      address: '',
      city: 'Lahore',
      taxNumber: '',
      creditEnabled: true,
      creditLimit: 100000,
      creditTerms: '30 Days Net Credit',
      defaultDueDays: 30,
      notes: '',
    },
  });

  const creditEnabled = watch('creditEnabled');

  // Open Create Drawer
  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormError(null);
    reset({
      name: '',
      phone: '',
      customerType: 'WHOLESALE',
      businessName: '',
      email: '',
      address: '',
      city: 'Lahore',
      taxNumber: '',
      creditEnabled: true,
      creditLimit: 100000,
      creditTerms: '30 Days Net Credit',
      defaultDueDays: 30,
      notes: '',
    });
    setIsDrawerOpen(true);
  };

  // Open Edit Drawer
  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormError(null);
    reset({
      name: c.name,
      phone: c.phone,
      customerType: c.customerType,
      businessName: c.businessName || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || 'Lahore',
      taxNumber: c.taxNumber || '',
      creditEnabled: c.creditEnabled,
      creditLimit: c.creditLimit,
      creditTerms: c.creditTerms,
      defaultDueDays: c.defaultDueDays,
      notes: c.notes || '',
    });
    setIsDrawerOpen(true);
  };

  // Submit Handler
  const onSubmit = async (data: CustomerFormData) => {
    setFormError(null);
    try {
      if (editingCustomer) {
        await updateCustomerMutation({
          id: editingCustomer.id,
          data: {
            ...data,
            email: data.email || undefined,
            businessName: data.businessName || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            taxNumber: data.taxNumber || undefined,
            notes: data.notes || undefined,
          },
        }).unwrap();
        setSuccessToast(`Customer ${data.name} updated successfully.`);
      } else {
        await createCustomerMutation({
          ...data,
          email: data.email || undefined,
          businessName: data.businessName || undefined,
          address: data.address || undefined,
          city: data.city || undefined,
          taxNumber: data.taxNumber || undefined,
          notes: data.notes || undefined,
          status: 'ACTIVE',
        }).unwrap();
        setSuccessToast(`Customer ${data.name} created successfully.`);
      }

      setIsDrawerOpen(false);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      setFormError((err as Error).message || 'Failed to save customer');
    }
  };

  // Toggle status
  const handleToggleStatus = async (c: Customer) => {
    const newStatus: CustomerStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await toggleStatusMutation({ id: c.id, status: newStatus }).unwrap();
      setSuccessToast(`Customer ${c.name} status updated to ${newStatus}.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      alert(`Error toggling status: ${(err as Error).message}`);
    }
  };

  // Filtered List
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (typeFilter !== 'ALL' && c.customerType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name.toLowerCase().includes(q);
        const matchCode = (c.customerCode || c.code || '').toLowerCase().includes(q);
        const matchPhone = c.phone.includes(q);
        const matchBiz = (c.businessName || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPhone && !matchBiz) return false;
      }
      return true;
    });
  }, [customers, typeFilter, statusFilter, searchQuery]);

  // Overall KPIs
  const totalReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.currentOutstanding || 0), 0);
  }, [customers]);

  const wholesaleCount = useMemo(() => {
    return customers.filter((c) => c.customerType === 'WHOLESALE').length;
  }, [customers]);

  const distributorCount = useMemo(() => {
    return customers.filter((c) => c.customerType === 'DISTRIBUTOR').length;
  }, [customers]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight font-sans">
              Customer &amp; Dealer Accounts
            </h1>
            <p className="text-xs text-slate-500 font-sans">
              Manage multi-tier accounts, credit limits, account ledgers &amp; payment terms
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/payments/collections"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Payment Collections</span>
          </Link>
          <button
            type="button"
            id="add-customer-btn"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Total Customers</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 font-sans">
                {customers.length}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Active across all tiers</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Wholesale Dealers</p>
              <h3 className="text-2xl font-black text-amber-700 mt-1 font-sans">
                {wholesaleCount}
              </h3>
              <p className="text-[11px] text-amber-600 mt-0.5 font-medium">B2B Trade Accounts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Distributors</p>
              <h3 className="text-2xl font-black text-purple-700 mt-1 font-sans">
                {distributorCount}
              </h3>
              <p className="text-[11px] text-purple-600 mt-0.5 font-medium">Regional Primary Dealers</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold font-sans">Total Receivables</p>
              <h3 className="text-2xl font-black text-emerald-800 mt-1 font-sans">
                Rs. {totalReceivables.toLocaleString()}
              </h3>
              <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">Total Credit Outstanding</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, customer name, business or phone..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Tier:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Tiers</option>
              <option value="WALK_IN">Walk-in Accounts</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Customer / Business</th>
                  <th className="py-3.5 px-4">Tier Type</th>
                  <th className="py-3.5 px-4">Phone / City</th>
                  <th className="py-3.5 px-4 text-right">Credit Limit</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-right">Available Credit</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading customer registry...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No matching customers found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const availableCredit = Math.max(0, c.creditLimit - c.currentOutstanding);
                    const isExceeded = c.currentOutstanding >= c.creditLimit;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {c.customerCode}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block font-sans">
                            {c.name}
                          </span>
                          {c.businessName && (
                            <span className="text-[11px] text-slate-500 block">
                              {c.businessName}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              c.customerType === 'DISTRIBUTOR'
                                ? 'bg-purple-100 text-purple-700'
                                : c.customerType === 'WHOLESALE'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {c.customerType === 'DISTRIBUTOR' ? (
                              <Truck className="w-3 h-3" />
                            ) : c.customerType === 'WHOLESALE' ? (
                              <Building2 className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            <span>{c.customerType}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-slate-800 block">{c.phone}</span>
                          <span className="text-[11px] text-slate-400 block">{c.city || 'Punjab'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-sans">
                          Rs. {c.creditLimit.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 font-sans">
                          {c.currentOutstanding > 0 ? (
                            <span className="text-purple-800 font-bold">
                              Rs. {c.currentOutstanding.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">Rs. 0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold font-sans">
                          <span
                            className={isExceeded ? 'text-rose-600' : 'text-emerald-700'}
                          >
                            Rs. {availableCredit.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Ledger Action Link */}
                          <Link
                            href={`/customers/${c.id}/ledger`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="View Account Ledger"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Ledger</span>
                          </Link>

                          {/* Record Collection Link */}
                          <Link
                            href={`/payments/collections?customerId=${c.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="Collect Recovery Payment"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Collect</span>
                          </Link>

                          {/* Edit Customer */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="inline-flex items-center p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c)}
                            className={`inline-flex items-center p-1.5 rounded-lg transition-colors cursor-pointer ${
                              c.status === 'ACTIVE'
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:bg-slate-100'
                            }`}
                            title={c.status === 'ACTIVE' ? 'Deactivate Customer' : 'Activate Customer'}
                          >
                            <Power className="w-3.5 h-3.5" />
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

      {/* Customer Create/Edit Drawer Modal */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {editingCustomer ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800 font-sans">
                    {editingCustomer ? 'Edit Customer Details' : 'Register New Customer Account'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingCustomer
                      ? `Updating ${editingCustomer.customerCode}`
                      : 'Define pricing tier, contact information, and credit limit'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer / Contact Name *
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.name && (
                    <span className="text-[11px] text-rose-600 mt-0.5 block">
                      {errors.name.message}
                    </span>
                  )}
                </div>

                {/* Business Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business / Firm Name (Optional)
                  </label>
                  <input
                    type="text"
                    {...register('businessName')}
                    placeholder="e.g. Lahore Furniture Mart"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    {...register('phone')}
                    placeholder="e.g. 0300-1234567"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.phone && (
                    <span className="text-[11px] text-rose-600 mt-0.5 block">
                      {errors.phone.message}
                    </span>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="e.g. dealer@example.com"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.email && (
                    <span className="text-[11px] text-rose-600 mt-0.5 block">
                      {errors.email.message}
                    </span>
                  )}
                </div>

                {/* Customer Type / Tier */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer Price Tier *
                  </label>
                  <select
                    {...register('customerType')}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                  >
                    <option value="WALK_IN">Walk-in Account</option>
                    <option value="WHOLESALE">Wholesale Dealer</option>
                    <option value="DISTRIBUTOR">Distributor</option>
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    {...register('city')}
                    placeholder="e.g. Lahore, Gujranwala"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Tax Number */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tax / NTN / STRN Number (Optional)
                  </label>
                  <input
                    type="text"
                    {...register('taxNumber')}
                    placeholder="e.g. 1234567-8"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Credit Controls Sub-card */}
                <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Enable Customer Credit Facility
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Allow udhaar / credit billing at POS
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('creditEnabled')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {creditEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Credit Limit (PKR)
                        </label>
                        <input
                          type="number"
                          step={5000}
                          {...register('creditLimit', { valueAsNumber: true })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Default Due Days
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={180}
                          {...register('defaultDueDays', { valueAsNumber: true })}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Credit Terms Description
                        </label>
                        <input
                          type="text"
                          {...register('creditTerms')}
                          placeholder="e.g. 30 Days Net Credit"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || isUpdating}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isCreating || isUpdating
                    ? 'Saving...'
                    : editingCustomer
                    ? 'Save Changes'
                    : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
