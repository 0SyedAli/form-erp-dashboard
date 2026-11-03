'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

const BREAKDOWN_DATA = [
  { name: 'Retail', value: 1670000, formatted: 'Rs. 1.67M', percent: 68, color: '#1877F2' },
  { name: 'Wholesale', value: 780000, formatted: 'Rs. 0.78M', percent: 32, color: '#06B6D4' },
];

export default function BranchSalesBreakdownDonut() {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm sm:text-base">
          Sales Breakdown
        </h3>
      </div>

      {/* Donut and Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto">
        <div className="relative w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(val) => [`Rs. ${Number(val || 0).toLocaleString()}`, 'Revenue']}
              />
              <Pie
                data={BREAKDOWN_DATA}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={4}
                dataKey="value"
              >
                {BREAKDOWN_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-gray-900">Rs. 2.45M</span>
            <span className="text-[10px] text-gray-400">Total</span>
          </div>
        </div>

        <div className="space-y-3.5 flex-1 w-full text-xs">
          {BREAKDOWN_DATA.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-700 font-semibold">{item.name}</span>
                <span className="text-gray-400 font-medium ml-1">
                  {item.formatted}
                </span>
              </div>
              <span className="font-bold text-gray-900">{item.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
