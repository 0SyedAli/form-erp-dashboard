'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

export interface SalesBreakdownItem {
  name: string;
  value: number;
  formatted: string;
  percent: number;
  color: string;
}

interface BranchSalesBreakdownDonutProps {
  data?: SalesBreakdownItem[];
}

export default function BranchSalesBreakdownDonut({ data = [] }: BranchSalesBreakdownDonutProps) {
  const hasData = data && data.length > 0 && data.some((d) => d.value > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Sales Breakdown
        </h3>
      </div>

      {/* Donut or Clean Empty State */}
      {!hasData ? (
        <div className="h-56 w-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 my-auto p-4 text-center">
          <PieChartIcon className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-xs font-semibold text-gray-700">No Sales Breakdown</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Breakdown between walk-in and wholesale sales will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto">
          <div className="relative w-44 h-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(val) => [`Rs. ${Number(val || 0).toLocaleString()}`, 'Revenue']}
                />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3 flex-1 text-xs">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-bold font-mono">{item.formatted}</span>
                  <span className="text-gray-400 text-[11px]">({item.percent}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
