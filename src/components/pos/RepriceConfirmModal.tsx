'use client';

import React from 'react';
import { SaleType } from '@/types';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface RepriceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentSaleType: SaleType;
  targetSaleType: SaleType;
  itemCount: number;
}

export default function RepriceConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  currentSaleType,
  targetSaleType,
  itemCount,
}: RepriceConfirmModalProps) {
  if (!isOpen) return null;

  const typeLabels: Record<SaleType, string> = {
    WALK_IN: 'Walk-in',
    WHOLESALE: 'Wholesale',
    DISTRIBUTOR: 'Distributor',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
          <div className="flex items-center gap-2.5 text-amber-800">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 font-sans">
                Update Cart Pricing?
              </h3>
              <p className="text-xs text-amber-700 font-medium">
                Sale type transition requested
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed font-sans">
            Changing sale type will update all cart prices from{' '}
            <strong className="text-slate-800 underline">
              {typeLabels[currentSaleType]}
            </strong>{' '}
            to{' '}
            <strong className="text-blue-600 underline">
              {typeLabels[targetSaleType]}
            </strong>{' '}
            tier. Continue?
          </p>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>Items affected:</span>
              <span className="font-bold text-slate-800">{itemCount} line items</span>
            </div>
            <div className="flex justify-between">
              <span>SKUs and quantities:</span>
              <span className="font-bold text-emerald-600">Preserved</span>
            </div>
            <div className="flex justify-between">
              <span>Discounts &amp; eligibility:</span>
              <span className="font-bold text-blue-600">Automatically recomputed</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-reprice-btn"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Confirm &amp; Recalculate Prices</span>
          </button>
        </div>
      </div>
    </div>
  );
}
