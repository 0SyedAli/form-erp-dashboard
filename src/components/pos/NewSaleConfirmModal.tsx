'use client';

import React from 'react';
import { AlertCircle, PauseCircle, Trash2, X } from 'lucide-react';

interface NewSaleConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHoldAndStartNew: () => void;
  onDiscardAndStartNew: () => void;
}

export default function NewSaleConfirmModal({
  isOpen,
  onClose,
  onHoldAndStartNew,
  onDiscardAndStartNew,
}: NewSaleConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-base font-sans">Active Cart in Progress</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm font-semibold text-slate-800">
            Start a new sale? Your current unsaved cart will be cleared.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            You can hold this sale to resume it later, or discard it to start with a blank cart.
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscardAndStartNew}
            className="w-full sm:w-auto px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard & Start New</span>
          </button>
          <button
            type="button"
            onClick={onHoldAndStartNew}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>Hold Current Sale</span>
          </button>
        </div>
      </div>
    </div>
  );
}
