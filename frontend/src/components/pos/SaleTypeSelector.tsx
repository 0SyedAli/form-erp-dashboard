'use client';

import React from 'react';
import { SaleType } from '@/types';
import { User, Building2, Truck, AlertCircle } from 'lucide-react';

interface SaleTypeSelectorProps {
  saleType: SaleType;
  onChangeSaleType: (newType: SaleType) => void;
  disabled?: boolean;
}

export default function SaleTypeSelector({
  saleType,
  onChangeSaleType,
  disabled = false,
}: SaleTypeSelectorProps) {
  const options: { id: SaleType; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
    {
      id: 'WALK_IN',
      label: 'Walk-in',
      icon: User,
      description: 'Standard retail counter pricing',
    },
    {
      id: 'WHOLESALE',
      label: 'Wholesale',
      icon: Building2,
      description: 'Dealer & bulk discounted rates',
    },
    {
      id: 'DISTRIBUTOR',
      label: 'Distributor',
      icon: Truck,
      description: 'Primary distributor tier pricing',
    },
  ];

  return (
    <div className="bg-white/70 backdrop-blur-xs border-b border-slate-200/70 px-4 py-1.5 flex items-center justify-between gap-3 shrink-0 select-none">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">
          Pricing Tier:
        </span>
        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isActive = saleType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                id={`pos-sale-type-${opt.id.toLowerCase()}`}
                onClick={() => onChangeSaleType(opt.id)}
                disabled={disabled}
                className={`relative px-3 py-1 rounded-md text-xs font-bold font-sans transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-white text-blue-800 shadow-2xs ring-1 ring-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={opt.description}
              >
                <Icon className={`w-3 h-3 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 font-medium font-sans">
        {saleType === 'WALK_IN' && (
          <span className="text-slate-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Standard Counter Sale
          </span>
        )}
        {saleType === 'WHOLESALE' && (
          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 font-semibold">
            <AlertCircle className="w-3 h-3" />
            Wholesale Account Required
          </span>
        )}
        {saleType === 'DISTRIBUTOR' && (
          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1 font-semibold">
            <Truck className="w-3 h-3" />
            Distributor Tier Active
          </span>
        )}
      </div>
    </div>
  );
}
