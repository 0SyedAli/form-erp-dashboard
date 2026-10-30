'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CatalogueProduct } from '@/types';
import {
  useCreateProductMutation,
  useUpdateProductMutation,
  useGetBrandsQuery,
  useGetCategoriesQuery,
} from '@/store/services/apiSlice';
import ProductImageUpload from './ProductImageUpload';
import { X, Package, AlertCircle } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  code: z
    .string()
    .min(2, 'Product code must be at least 2 characters')
    .max(15, 'Product code cannot exceed 15 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens or underscores'),
  brandId: z.string().min(1, 'Please select a brand'),
  categoryId: z.string().min(1, 'Please select a category'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: CatalogueProduct | null;
  onSuccess: (product: CatalogueProduct) => void;
}

const PRODUCT_IMAGE_PRESETS = [
  { name: 'Luxury Mattress', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=80' },
  { name: 'Orthopaedic Foam', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80' },
  { name: 'Spring Pocket', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80' },
];

export default function ProductModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProductModalProps) {
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: categories = [] } = useGetCategoriesQuery();

  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const isEdit = !!product;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      code: '',
      brandId: '',
      categoryId: '',
      description: '',
      imageUrl: '',
      status: 'active',
    },
  });

  const selectedBrandId = useWatch({ control, name: 'brandId' });
  const imageUrlValue = useWatch({ control, name: 'imageUrl' });

  // Filter categories to only those belonging to the selected brand
  const brandCategories = useMemo(() => {
    if (!selectedBrandId) return [];
    return categories.filter(
      (c) => c.brandId === selectedBrandId && (c.status === 'active' || c.status === 'ACTIVE')
    );
  }, [categories, selectedBrandId]);

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        code: product.code,
        brandId: product.brandId,
        categoryId: product.categoryId,
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        status: (product.status.toLowerCase() as 'active' | 'inactive') || 'active',
      });
    } else {
      const defaultBrand = brands[0]?.id || '';
      reset({
        name: '',
        code: '',
        brandId: defaultBrand,
        categoryId: '',
        description: '',
        imageUrl: '',
        status: 'active',
      });
    }
  }, [product, brands, reset, isOpen]);

  const handleClose = () => {
    setApiError(null);
    onClose();
  };

  // When brand changes, if current category does not belong to new brand, reset it
  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBrandId = e.target.value;
    setValue('brandId', newBrandId);
    setValue('categoryId', '');
  };

  if (!isOpen) return null;

  const onSubmit = async (data: ProductFormData) => {
    setApiError(null);
    try {
      if (isEdit && product) {
        const result = await updateProduct({
          id: product.id,
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          brandId: data.brandId,
          categoryId: data.categoryId,
          description: data.description?.trim(),
          imageUrl: data.imageUrl,
          status: data.status,
        }).unwrap();
        onSuccess(result);
      } else {
        const result = await createProduct({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          brandId: data.brandId,
          categoryId: data.categoryId,
          description: data.description?.trim(),
          imageUrl: data.imageUrl,
          status: data.status,
        }).unwrap();
        onSuccess(result);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to save product';
      setApiError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="product-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue font-semibold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 id="product-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                {isEdit ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit
                  ? 'Update product details and specifications'
                  : 'Register a base product in the catalogue'}
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
                Product Name *
              </label>
              <input
                {...register('name')}
                placeholder="e.g. Dura Luxury Mattress"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Product Code *
              </label>
              <input
                {...register('code')}
                placeholder="e.g. DURA-LUX"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 uppercase focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.code && (
                <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>
              )}
            </div>
          </div>

          {/* Dependent Brand and Category Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Brand *
              </label>
              <select
                {...register('brandId')}
                onChange={handleBrandChange}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white"
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                {...register('categoryId')}
                disabled={!selectedBrandId || brandCategories.length === 0}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white disabled:opacity-50"
              >
                <option value="">
                  {!selectedBrandId
                    ? 'Select a brand first'
                    : brandCategories.length === 0
                    ? 'No categories for this brand'
                    : 'Select Category'}
                </option>
                {brandCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-xs text-red-600 mt-1">{errors.categoryId.message}</p>
              )}
              {selectedBrandId && brandCategories.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Please add a category to this brand first.
                </p>
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
              placeholder="e.g. Ergonomic high-resilience foam mattress with cool touch quilting"
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

          {/* Product Image */}
          <div className="pt-2 border-t border-gray-100">
            <ProductImageUpload
              label="Product Image"
              value={imageUrlValue}
              onChange={(dataUrl) => setValue('imageUrl', dataUrl)}
              shape="rounded"
              presets={PRODUCT_IMAGE_PRESETS}
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
              {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
