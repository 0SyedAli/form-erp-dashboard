'use client';

import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    subtext?: string;
  };
  colorScheme?: 'green' | 'blue' | 'purple' | 'teal' | 'red' | 'orange';
  isLoading?: boolean;
}

export default function KpiCard({
  title,
  value,
  icon: Icon,
  badge,
  colorScheme = 'blue',
  isLoading = false,
}: KpiCardProps) {
  const schemeMap = {
    green: {
      bg: 'bg-emerald-500',
    },
    blue: {
      bg: 'bg-blue-600',
    },
    purple: {
      bg: 'bg-purple-600',
    },
    teal: {
      bg: 'bg-emerald-600',
    },
    red: {
      bg: 'bg-rose-500',
    },
    orange: {
      bg: 'bg-amber-500',
    },
  };

  const currentScheme = schemeMap[colorScheme];

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs animate-pulse">
        <div className="flex items-center gap-3.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 bg-gray-200 rounded-sm w-20" />
            <div className="h-6 bg-gray-200 rounded-sm w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-shadow">
      <div className="flex items-start gap-3.5">
        {/* Rounded square icon container with solid color matching screenshot */}
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${currentScheme.bg} text-white flex items-center justify-center shrink-0 shadow-xs`}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[13px] sm:text-sm font-medium text-gray-500 block truncate">
            {title}
          </span>
          <div className="text-2xl sm:text-[28px] font-semibold text-gray-900 mt-1 tracking-tight truncate leading-tight">
            {value}
          </div>

          {badge && (
            <div className="mt-2 flex items-center gap-1.5 text-[13px] font-normal text-gray-500 flex-wrap">
              <span className="inline-flex items-center text-emerald-600 font-medium">
                <ArrowUpRight className="w-4 h-4 mr-0.5" />
                {badge.text}
              </span>
              {badge.subtext && (
                <span className="text-gray-400 font-normal">{badge.subtext}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
