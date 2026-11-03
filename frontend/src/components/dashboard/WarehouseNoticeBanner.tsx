'use client';

import React, { useState } from 'react';
import { Warehouse, ChevronRight, ChevronDown } from 'lucide-react';

export default function WarehouseNoticeBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-amber-200/90 bg-amber-50/50 p-4 shadow-2xs text-xs text-amber-900 transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-800">
            <Warehouse className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-xs sm:text-sm">
                Central Warehouse Integration: Specification RFC Pending
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Phase 2 Roadmap
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 mt-0.5">
              Multi-branch retail & wholesale billing operates in localized inventory mode across all 5 branch nodes.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2 shrink-0 cursor-pointer"
        >
          <span>{expanded ? 'Hide RFC Details' : 'View Specifications'}</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-3 border-t border-amber-200/70 space-y-2.5 text-xs text-gray-700 animate-in fade-in">
          <p className="font-medium text-gray-800">
            Enterprise Warehouse Architecture Notice:
          </p>
          <ul className="space-y-1.5 list-disc list-inside text-gray-600 pl-1">
            <li>
              <strong>Inter-branch Stock Transfers:</strong> Currently branch managers monitor shared catalogue stock levels and initiate local fulfillment requests.
            </li>
            <li>
              <strong>Central Factory Dispatch (Kala Shah Kaku Unit):</strong> Automated EDI order generation will be activated once central warehouse master specs are signed off.
            </li>
            <li>
              <strong>Safety Stock Thresholds:</strong> Local buffer quantities are preserved per branch (10–25 units per mattress category).
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
