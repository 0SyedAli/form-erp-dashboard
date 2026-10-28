'use client';

import React from 'react';
import { useResetDemoDataMutation } from '@/store/services/apiSlice';
import { RotateCcw, X, AlertTriangle } from 'lucide-react';

interface ResetDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResetDemoModal({
  isOpen,
  onClose,
  onSuccess,
}: ResetDemoModalProps) {
  const [resetDemoData, { isLoading }] = useResetDemoDataMutation();

  if (!isOpen) return null;

  const handleReset = async () => {
    try {
      await resetDemoData().unwrap();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to reset demo database', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="reset-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 id="reset-modal-title" className="text-lg font-semibold tracking-tight">
                Reset Demo Database
              </h2>
              <p className="text-[13px] text-slate-300">
                Restore initial 5 commercial market cluster shops
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-sm">
              <span className="font-semibold block">Reset Confirmation</span>
              This will re-initialize your local browser demo database back to the 5 baseline market cluster shops (Main Branch Shop #12-14, Display Center Shop #18, Wholesale Depot Shop #24-A, Ortho Bedding Shop #06, Express Counter Shop #31).
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              {isLoading ? <span>Resetting...</span> : <span>Confirm Reset</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
