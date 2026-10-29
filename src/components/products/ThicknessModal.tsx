'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MattressThickness } from '@/types';
import { useCreateThicknessMutation, useUpdateThicknessMutation } from '@/store/services/apiSlice';
import { X, Sliders } from 'lucide-react';

const thicknessSchema = z.object({
  value: z.number().positive('Thickness value must be greater than 0'),
  unit: z.enum(['inch', 'cm', 'mm']),
  displayLabel: z.string().min(1, 'Display label is required'),
  status: z.enum(['active', 'inactive']),
});

type ThicknessFormData = z.infer<typeof thicknessSchema>;

interface ThicknessModalProps {
  isOpen: boolean;
  onClose: () => void;
  thickness?: MattressThickness | null;
  onSuccess: (thickness: MattressThickness) => void;
}

export default function ThicknessModal({
  isOpen,
  onClose,
  thickness,
  onSuccess,
}: ThicknessModalProps) {
  const [createThickness, { isLoading: isCreating }] = useCreateThicknessMutation();
  const [updateThickness, { isLoading: isUpdating }] = useUpdateThicknessMutation();
  const [apiError, setApiError] = useState<string | null>(null);

  const isEdit = !!thickness;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ThicknessFormData>({
    resolver: zodResolver(thicknessSchema),
    defaultValues: {
      value: 6,
      unit: 'inch',
      displayLabel: '6"',
      status: 'active',
    },
  });

  const valueVal = watch('value');
  const unitVal = watch('unit');

  const handleAutoLabel = () => {
    if (valueVal) {
      const suffix = unitVal === 'inch' ? '"' : ` ${unitVal}`;
      setValue('displayLabel', `${valueVal}${suffix}`);
    }
  };

  useEffect(() => {
    if (thickness) {
      reset({
        value: thickness.value,
        unit: (thickness.unit as 'inch' | 'cm' | 'mm') || 'inch',
        displayLabel: thickness.displayLabel,
        status: (thickness.status.toLowerCase() as 'active' | 'inactive') || 'active',
      });
    } else {
      reset({
        value: 6,
        unit: 'inch',
        displayLabel: '6"',
        status: 'active',
      });
    }
    setApiError(null);
  }, [thickness, reset, isOpen]);

  if (!isOpen) return null;

  const onSubmit = async (data: ThicknessFormData) => {
    setApiError(null);
    try {
      if (isEdit && thickness) {
        const result = await updateThickness({
          id: thickness.id,
          value: Number(data.value),
          unit: data.unit,
          displayLabel: data.displayLabel.trim(),
          status: data.status,
        }).unwrap();
        onSuccess(result);
      } else {
        const result = await createThickness({
          value: Number(data.value),
          unit: data.unit,
          displayLabel: data.displayLabel.trim(),
          status: data.status,
        }).unwrap();
        onSuccess(result);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to save thickness';
      setApiError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="thickness-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 id="thickness-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                {isEdit ? 'Edit Thickness' : 'Add Thickness Option'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEdit ? 'Update thickness specification' : 'Define new thickness option for mattresses'}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Value *
              </label>
              <input
                type="number"
                step="any"
                {...register('value', { valueAsNumber: true })}
                onBlur={handleAutoLabel}
                placeholder="6"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              />
              {errors.value && (
                <p className="text-xs text-red-600 mt-1">{errors.value.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Unit *
              </label>
              <select
                {...register('unit')}
                onChange={(e) => {
                  register('unit').onChange(e);
                  setTimeout(handleAutoLabel, 50);
                }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white"
              >
                <option value="inch">Inches (in)</option>
                <option value="cm">Centimeters (cm)</option>
                <option value="mm">Millimeters (mm)</option>
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
              placeholder='e.g. 6" (Standard)'
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
            {errors.displayLabel && (
              <p className="text-xs text-red-600 mt-1">{errors.displayLabel.message}</p>
            )}
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
              {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Thickness'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
