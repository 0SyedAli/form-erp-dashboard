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
import { ChevronDown, TrendingUp } from 'lucide-react';

export interface DailyTrendPoint {
  date: string;
  sales: number;
}

interface DailySalesTrendChartProps {
  data?: DailyTrendPoint[];
  isLoading?: boolean;
}

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

export default function DailySalesTrendChart({ data = [], isLoading = false }: DailySalesTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs h-80 animate-pulse" />
    );
  }

  const hasData = data && data.length > 0 && data.some((d) => d.sales > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm sm:text-base">
            Daily Sales Trend
          </h3>
        </div>

        {/* Timeframe Dropdown */}
        <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
          <span>This Month</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>

      {/* Chart or Clean Empty State */}
      <div className="h-64 w-full">
        {!hasData ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <TrendingUp className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-700">No daily sales trends recorded</p>
            <p className="text-xs text-gray-400 mt-0.5">Transactions will populate this chart automatically.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDailySales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
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
                name="Sales"
                stroke="#2563EB"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorDailySales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
