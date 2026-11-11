'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemName = 'items',
  className = '',
}: PaginationProps) {
  // Requirement: "agr 10 se zyada items ho to pagination show ho jae"
  // If total items is less than or equal to 10, do not render pagination controls
  if (totalItems <= 10) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, totalItems);

  // Calculate visible page buttons (max 5 visible buttons with ellipses)
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (safePage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
      }
    }
    return pages;
  }, [safePage, totalPages]);

  return (
    <div
      className={`px-4 sm:px-6 py-3.5 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 print:hidden ${className}`}
    >
      {/* Summary Info */}
      <div className="flex items-center gap-2 font-medium">
        <span>
          Showing <strong className="font-bold text-slate-800">{startIndex}</strong> to{' '}
          <strong className="font-bold text-slate-800">{endIndex}</strong> of{' '}
          <strong className="font-bold text-slate-800">{totalItems}</strong> {itemName}
        </span>

        {/* Optional Page Size Selector */}
        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-300">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        {totalPages > 4 && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage === 1}
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="First Page"
            aria-label="First Page"
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-slate-600" />
          </button>
        )}

        {/* Prev Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(safePage - 1, 1))}
          disabled={safePage === 1}
          className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1.5 text-slate-400 select-none">
                  •••
                </span>
              );
            }
            const isCurrent = p === safePage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={`min-w-7 h-7 px-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(safePage + 1, totalPages))}
          disabled={safePage === totalPages}
          className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        </button>

        {/* Last Page */}
        {totalPages > 4 && (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage === totalPages}
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Last Page"
            aria-label="Last Page"
          >
            <ChevronsRight className="w-3.5 h-3.5 text-slate-600" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Universal Client-Side Pagination Hook
 * Automatically handles page slicing, bounds, and renders the Pagination control when items > 10.
 */
export function useClientPagination<T>(
  items: T[],
  initialPageSize: number = 10,
  itemName: string = 'items'
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Auto-reset page if current page exceeds total pages due to filter changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedItems = useMemo(() => {
    if (totalItems <= 10) return items;
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex, totalItems]);

  const paginationComponent = useMemo(() => {
    if (totalItems <= 10) return null;
    return (
      <Pagination
        currentPage={safePage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemName={itemName}
      />
    );
  }, [safePage, totalItems, pageSize, itemName]);

  return {
    currentPage: safePage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    paginatedItems,
    PaginationComponent: paginationComponent,
  };
}

