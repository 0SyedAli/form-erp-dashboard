'use client';

import React, { useState } from 'react';
import { POSSettings, Branch } from '@/types';
import { X, Settings, Check, Store, Clock, Printer } from 'lucide-react';

interface POSSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: POSSettings;
  branches: Branch[];
  isSuperAdmin: boolean;
  onSave: (updated: Partial<POSSettings>) => void;
}

export default function POSSettingsModal({
  isOpen,
  onClose,
  settings,
  branches,
  isSuperAdmin,
  onSave,
}: POSSettingsModalProps) {
  const [branchId, setBranchId] = useState(settings.selectedBranchId || settings.branchId || 'BR-MAIN-01');
  const [shiftName, setShiftName] = useState(settings.shiftName || 'Morning');
  const [receiptFormat, setReceiptFormat] = useState(settings.receiptFormat || 'THERMAL_80MM');
  const [autoPrint, setAutoPrint] = useState(settings.autoPrint ?? settings.autoPrintReceipt ?? true);
  const [showThumbnails, setShowThumbnails] = useState(settings.showThumbnails ?? settings.showProductThumbnails ?? true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      selectedBranchId: branchId,
      branchId,
      shiftName,
      receiptFormat,
      autoPrint,
      autoPrintReceipt: autoPrint,
      showThumbnails,
      showProductThumbnails: showThumbnails,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base font-sans">POS Workstation Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Branch Selection (Only Super Admin can switch) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-blue-600" />
              <span>Active Selling Branch</span>
            </label>
            {isSuperAdmin ? (
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {!b.settings?.allowRetailSales ? '(Retail Disabled)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-700">
                {branches.find((b) => b.id === branchId)?.name || 'Assigned Branch'}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              Sales, inventory deductions and invoicing will be posted to this location.
            </p>
          </div>

          {/* Shift Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cashier Shift</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Morning', 'Evening', 'Night'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShiftName(s)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    shiftName === s
                      ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Receipt Format */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-purple-600" />
              <span>Default Receipt Format</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReceiptFormat('THERMAL_80MM')}
                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  receiptFormat === 'THERMAL_80MM'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Thermal (80mm)
              </button>
              <button
                type="button"
                onClick={() => setReceiptFormat('STANDARD_A4')}
                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  receiptFormat === 'STANDARD_A4'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Standard A4
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
              <span>Auto-prompt browser print on checkout</span>
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
              <span>Show product thumbnails in shopping cart</span>
              <input
                type="checkbox"
                checked={showThumbnails}
                onChange={(e) => setShowThumbnails(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
