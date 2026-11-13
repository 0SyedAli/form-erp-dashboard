'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProductLine } from '@/types';
import {
  useCreateProductLineMutation,
  useUpdateProductLineMutation,
  useGetBrandsQuery,
  useGetCategoriesQuery,
} from '@/store/services/catalogueApi';
import { X, Network } from 'lucide-react';

const productLineSchema = z.object({
  brandId: z.string().min(1, 'Please select a brand'),
  categoryId: z.string().min(1, 'Please select a category'),
  name: z.string().min(2, 'Product Line name must be at least 2 characters'),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code cannot exceed 20 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens or underscores'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type ProductLineFormData = z.infer<typeof productLineSchema>;

interface ProductLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  productLine?: ProductLine | null;
  defaultBrandId?: string;
  defaultCategoryId?: string;
  onSuccess: (pl: ProductLine) => void;
}

export default function ProductLineModal({
  isOpen,
  onClose,
  productLine,
  defaultBrandId,
  defaultCategoryId,
  onSuccess,
}: ProductLineModalProps) {
  const { data: rawBrands = [] } = useGetBrandsQuery();
  const { data: rawCategories = [] } = useGetCategoriesQuery();

  const [createProductLine, { isLoading: isCreating }] = useCreateProductLineMutation();
  const [updateProductLine, { isLoading: isUpdating }] = useUpdateProductLineMutation();

  const [apiError, setApiError] = useState<string | null>(null);
  const isEdit = !!productLine;

  const brands = useMemo(() => {
    return (Array.isArray(rawBrands) ? rawBrands : []).map((b: any) => ({
      id: String(b.id || b._id || ''),
      name: b.name || '',
      code: b.code || '',
    }));
  }, [rawBrands]);

  const categories = useMemo(() => {
    return (Array.isArray(rawCategories) ? rawCategories : []).map((c: any) => ({
      id: String(c.id || c._id || ''),
      brandId: String(c.brandId?._id || c.brandId || ''),
      name: c.name || '',
      code: c.code || '',
    }));
  }, [rawCategories]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductLineFormData>({
    resolver: zodResolver(productLineSchema),
    defaultValues: {
      brandId: defaultBrandId || '',
      categoryId: defaultCategoryId || '',
      name: '',
      code: '',
      description: '',
      status: 'active',
    },
  });

  const selectedBrandId = watch('brandId');

  // Filter categories by selected brand
  const filteredCategories = useMemo(() => {
    if (!selectedBrandId) return categories;
    return categories.filter((c) => c.brandId === selectedBrandId);
  }, [categories, selectedBrandId]);

  useEffect(() => {
    if (!isOpen) return;

    if (productLine) {
      reset({
        brandId: productLine.brandId || '',
        categoryId: productLine.categoryId || '',
        name: productLine.name || '',
        code: productLine.code || '',
        description: productLine.description || '',
        status: (productLine.status?.toLowerCase() as 'active' | 'inactive') || 'active',
      });
    } else {
      reset({
        brandId: defaultBrandId || (brands[0]?.id ?? ''),
        categoryId: defaultCategoryId || '',
        name: '',
        code: '',
        description: '',
        status: 'active',
      });
    }
    setApiError(null);
  }, [isOpen, productLine, defaultBrandId, defaultCategoryId, brands, reset]);

  // Auto-generate code candidate when typing name in create mode
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!isEdit) {
      const slug = val
        .trim()
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 8)
        .toUpperCase();
      setValue('code', slug ? `PL-${slug}` : '');
    }
  };

  const onSubmit = async (data: ProductLineFormData) => {
    setApiError(null);
    try {
      if (isEdit && productLine) {
        const result = await updateProductLine({
          id: productLine.id,
          brandId: data.brandId,
          categoryId: data.categoryId,
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          description: data.description?.trim(),
          status: data.status.toUpperCase(),
        }).unwrap();
        onSuccess(result as any);
      } else {
        const result = await createProductLine({
          brandId: data.brandId,
          categoryId: data.categoryId,
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          description: data.description?.trim(),
          status: data.status.toUpperCase(),
        }).unwrap();
        onSuccess(result as any);
      }
      onClose();
    } catch (err: any) {
      setApiError(err?.data?.message || err?.message || 'Failed to save product line.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isEdit ? 'Edit Product Line' : 'Add Product Line'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit ? 'Update product line details' : 'Create a sub-category under a brand & category'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
              {apiError}
            </div>
          )}

          {/* Brand Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Brand <span className="text-red-500">*</span>
            </label>
            <select
              {...register('brandId')}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">-- Select Brand --</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {errors.brandId && (
              <p className="text-[11px] text-red-500 mt-1">{errors.brandId.message}</p>
            )}
          </div>

          {/* Main Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Main Category <span className="text-red-500">*</span>
            </label>
            <select
              {...register('categoryId')}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">-- Select Main Category --</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-[11px] text-red-500 mt-1">{errors.categoryId.message}</p>
            )}
          </div>

          {/* Product Line Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Product Line Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Crest, AIPA, Bravo, Molty"
              {...register('name')}
              onChange={(e) => {
                register('name').onChange(e);
                handleNameChange(e);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {errors.name && (
              <p className="text-[11px] text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. PL-CREST"
              {...register('code')}
              className="w-full px-3 py-2 text-xs font-mono uppercase border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {errors.code && (
              <p className="text-[11px] text-red-500 mt-1">{errors.code.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Optional notes or details about this product line"
              {...register('description')}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
            <select
              {...register('status')}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating || isUpdating}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-blue hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Update Line' : 'Create Line'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

