'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProductVariant } from '@/types';
import {
  useUpdatePricingMutation,
  useGetProductsQuery,
  useGetSizesQuery,
  useGetThicknessQuery,
} from '@/store/services/apiSlice';
import { X, DollarSign, AlertTriangle, ArrowRight } from 'lucide-react';

const pricingSchema = z.object({
  retailPrice: z.number().min(0, 'Retail price cannot be negative'),
  wholesalePrice: z.number().min(0, 'Wholesale price cannot be negative'),
  reason: z.string().optional(),
});

type PricingFormData = z.infer<typeof pricingSchema>;

interface EditPriceModalProps {
  variant: ProductVariant | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: ProductVariant) => void;
  currentUserEmail?: string;
}

export default function EditPriceModal({
  variant,
  isOpen,
  onClose,
  onSuccess,
  currentUserEmail = 'admin@moltyfoam.com',
}: EditPriceModalProps) {
  const { data: products = [] } = useGetProductsQuery();
  const { data: sizes = [] } = useGetSizesQuery();
  const { data: thicknessList = [] } = useGetThicknessQuery();

  const [updatePricing, { isLoading }] = useUpdatePricingMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sizeMap = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const thicknessMap = useMemo(() => new Map(thicknessList.map((t) => [t.id, t])), [thicknessList]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PricingFormData>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      retailPrice: 0,
      wholesalePrice: 0,
      reason: 'Standard seasonal catalogue price revision',
    },
  });

  const currentRetail = watch('retailPrice');
  const currentWholesale = watch('wholesalePrice');

  useEffect(() => {
    if (variant) {
      reset({
        retailPrice: variant.retailPrice,
        wholesalePrice: variant.wholesalePrice,
        reason: '',
      });
      setApiError(null);
    }
  }, [variant, reset, isOpen]);

  if (!isOpen || !variant) return null;

  const product = productMap.get(variant.productId);
  const size = sizeMap.get(variant.sizeId);
  const thickness = thicknessMap.get(variant.thicknessId);

  const wholesaleExceedsRetail =
    Number(currentWholesale) > Number(currentRetail) && Number(currentRetail) > 0;

  const onSubmit = async (data: PricingFormData) => {
    setApiError(null);
    try {
      const result = await updatePricing({
        variantId: variant.id,
        retailPrice: Number(data.retailPrice),
        wholesalePrice: Number(data.wholesalePrice),
        reason: data.reason?.trim() || 'Manual price adjustment',
        changedBy: currentUserEmail,
      }).unwrap();
      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to update pricing';
      setApiError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="price-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-semibold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 id="price-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                Update Variant Pricing
              </h2>
              <p className="text-xs text-gray-500">
                Set individual retail & wholesale rates for SKU
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

        {/* Variant Summary */}
        <div className="p-4 mx-6 mt-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 text-sm">{product?.name}</span>
            <span className="font-mono text-brand-blue font-bold px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
              {variant.sku}
            </span>
          </div>
          <div className="text-gray-500">
            Dimensions: {size?.displayLabel || 'Standard'} &bull; Thickness: {thickness?.displayLabel || 'Standard'}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {apiError && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg">
              {apiError}
            </div>
          )}

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Retail Price (PKR) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  Rs.
                </span>
                <input
                  type="number"
                  step="1"
                  {...register('retailPrice', { valueAsNumber: true })}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
                />
              </div>
              {errors.retailPrice && (
                <p className="text-xs text-red-600 mt-1">{errors.retailPrice.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Wholesale Price (PKR) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  Rs.
                </span>
                <input
                  type="number"
                  step="1"
                  {...register('wholesalePrice', { valueAsNumber: true })}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
                />
              </div>
              {errors.wholesalePrice && (
                <p className="text-xs text-red-600 mt-1">{errors.wholesalePrice.message}</p>
              )}
            </div>
          </div>

          {/* Warning banner if wholesale exceeds retail */}
          {wholesaleExceedsRetail && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Pricing Rule Advisory:</span>
                Wholesale price (Rs. {Number(currentWholesale).toLocaleString()}) is higher than retail
                price (Rs. {Number(currentRetail).toLocaleString()}). This is permitted for special
                contract rates, but please verify before saving.
              </div>
            </div>
          )}

          {/* Price Change Preview */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
            <span className="font-semibold text-gray-700 block">Price Comparison Preview</span>
            <div className="flex items-center justify-between text-gray-600">
              <span>Previous Retail: Rs. {variant.retailPrice.toLocaleString()}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-semibold text-gray-900">
                New Retail: Rs. {Number(currentRetail || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Previous Wholesale: Rs. {variant.wholesalePrice.toLocaleString()}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-semibold text-gray-900">
                New Wholesale: Rs. {Number(currentWholesale || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Change Reason (Audit Log)
            </label>
            <input
              {...register('reason')}
              placeholder="e.g. Q4 Dealer discount update or Raw material adjustment"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
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
              disabled={isLoading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isLoading ? 'Updating...' : 'Save Prices'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
