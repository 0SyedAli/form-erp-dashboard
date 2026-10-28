'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BranchType, Branch } from '@/types';
import { DEMO_USERS } from '@/data/mockData';
import { useUpdateBranchMutation } from '@/store/services/apiSlice';
import PhotoUploadInput from './PhotoUploadInput';
import { X, Edit2, Building2 } from 'lucide-react';

const editBranchSchema = z.object({
  name: z.string().min(3, 'Branch name must be at least 3 characters'),
  code: z
    .string()
    .min(2, 'Code is required')
    .regex(/^[A-Za-z0-9\-_#]+$/, 'Code can only contain letters, numbers, hyphens, and underscores'),
  shopNumber: z.string().min(2, 'Shop number is required'),
  type: z.enum([
    'RETAIL_STORE',
    'SHOWROOM',
    'WHOLESALE_DEPOT',
    'WAREHOUSE',
    'EXPRESS_COUNTER',
  ]),
  city: z.string().min(2, 'City/Market district is required'),
  address: z.string().min(5, 'Detailed physical address is required'),
  phone: z.string().min(7, 'Valid contact number is required'),
  managerId: z.string().optional(),
  targetMonthlySales: z.number().min(0, 'Target sales must be positive'),
  allowRetailSales: z.boolean(),
  allowWholesaleSales: z.boolean(),
  manageOwnInventory: z.boolean(),
  showInReports: z.boolean(),
});

type EditBranchFormData = z.infer<typeof editBranchSchema>;

interface EditBranchModalProps {
  branch: Branch | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Branch) => void;
}

export default function EditBranchModal({
  branch,
  isOpen,
  onClose,
  onSuccess,
}: EditBranchModalProps) {
  if (!isOpen || !branch) return null;

  return (
    <EditBranchModalContent
      key={branch.id}
      branch={branch}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function EditBranchModalContent({
  branch,
  onClose,
  onSuccess,
}: {
  branch: Branch;
  onClose: () => void;
  onSuccess: (updated: Branch) => void;
}) {
  const [updateBranch, { isLoading }] = useUpdateBranchMutation();
  const [photoUrl, setPhotoUrl] = useState<string>(branch.imageUrl || '');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditBranchFormData>({
    resolver: zodResolver(editBranchSchema),
    defaultValues: {
      name: branch.name,
      code: branch.code,
      shopNumber: branch.shopNumber || branch.code,
      type: branch.type || 'RETAIL_STORE',
      city: branch.city,
      address: branch.address,
      phone: branch.phone,
      managerId: branch.managerId || '',
      targetMonthlySales: branch.targetMonthlySales || 2500000,
      allowRetailSales: branch.settings?.allowRetailSales ?? true,
      allowWholesaleSales: branch.settings?.allowWholesaleSales ?? true,
      manageOwnInventory: branch.settings?.manageOwnInventory ?? false,
      showInReports: branch.settings?.showInReports ?? true,
    },
  });

  const onSubmit = async (data: EditBranchFormData) => {
    setServerError(null);

    try {
      const result = await updateBranch({
        id: branch.id,
        input: {
          name: data.name,
          code: data.code,
          shopNumber: data.shopNumber,
          type: data.type as BranchType,
          city: data.city,
          address: data.address,
          phone: data.phone,
          managerId: data.managerId || undefined,
          targetMonthlySales: data.targetMonthlySales,
          imageUrl: photoUrl || undefined,
          settings: {
            allowRetailSales: data.allowRetailSales,
            allowWholesaleSales: data.allowWholesaleSales,
            manageOwnInventory: data.manageOwnInventory,
            showInReports: data.showInReports,
          },
        },
      }).unwrap();

      onSuccess(result);
      onClose();
    } catch (err) {
      setServerError((err as { data?: string })?.data || 'Failed to update branch details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="edit-branch-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-brand-navy text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="edit-branch-title" className="text-lg font-semibold tracking-tight">
                Edit Branch: {branch.name}
              </h2>
              <p className="text-[13px] text-slate-300">
                Update location details, manager assignment, and operational parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto p-6 space-y-5 text-sm">
          {serverError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 font-medium">
              {serverError}
            </div>
          )}

          {/* Section 1: Identification */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-blue" />
              <span>Location Identification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Branch Name *
                </label>
                <input
                  type="text"
                  {...register('name')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                />
                {errors.name && (
                  <span className="text-xs text-red-600 mt-1 block">{errors.name.message}</span>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Unique Branch Code *
                </label>
                <input
                  type="text"
                  {...register('code')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-mono text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white uppercase"
                />
                {errors.code && (
                  <span className="text-xs text-red-600 mt-1 block">{errors.code.message}</span>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Shop / Stall Number *
                </label>
                <input
                  type="text"
                  {...register('shopNumber')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                />
                {errors.shopNumber && (
                  <span className="text-xs text-red-600 mt-1 block">{errors.shopNumber.message}</span>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Branch Type *
                </label>
                <select
                  {...register('type')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                >
                  <option value="RETAIL_STORE">Retail Store (Walk-in Counter)</option>
                  <option value="SHOWROOM">Showroom / Display Center</option>
                  <option value="WHOLESALE_DEPOT">Wholesale Depot / Godown</option>
                  <option value="WAREHOUSE">Warehouse / Central Storage</option>
                  <option value="EXPRESS_COUNTER">Express Counter / Accessories</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Location */}
          <div className="pt-2 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  City / Commercial District *
                </label>
                <input
                  type="text"
                  {...register('city')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                />
                {errors.city && (
                  <span className="text-xs text-red-600 mt-1 block">{errors.city.message}</span>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Contact Phone Number *
                </label>
                <input
                  type="text"
                  {...register('phone')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-mono text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                />
                {errors.phone && (
                  <span className="text-xs text-red-600 mt-1 block">{errors.phone.message}</span>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Physical Address in Market *
                </label>
                <input
                  type="text"
                  {...register('address')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                />
                {errors.address && (
                  <span className="text-xs text-red-600 mt-1 block">{errors.address.message}</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Manager & Financial Target */}
          <div className="pt-2 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Assigned Branch Manager
                </label>
                <select
                  {...register('managerId')}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                >
                  <option value="">-- No Manager Assigned --</option>
                  {DEMO_USERS.filter((u) => u.role === 'BRANCH_MANAGER').map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1.5 text-sm">
                  Monthly Target Sales (Rs.)
                </label>
                <input
                  type="number"
                  step="100000"
                  {...register('targetMonthlySales', { valueAsNumber: true })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-hidden focus:ring-1 focus:ring-brand-blue focus:bg-white"
                />
                {errors.targetMonthlySales && (
                  <span className="text-xs text-red-600 mt-1 block">
                    {errors.targetMonthlySales.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Storefront Photo */}
          <div className="pt-2 border-t border-gray-100">
            <PhotoUploadInput
              value={photoUrl}
              onChange={(url) => setPhotoUrl(url)}
              label="Storefront Photo"
            />
          </div>

          {/* Section 5: Operational Settings */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-2.5">
              Operational Governance Settings
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('allowRetailSales')}
                  className="mt-0.5 rounded text-brand-blue"
                />
                <div>
                  <span className="font-medium text-gray-800 block text-sm">Allow Retail Sales</span>
                  <span className="text-xs text-gray-400">Enable counter billing for walk-in buyers</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('allowWholesaleSales')}
                  className="mt-0.5 rounded text-brand-blue"
                />
                <div>
                  <span className="font-medium text-gray-800 block text-sm">Allow Wholesale Orders</span>
                  <span className="text-xs text-gray-400">Authorize B2B wholesale pricing</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('manageOwnInventory')}
                  className="mt-0.5 rounded text-brand-blue"
                />
                <div>
                  <span className="font-medium text-gray-800 block text-sm">Manage Own Inventory</span>
                  <span className="text-xs text-gray-400">Independent local stock reordering</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('showInReports')}
                  className="mt-0.5 rounded text-brand-blue"
                />
                <div>
                  <span className="font-medium text-gray-800 block text-sm">Include in Reports</span>
                  <span className="text-xs text-gray-400">Show in executive consolidated audits</span>
                </div>
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-lg bg-brand-blue hover:bg-blue-700 text-white text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
