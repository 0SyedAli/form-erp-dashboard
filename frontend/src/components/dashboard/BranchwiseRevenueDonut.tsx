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

export interface BranchDonutItem {
  name: string;
  value: number;
  percent: number;
  color: string;
}

interface BranchwiseRevenueDonutProps {
  data?: BranchDonutItem[];
  isLoading?: boolean;
}

export default function BranchwiseRevenueDonut({ data = [], isLoading = false }: BranchwiseRevenueDonutProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs h-80 animate-pulse" />
    );
  }

  const hasData = data && data.length > 0 && data.some((d) => d.value > 0);
  const totalValue = data.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between  h-[100%]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Branchwise Revenue
        </h3>
      </div>

      {/* Donut or Clean Empty State */}
      {!hasData ? (
        <div className="h-[100%] w-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 my-auto p-4 text-center">
          <PieChartIcon className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-xs font-semibold text-gray-700">No Branch Revenue</p>
          <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs">
            Revenue breakdown across branches will display here once sales are logged.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-auto">
          {/* Donut Chart with centered label */}
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
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-bold text-gray-900">
                Rs. {(totalValue / 1000000).toFixed(1)}M
              </span>
              <span className="text-[10px] text-gray-400">Total</span>
            </div>
          </div>

          {/* Legend List on right */}
          <div className="space-y-2 flex-1 w-full text-xs">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700 font-medium truncate">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-gray-900 font-semibold font-mono text-[11px]">
                    Rs. {(item.value / 1000).toLocaleString()}K
                  </span>
                  <span className="text-gray-400 text-[10px] w-7 text-right">
                    {item.percent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
