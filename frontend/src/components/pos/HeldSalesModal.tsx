'use client';

import React from 'react';
import { HeldSale } from '@/types';
import { X, Play, Trash2, PauseCircle, Clock, ShoppingBag } from 'lucide-react';

interface HeldSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldSales: HeldSale[];
  onResumeSale: (heldSale: HeldSale) => void;
  onDeleteHeldSale: (id: string) => void;
}

export default function HeldSalesModal({
  isOpen,
  onClose,
  heldSales,
  onResumeSale,
  onDeleteHeldSale,
}: HeldSalesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2 text-amber-900">
            <PauseCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-base font-sans">
              Held Sales ({heldSales.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {heldSales.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No held sales found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                To park an ongoing checkout, click &quot;Hold Sale (F3)&quot; in the POS cart.
              </p>
            </div>
          ) : (
            heldSales.map((sale) => {
              const formattedTime = new Intl.DateTimeFormat('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(sale.createdAt));

              const itemCount = sale.items.reduce((s, it) => s + it.quantity, 0);

              return (
                <div
                  key={sale.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                          {sale.holdReference || sale.holdNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {sale.customerName || 'Walk-in Customer'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formattedTime}</span>
                        <span>•</span>
                        <span>Cashier: {sale.cashierName}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900 font-sans">
                        Rs. {(sale.grandTotal ?? sale.totalAmount ?? 0).toLocaleString()}
                      </span>
                      <p className="text-[10px] text-slate-500">
                        {itemCount} {itemCount === 1 ? 'unit' : 'units'}
                      </p>
                    </div>
                  </div>

                  {/* Items Summary Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    {sale.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium"
                      >
                        {it.productName} ({it.sizeLabel}) × {it.quantity}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onDeleteHeldSale(sale.id)}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onResumeSale(sale)}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume Sale</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
