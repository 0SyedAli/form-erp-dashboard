'use client';

import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MattressSize } from '@/types';
import { useCreateSizeMutation, useUpdateSizeMutation } from '@/store/services/apiSlice';
import { X, Maximize2 } from 'lucide-react';

const sizeSchema = z.object({
  length: z.number().positive('Length must be greater than 0'),
  width: z.number().positive('Width must be greater than 0'),
  unit: z.enum(['inch', 'cm', 'mm']),
  displayLabel: z.string().min(2, 'Display label must be at least 2 characters'),
  status: z.enum(['active', 'inactive']),
});

type SizeFormData = z.infer<typeof sizeSchema>;

interface SizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: MattressSize | null;
  onSuccess: (size: MattressSize) => void;
}

export default function SizeModal({
  isOpen,
  onClose,
  size,
  onSuccess,
}: SizeModalProps) {
  const [createSize, { isLoading: isCreating }] = useCreateSizeMutation();
  const [updateSize, { isLoading: isUpdating }] = useUpdateSizeMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const isEdit = !!size;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<SizeFormData>({
    resolver: zodResolver(sizeSchema),
    defaultValues: {
      length: 78,
      width: 72,
      unit: 'inch',
      displayLabel: '78×72',
      status: 'active',
    },
  });

  const lengthVal = useWatch({ control, name: 'length' });
  const widthVal = useWatch({ control, name: 'width' });

  // Suggest display label if user changes length or width
  const handleAutoLabel = () => {
    if (lengthVal && widthVal) {
      setValue('displayLabel', `${lengthVal}×${widthVal}`);
    }
  };

  useEffect(() => {
    if (size) {
      reset({
        length: size.length,
        width: size.width,
        unit: (size.unit as 'inch' | 'cm' | 'mm') || 'inch',
        displayLabel: size.displayLabel,
        status: (size.status.toLowerCase() as 'active' | 'inactive') || 'active',
      });
    } else {
      reset({
        length: 78,
        width: 72,
        unit: 'inch',
        displayLabel: '78×72',
        status: 'active',
      });
    }
  }, [size, reset, isOpen]);

  const handleClose = () => {
    setApiError(null);
    onClose();
  };

  if (!isOpen) return null;

  const onSubmit = async (data: SizeFormData) => {
    setApiError(null);
    try {
      if (isEdit && size) {
        const result = await updateSize({
          id: size.id,
          length: Number(data.length),
          width: Number(data.width),
          unit: data.unit,
          displayLabel: data.displayLabel.trim(),
          status: data.status,
        }).unwrap();
        onSuccess(result);
      } else {
        const result = await createSize({
          length: Number(data.length),
          width: Number(data.width),
          unit: data.unit,
          displayLabel: data.displayLabel.trim(),
          status: data.status,
        }).unwrap();
        onSuccess(result);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to save size';
      setApiError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="size-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 font-semibold">
              <Maximize2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="size-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                {isEdit ? 'Edit Mattress Size' : 'Add Mattress Size'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit ? 'Update dimension specifications' : 'Define new length & width dimension'}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Length *
              </label>
              <input
                type="number"
                step="any"
                {...register('length', { valueAsNumber: true })}
                onBlur={handleAutoLabel}
                placeholder="78"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.length && (
                <p className="text-xs text-red-600 mt-1">{errors.length.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Width *
              </label>
              <input
                type="number"
                step="any"
                {...register('width', { valueAsNumber: true })}
                onBlur={handleAutoLabel}
                placeholder="72"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.width && (
                <p className="text-xs text-red-600 mt-1">{errors.width.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Measurement Unit *
              </label>
              <select
                {...register('unit')}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              >
                <option value="inch">Inches (in)</option>
                <option value="cm">Centimeters (cm)</option>
                <option value="mm">Millimeters (mm)</option>
              </select>
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Display Label *
              </label>
              <button
                type="button"
                onClick={handleAutoLabel}
                className="text-[11px] text-brand-blue hover:underline cursor-pointer"
              >
                Auto Generate
              </button>
            </div>
            <input
              {...register('displayLabel')}
              placeholder="e.g. 78×72 (King Size)"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
            {errors.displayLabel && (
              <p className="text-xs text-red-600 mt-1">{errors.displayLabel.message}</p>
            )}
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
              {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Size'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
