'use client';

import React from 'react';
import { Branch } from '@/types';
import { useToggleBranchStatusMutation } from '@/store/services/apiSlice';
import { AlertTriangle, Power, CheckCircle2, X } from 'lucide-react';

interface BranchStatusModalProps {
  branch: Branch | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Branch) => void;
}

export default function BranchStatusModal({
  branch,
  isOpen,
  onClose,
  onSuccess,
}: BranchStatusModalProps) {
  const [toggleStatus, { isLoading }] = useToggleBranchStatusMutation();

  if (!isOpen || !branch) return null;

  const willDeactivate = branch.isActive;

  const handleConfirm = async () => {
    try {
      const result = await toggleStatus({
        id: branch.id,
        isActive: !branch.isActive,
      }).unwrap();

      onSuccess(result);
      onClose();
    } catch (err) {
      console.error('Failed to toggle branch status', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-labelledby="status-modal-title"
      >
        {/* Header */}
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
              <h2 id="status-modal-title" className="text-lg font-semibold tracking-tight">
                {willDeactivate ? 'Deactivate Branch' : 'Activate Branch'}
              </h2>
              <p className="text-[13px] text-white/80">
                {willDeactivate ? 'Suspend operations for location' : 'Resume location operations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm">
          <p className="text-gray-700 leading-relaxed text-sm">
            Are you sure you want to{' '}
            <strong className={willDeactivate ? 'text-amber-700' : 'text-emerald-700'}>
              {willDeactivate ? 'deactivate' : 'reactivate'}
            </strong>{' '}
            <strong className="text-gray-900">{branch.name}</strong> ({branch.code})?
          </p>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[13px] leading-relaxed">
                <span className="font-semibold text-gray-900 block">
                  Historical Business Data Safety Guarantee:
                </span>
                All historical transactions, sales vouchers, inventory records, and audit logs for this branch will be permanently preserved.
              </div>
            </div>
            {willDeactivate && (
              <p className="text-[13px] text-gray-500 pl-6">
                Deactivated branches are excluded from new POS counter invoices and wholesale dispatches until reactivated.
              </p>
            )}
          </div>

          {/* Action Buttons */}
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
              onClick={handleConfirm}
              disabled={isLoading}
              className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-2 ${
                willDeactivate
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isLoading ? (
                <span>Updating...</span>
              ) : (
                <span>{willDeactivate ? 'Yes, Deactivate Branch' : 'Yes, Activate Branch'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
