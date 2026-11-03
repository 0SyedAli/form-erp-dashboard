'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

interface BranchwiseRevenueDonutProps {
  isLoading?: boolean;
}

const BRANCH_DONUT_DATA = [
  { name: 'Main Branch', value: 4250000, percent: 34, color: '#1877F2' },
  { name: 'Shop #18 (Display)', value: 3230000, percent: 26, color: '#06B6D4' },
  { name: 'Shop #24 (Wholesale)', value: 2180000, percent: 18, color: '#F59E0B' },
  { name: 'Shop #06 (Ortho)', value: 1720000, percent: 14, color: '#F43F5E' },
  { name: 'Shop #31 (Express)', value: 1070000, percent: 8, color: '#8B5CF6' },
];

export default function BranchwiseRevenueDonut({ isLoading = false }: BranchwiseRevenueDonutProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs h-80 animate-pulse" />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Branchwise Revenue
        </h3>
      </div>

      {/* Donut and Legend row */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-auto">
        {/* Donut Chart with centered label */}
        <div className="relative w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(val) => [`Rs. ${Number(val || 0).toLocaleString()}`, 'Revenue']}
              />
              <Pie
                data={BRANCH_DONUT_DATA}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {BRANCH_DONUT_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-gray-900">Rs. 12.5M</span>
            <span className="text-[10px] text-gray-400">Total</span>
          </div>
        </div>

        {/* Legend List on right */}
        <div className="space-y-2 flex-1 w-full text-xs">
          {BRANCH_DONUT_DATA.map((item) => (
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
              <span className="font-bold text-gray-900 shrink-0 ml-2">
                {item.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
