'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import PurchasesNavTabs from '@/components/purchases/PurchasesNavTabs';
import { useAppSelector, RootState } from '@/store';
import {
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useToggleSupplierStatusMutation,
} from '@/store/services/apiSlice';
import { hasPermission } from '@/lib/permissions';
import { Supplier } from '@/types';
import {
  Search,
  Plus,
  Edit2,
  Power,
  Eye,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const supplierSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  contactPerson: z.string().min(2, 'Contact person is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  taxNumber: z.string().optional(),
  paymentTerms: z.string().min(1, 'Payment terms required'),
  defaultDueDays: z.number().min(0, 'Due days must be positive'),
  creditLimit: z.number().min(0, 'Credit limit must be positive'),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  notes: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

function SuppliersDirectoryContent() {
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const { data: suppliers = [], isLoading } = useGetSuppliersQuery();
  const [createSupplierMutation, { isLoading: isCreating }] = useCreateSupplierMutation();
  const [updateSupplierMutation, { isLoading: isUpdating }] = useUpdateSupplierMutation();
  const [toggleStatusMutation] = useToggleSupplierStatusMutation();

  const canCreate = hasPermission(currentUser, 'suppliers.create');
  const canEdit = hasPermission(currentUser, 'suppliers.edit');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      taxNumber: '',
      paymentTerms: 'Net 30',
      defaultDueDays: 30,
      creditLimit: 5000000,
      bankName: '',
      bankAccountNumber: '',
      notes: '',
    },
  });

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setModalError(null);
    reset({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: 'Lahore',
      taxNumber: '',
      paymentTerms: 'Net 30',
      defaultDueDays: 30,
      creditLimit: 5000000,
      bankName: '',
      bankAccountNumber: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setModalError(null);
    reset({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      taxNumber: supplier.taxNumber || '',
      paymentTerms: supplier.paymentTerms || 'Net 30',
      defaultDueDays: supplier.defaultDueDays || supplier.defaultCreditDays || 30,
      creditLimit: supplier.creditLimit || 5000000,
      bankName: supplier.bankName || '',
      bankAccountNumber: supplier.bankAccountNumber || '',
      notes: supplier.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleStatusMutation(id).unwrap();
    } catch (err: unknown) {
      alert((err as { data?: string })?.data || 'Failed to update supplier status.');
    }
  };

  const onSubmit = async (data: SupplierFormData) => {
    setModalError(null);
    try {
      if (editingSupplier) {
        await updateSupplierMutation({
          id: editingSupplier.id,
          data: {
            ...data,
            email: data.email || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            taxNumber: data.taxNumber || undefined,
            bankName: data.bankName || undefined,
            bankAccountNumber: data.bankAccountNumber || undefined,
            notes: data.notes || undefined,
          },
        }).unwrap();
      } else {
        await createSupplierMutation({
          ...data,
          email: data.email || undefined,
          address: data.address || 'Address not registered',
          city: data.city || 'Lahore',
          taxNumber: data.taxNumber || undefined,
          bankName: data.bankName || undefined,
          bankAccountNumber: data.bankAccountNumber || undefined,
          notes: data.notes || undefined,
        }).unwrap();
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setModalError((err as { data?: string })?.data || 'Failed to save supplier.');
    }
  };

  // Filtered List
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.contactPerson.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          (s.city && s.city.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [suppliers, statusFilter, searchQuery]);

  const totalOutstandingAP = suppliers.reduce((sum, s) => sum + s.currentOutstanding, 0);

  return (
    <AppLayout>
      <PurchasesNavTabs />

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Suppliers & Manufacturers</h1>
            <p className="text-sm text-slate-500 mt-1">
              Registered foam and mattress vendors, credit agreements, and running ledger accounts
            </p>
          </div>

          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 bg-brand-burgundy hover:bg-rose-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Supplier</span>
            </button>
          )}
        </div>

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Active Vendors
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {suppliers.filter((s) => s.status === 'ACTIVE').length}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">{suppliers.length} total registered</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Accounts Payable
            </span>
            <span className="text-2xl font-bold text-rose-700 mt-1 block">
              Rs. {totalOutstandingAP.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">Sum of all vendor credit balances</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Disbursements
              </span>
              <p className="text-xs text-slate-500 mt-1">Pay supplier invoices with multi-bill vouchers</p>
            </div>
            <Link
              href="/payments/suppliers"
              className="px-3.5 py-2 bg-brand-burgundy text-white rounded-lg text-xs font-semibold hover:bg-rose-900 transition-colors shrink-0"
            >
              Make Payment
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by company name, code, contact person, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-brand-burgundy"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Suppliers</option>
                <option value="INACTIVE">Inactive Suppliers</option>
              </select>
            </div>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Payment Terms</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Outstanding (A/P)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading suppliers...
                    </td>
                  </tr>
                ) : filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="font-bold text-slate-900 hover:text-brand-burgundy hover:underline block"
                        >
                          {s.name}
                        </Link>
                        <span className="text-xs text-slate-400 font-mono mt-0.5 block">{s.code}</span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800 block">{s.contactPerson}</span>
                        <span className="text-slate-400 block mt-0.5">{s.phone}</span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">{s.city || '—'}</td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                        {s.paymentTerms || 'Net 30'}
                      </td>

                      <td className="py-3.5 px-4 text-right text-xs text-slate-600 whitespace-nowrap">
                        Rs. {(s.creditLimit || 5000000).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold text-sm ${
                            s.currentOutstanding > 0 ? 'text-rose-700' : 'text-slate-400'
                          }`}
                        >
                          Rs. {s.currentOutstanding.toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/suppliers/${s.id}/ledger`}
                            className="p-1.5 text-slate-500 hover:text-brand-burgundy hover:bg-slate-100 rounded-md transition-colors"
                            title="View Running Ledger"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/suppliers/${s.id}`}
                            className="p-1.5 text-slate-500 hover:text-brand-burgundy hover:bg-slate-100 rounded-md transition-colors"
                            title="View Supplier Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(s)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Edit Supplier"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleToggleStatus(s.id)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  s.status === 'ACTIVE'
                                    ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'
                                    : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800'
                                }`}
                                title={s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No suppliers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingSupplier ? 'Edit Supplier Details' : 'Register New Supplier'}
                </h2>
                <p className="text-xs text-slate-500">Configure procurement partner and credit terms</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Company Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company / Manufacturer Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    placeholder="e.g. Master Molty Foam Plant #1"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                  {errors.name && (
                    <span className="text-[11px] text-rose-600 mt-0.5 block">{errors.name.message}</span>
                  )}
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('contactPerson')}
                    placeholder="e.g. Tariq Mahmood"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                  {errors.contactPerson && (
                    <span className="text-[11px] text-rose-600 mt-0.5 block">
                      {errors.contactPerson.message}
                    </span>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('phone')}
                    placeholder="e.g. 0300-1234567"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                  {errors.phone && (
                    <span className="text-[11px] text-rose-600 mt-0.5 block">{errors.phone.message}</span>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="sales@supplier.com"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    {...register('city')}
                    placeholder="e.g. Lahore / Gujranwala"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Terms <span className="text-rose-600">*</span>
                  </label>
                  <select
                    {...register('paymentTerms')}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Advance">100% Advance</option>
                    <option value="COD">Cash on Delivery</option>
                  </select>
                </div>

                {/* Default Due Days */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Due Days</label>
                  <input
                    type="number"
                    min={0}
                    {...register('defaultDueDays', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Credit Limit */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Limit (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    {...register('creditLimit', { valueAsNumber: true })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Tax / STRN Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NTN / STRN</label>
                  <input
                    type="text"
                    {...register('taxNumber')}
                    placeholder="e.g. 1234567-8"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    {...register('bankName')}
                    placeholder="e.g. Meezan Bank Ltd"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Bank Account / IBAN */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account # / IBAN</label>
                  <input
                    type="text"
                    {...register('bankAccountNumber')}
                    placeholder="PK..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Factory / Office Address</label>
                  <input
                    type="text"
                    {...register('address')}
                    placeholder="Plot / Industrial Area..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-burgundy"
                  />
                </div>
              </div>

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
                  disabled={isCreating || isUpdating}
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand-burgundy hover:bg-rose-900 rounded-lg shadow-xs transition-colors"
                >
                  {isCreating || isUpdating ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function SuppliersDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-sans">
          Loading Supplier Directory...
        </div>
      }
    >
      <SuppliersDirectoryContent />
    </Suspense>
  );
}
