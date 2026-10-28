'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { SalesTrendDataPoint } from '@/types';
import { formatPKR } from '@/utils/formatters';
import { TrendingUp } from 'lucide-react';

interface SalesTrendChartProps {
  data: SalesTrendDataPoint[];
  isLoading?: boolean;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[180px]">
        <p className="font-semibold text-slate-200 border-b border-slate-800 pb-1">
          {label} 2026
        </p>
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}:
            </span>
            <span className="font-mono font-medium text-white">
              {formatPKR(item.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function SalesTrendChart({
  data,
  isLoading = false,
}: SalesTrendChartProps) {
  const [viewMode, setViewMode] = useState<'stacked' | 'total'>('stacked');

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs h-80 flex items-center justify-center animate-pulse">
        <div className="text-xs text-gray-400">Loading sales trajectory...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-2xs h-80 flex flex-col items-center justify-center text-center">
        <TrendingUp className="w-8 h-8 text-gray-300 mb-2" />
        <p className="text-sm font-medium text-gray-600">No sales transactions in selected period</p>
        <p className="text-xs text-gray-400">Try adjusting your date range or branch filter</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-base">Sales Revenue Trajectory</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-brand-red border border-red-100 uppercase">
              PKR Stream
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Combined retail walk-in velocity and commercial wholesale dispatches
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-medium">
          <button
            onClick={() => setViewMode('stacked')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              viewMode === 'stacked'
                ? 'bg-white text-gray-900 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Retail vs Wholesale
          </button>
          <button
            onClick={() => setViewMode('total')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              viewMode === 'total'
                ? 'bg-white text-gray-900 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Net Total
          </button>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorWholesale" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14243D" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#14243D" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorRetail" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C4122F" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#C4122F" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="label"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatPKR(v, true)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }}
            />

            {viewMode === 'stacked' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="wholesale"
                  name="Wholesale Revenue"
                  stroke="#14243D"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWholesale)"
                  stackId="1"
                />
                <Area
                  type="monotone"
                  dataKey="retail"
                  name="Retail Sales"
                  stroke="#C4122F"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRetail)"
                  stackId="1"
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey="netTotal"
                name="Net Revenue"
                stroke="#2563EB"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorTotal)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
