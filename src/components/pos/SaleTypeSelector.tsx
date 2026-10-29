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
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
          Sale Tier:
        </span>
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
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
                className={`relative px-4 py-1.5 rounded-lg text-xs font-bold font-sans transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
                title={opt.description}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{opt.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 font-medium font-sans">
        {saleType === 'WALK_IN' && (
          <span className="text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Walk-in tier active: anonymous checkout permitted for full payment
          </span>
        )}
        {saleType === 'WHOLESALE' && (
          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Wholesale tier active: customer account required at checkout
          </span>
        )}
        {saleType === 'DISTRIBUTOR' && (
          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            Distributor tier active: verified distributor account required
          </span>
        )}
      </div>
    </div>
  );
}
