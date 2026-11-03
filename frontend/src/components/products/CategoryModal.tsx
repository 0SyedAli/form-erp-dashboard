'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Category } from '@/types';
import {
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useGetBrandsQuery,
} from '@/store/services/apiSlice';
import { X, Layers } from 'lucide-react';

const categorySchema = z.object({
  brandId: z.string().min(1, 'Please select a brand'),
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code cannot exceed 10 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens or underscores'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null;
  defaultBrandId?: string;
  onSuccess: (cat: Category) => void;
}

export default function CategoryModal({
  isOpen,
  onClose,
  category,
  defaultBrandId,
  onSuccess,
}: CategoryModalProps) {
  const { data: brands = [] } = useGetBrandsQuery();
  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const isEdit = !!category;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      brandId: defaultBrandId || '',
      name: '',
      code: '',
      description: '',
      status: 'active',
    },
  });

  useEffect(() => {
    if (category) {
      reset({
        brandId: category.brandId,
        name: category.name,
        code: category.code,
        description: category.description || '',
        status: (category.status.toLowerCase() as 'active' | 'inactive') || 'active',
      });
    } else {
      reset({
        brandId: defaultBrandId || (brands[0]?.id ?? ''),
        name: '',
        code: '',
        description: '',
        status: 'active',
      });
    }
  }, [category, defaultBrandId, brands, reset, isOpen]);

  if (!isOpen) return null;

  const onSubmit = async (data: CategoryFormData) => {
    setApiError(null);
    try {
      if (isEdit && category) {
        const result = await updateCategory({
          id: category.id,
          brandId: data.brandId,
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          description: data.description?.trim(),
          status: data.status,
        }).unwrap();
        onSuccess(result);
      } else {
        const result = await createCategory({
          brandId: data.brandId,
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          description: data.description?.trim(),
          status: data.status,
        }).unwrap();
        onSuccess(result);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to save category';
      setApiError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="category-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-semibold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="category-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                {isEdit ? 'Edit Category' : 'Add Brand Category'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit
                  ? 'Update category settings for selected brand'
                  : 'Create independent category for a specific brand'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Parent Brand *
            </label>
            <select
              {...register('brandId')}
              disabled={isEdit}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white disabled:opacity-60"
            >
              <option value="">Select Brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {errors.brandId && (
              <p className="text-xs text-red-600 mt-1">{errors.brandId.message}</p>
            )}
            {isEdit && (
              <p className="text-[11px] text-gray-400 mt-1">
                Parent brand cannot be changed after creation to maintain product relations.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Category Name *
              </label>
              <input
                {...register('name')}
                placeholder="e.g. Ultra Luxury"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Category Code *
              </label>
              <input
                {...register('code')}
                placeholder="e.g. U-LUX"
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
              placeholder="e.g. High density orthopaedic foam mattress series"
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

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-5 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
