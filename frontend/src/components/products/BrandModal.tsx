'use client';

import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Brand } from '@/types';
import { useCreateBrandMutation, useUpdateBrandMutation } from '@/store/services/apiSlice';
import ProductImageUpload from './ProductImageUpload';
import { X, Award } from 'lucide-react';

const brandSchema = z.object({
  name: z.string().min(2, 'Brand name must be at least 2 characters'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code cannot exceed 10 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens or underscores'),
  description: z.string().optional(),
  logo: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type BrandFormData = z.infer<typeof brandSchema>;

interface BrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand?: Brand | null;
  onSuccess: (brand: Brand) => void;
}

const BRAND_LOGO_PRESETS = [
  { name: 'Molty Logo', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80' },
  { name: 'Dura Logo', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=300&q=80' },
  { name: 'Master Logo', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=300&q=80' },
];

export default function BrandModal({
  isOpen,
  onClose,
  brand,
  onSuccess,
}: BrandModalProps) {
  const [createBrand, { isLoading: isCreating }] = useCreateBrandMutation();
  const [updateBrand, { isLoading: isUpdating }] = useUpdateBrandMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const isEdit = !!brand;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      logo: '',
      status: 'active',
    },
  });

  const logoValue = useWatch({ control, name: 'logo' });

  useEffect(() => {
    if (brand) {
      reset({
        name: brand.name,
        code: brand.code,
        description: brand.description || '',
        logo: brand.logo || '',
        status: (brand.status.toLowerCase() as 'active' | 'inactive') || 'active',
      });
    } else {
      reset({
        name: '',
        code: '',
        description: '',
        logo: '',
        status: 'active',
      });
    }
  }, [brand, reset, isOpen]);

  const handleClose = () => {
    setApiError(null);
    onClose();
  };

  if (!isOpen) return null;

  const onSubmit = async (data: BrandFormData) => {
    setApiError(null);
    try {
      if (isEdit && brand) {
        const result = await updateBrand({
          id: brand.id,
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          description: data.description?.trim(),
          logo: data.logo,
          status: data.status,
        }).unwrap();
        onSuccess(result);
      } else {
        const result = await createBrand({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          description: data.description?.trim(),
          logo: data.logo,
          status: data.status,
        }).unwrap();
        onSuccess(result);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to save brand';
      setApiError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="brand-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue font-semibold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 id="brand-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                {isEdit ? 'Edit Brand' : 'Add New Brand'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit ? 'Update brand details and logo' : 'Register brand in the catalogue'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {apiError && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {apiError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Brand Name *
              </label>
              <input
                {...register('name')}
                placeholder="e.g. Dura Foam"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Brand Code *
              </label>
              <input
                {...register('code')}
                placeholder="e.g. DURA"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 uppercase focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.code && (
                <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="e.g. Premium orthopaedic and memory foam bedding solutions"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              {...register('status')}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Logo Upload with Canvas Compression */}
          <div className="pt-2 border-t border-gray-100">
            <ProductImageUpload
              label="Brand Logo"
              value={logoValue}
              onChange={(dataUrl) => setValue('logo', dataUrl)}
              shape="rounded"
              presets={BRAND_LOGO_PRESETS}
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-5 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
