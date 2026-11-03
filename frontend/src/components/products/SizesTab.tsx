'use client';

import React, { useState, useMemo } from 'react';
import { MattressSize } from '@/types';
import { useGetSizesQuery, useGetVariantsQuery } from '@/store/services/apiSlice';
import SizeModal from './SizeModal';
import SizeStatusModal from './SizeStatusModal';
import {
  Search,
  Plus,
  Edit2,
  Power,
  RotateCcw,
  Maximize2,
  Boxes,
} from 'lucide-react';

interface SizesTabProps {
  canManage: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function SizesTab({ canManage, onToast }: SizesTabProps) {
  const { data: sizes = [], isLoading } = useGetSizesQuery();
  const { data: variants = [] } = useGetVariantsQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSize, setSelectedSize] = useState<MattressSize | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusModalSize, setStatusModalSize] = useState<MattressSize | null>(null);

  const filteredSizes = useMemo(() => {
    return sizes.filter((size) => {
      const matchesSearch =
        size.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${size.length}x${size.width}`.includes(searchQuery.toLowerCase()) ||
        `${size.length}×${size.width}`.includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || size.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [sizes, searchQuery, statusFilter]);

  const handleEdit = (size: MattressSize) => {
    setSelectedSize(size);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedSize(null);
    setIsModalOpen(true);
  };

  const handleStatusToggle = (size: MattressSize) => {
    setStatusModalSize(size);
  };

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search size (e.g. 78×72)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-brand-blue focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-hidden focus:border-brand-blue"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {canManage && (
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Size</span>
          </button>
        )}
      </div>

      {/* Sizes Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Display Label</th>
                <th className="py-3.5 px-4">Length</th>
                <th className="py-3.5 px-4">Width</th>
                <th className="py-3.5 px-4">Unit</th>
                <th className="py-3.5 px-4 text-center">Associated Variants</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    Loading sizes...
                  </td>
                </tr>
              ) : filteredSizes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <Maximize2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No mattress sizes found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try clearing size filters'
                        : 'Click "Add Size" to define new mattress dimensions'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSizes.map((size, idx) => {
                  const sizeVariants = variants.filter((v) => v.sizeId === size.id);

                  return (
                    <tr key={size.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-4 text-center text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 font-medium shrink-0">
                            <Maximize2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {size.displayLabel}
                            </div>
                            <span className="text-xs text-gray-400">ID: {size.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-800 text-sm">
                        {size.length} {size.unit}
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-800 text-sm">
                        {size.width} {size.unit}
                      </td>
                      <td className="py-4 px-4 text-xs font-semibold uppercase text-gray-500">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
                          {size.unit}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          <Boxes className="w-3 h-3 text-gray-500" />
                          <span>{sizeVariants.length}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            size.status.toLowerCase() === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {size.status.toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500">
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleEdit(size)}
                                className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                title="Edit Size"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStatusToggle(size)}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  size.status.toLowerCase() === 'active'
                                    ? 'hover:text-amber-600 hover:bg-amber-50'
                                    : 'hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={size.status.toLowerCase() === 'active' ? 'Deactivate Size' : 'Activate Size'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
          <span>
            Showing {filteredSizes.length} of {sizes.length} sizes
          </span>
        </div>
      </div>

      {/* Add / Edit Size Modal */}
      <SizeModal
        isOpen={isModalOpen}
        size={selectedSize}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSize(null);
        }}
        onSuccess={(saved) => {
          onToast(
            selectedSize
              ? `Size "${saved.displayLabel}" updated successfully`
              : `Size "${saved.displayLabel}" created successfully`,
            'success'
          );
        }}
      />

      {/* Status Modal */}
      <SizeStatusModal
        isOpen={!!statusModalSize}
        size={statusModalSize}
        onClose={() => setStatusModalSize(null)}
        onSuccess={(updated) => {
          onToast(
            `Size "${updated.displayLabel}" is now ${updated.status}`,
            updated.status === 'active' ? 'success' : 'info'
          );
        }}
      />
    </div>
  );
}
