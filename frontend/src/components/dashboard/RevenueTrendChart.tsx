'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatPKR } from '@/utils/formatters';
import { ChevronDown } from 'lucide-react';

interface RevenueTrendChartProps {
  isLoading?: boolean;
}

// Deterministic data points matching screenshot graph
const TREND_DATA = [
  { date: 'Oct 1', retail: 120000, wholesale: 60000 },
  { date: 'Oct 5', retail: 190000, wholesale: 110000 },
  { date: 'Oct 10', retail: 175000, wholesale: 140000 },
  { date: 'Oct 15', retail: 260000, wholesale: 160000 },
  { date: 'Oct 20', retail: 310000, wholesale: 180000 },
  { date: 'Oct 25', retail: 280000, wholesale: 240000 },
  { date: 'Oct 31', retail: 380000, wholesale: 310000 },
];

interface TrendPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TrendPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-xl text-xs space-y-1 border border-slate-700">
        <p className="font-semibold text-slate-300">{label}</p>
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}:
            </span>
            <span className="font-semibold text-white">
              {formatPKR(item.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function RevenueTrendChart({ isLoading = false }: RevenueTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs h-80 animate-pulse" />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs">
      {/* Header matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm sm:text-base">
            Revenue Trend (All Branches)
          </h3>
        </div>

        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-gray-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              Retail
            </span>
            <span className="flex items-center gap-1.5 text-gray-600 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Wholesale
            </span>
          </div>

          {/* Timeframe Dropdown */}
          <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
            <span>This Month</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={TREND_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRetailLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorWholesaleLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="date"
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
              tickFormatter={(v) => `${v / 1000}K`}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="retail"
              name="Retail"
              stroke="#2563EB"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRetailLine)"
            />
            <Area
              type="monotone"
              dataKey="wholesale"
              name="Wholesale"
              stroke="#F43F5E"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorWholesaleLine)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
