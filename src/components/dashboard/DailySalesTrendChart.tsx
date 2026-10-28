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

const DAILY_TREND_DATA = [
  { date: 'Oct 1', sales: 45000 },
  { date: 'Oct 5', sales: 70000 },
  { date: 'Oct 10', sales: 65000 },
  { date: 'Oct 15', sales: 110000 },
  { date: 'Oct 20', sales: 145000 },
  { date: 'Oct 25', sales: 130000 },
  { date: 'Oct 31', sales: 185000 },
];

interface TooltipPayloadItem {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-xl text-xs space-y-1 border border-slate-700">
        <p className="font-semibold text-slate-300">{label}</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-slate-300">Sales:</span>
          <span className="font-semibold text-white">
            {formatPKR(payload[0].value)}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export default function DailySalesTrendChart() {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Daily Sales Trend
        </h3>

        <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
          <span>This Month</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DAILY_TREND_DATA} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDailySales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
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
              dataKey="sales"
              name="Daily Sales"
              stroke="#2563EB"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorDailySales)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
