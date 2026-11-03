'use client';

import React from 'react';
import { ProductVariant } from '@/types';
import { useToggleVariantStatusMutation } from '@/store/services/apiSlice';
import { AlertTriangle, Power, CheckCircle2, X } from 'lucide-react';

interface VariantStatusModalProps {
  variant: ProductVariant | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: ProductVariant) => void;
}

export default function VariantStatusModal({
  variant,
  isOpen,
  onClose,
  onSuccess,
}: VariantStatusModalProps) {
  const [toggleStatus, { isLoading }] = useToggleVariantStatusMutation();

  if (!isOpen || !variant) return null;

  const willDeactivate = variant.status === 'active' || variant.status === 'ACTIVE';

  const handleConfirm = async () => {
    try {
      const result = await toggleStatus(variant.id).unwrap();

      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to toggle variant status', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="variant-status-modal-title"
      >
        <div
          className={`flex items-center justify-between px-6 py-4 text-white ${
            willDeactivate ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {willDeactivate ? (
                <Power className="w-5 h-5 text-white" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 id="variant-status-modal-title" className="text-lg font-semibold tracking-tight">
                {willDeactivate ? 'Deactivate Variant' : 'Activate Variant'}
              </h2>
              <p className="text-[13px] text-white/80">
                {willDeactivate ? 'Suspend SKU from sales catalogue' : 'Enable SKU for sales'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <p className="text-gray-700 leading-relaxed text-sm">
            Are you sure you want to{' '}
            <strong className={willDeactivate ? 'text-amber-700' : 'text-emerald-700'}>
              {willDeactivate ? 'deactivate' : 'reactivate'}
            </strong>{' '}
            the SKU <strong className="font-mono text-gray-900">{variant.sku}</strong>?
          </p>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[13px] leading-relaxed">
                <span className="font-semibold text-gray-900 block">
                  Sales & Invoices Integrity:
                </span>
                Deactivating a variant ensures it cannot be added to new retail sales or wholesale orders.
                All previous invoices referencing this SKU remain completely valid and intact.
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs ${
              willDeactivate ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isLoading
              ? 'Updating...'
              : willDeactivate
              ? 'Confirm Deactivation'
              : 'Confirm Activation'}
          </button>
        </div>
      </div>
    </div>
  );
}
