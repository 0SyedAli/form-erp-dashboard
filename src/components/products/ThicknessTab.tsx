'use client';

import React, { useState, useMemo } from 'react';
import { MattressThickness } from '@/types';
import { useGetThicknessQuery, useGetVariantsQuery } from '@/store/services/apiSlice';
import ThicknessModal from './ThicknessModal';
import ThicknessStatusModal from './ThicknessStatusModal';
import {
  Search,
  Plus,
  Edit2,
  Power,
  RotateCcw,
  Sliders,
  Boxes,
} from 'lucide-react';

interface ThicknessTabProps {
  canManage: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function ThicknessTab({ canManage, onToast }: ThicknessTabProps) {
  const { data: thicknessList = [], isLoading } = useGetThicknessQuery();
  const { data: variants = [] } = useGetVariantsQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedThickness, setSelectedThickness] = useState<MattressThickness | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusModalThickness, setStatusModalThickness] = useState<MattressThickness | null>(null);

  const filteredThickness = useMemo(() => {
    return thicknessList.filter((t) => {
      const matchesSearch =
        t.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(t.value).includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [thicknessList, searchQuery, statusFilter]);

  const handleEdit = (t: MattressThickness) => {
    setSelectedThickness(t);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedThickness(null);
    setIsModalOpen(true);
  };

  const handleStatusToggle = (t: MattressThickness) => {
    setStatusModalThickness(t);
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
              placeholder='Search thickness (e.g. 6")...'
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
            <span>Add Thickness</span>
          </button>
        )}
      </div>

      {/* Thickness Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Display Label</th>
                <th className="py-3.5 px-4">Value</th>
                <th className="py-3.5 px-4">Unit</th>
                <th className="py-3.5 px-4 text-center">Associated Variants</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Loading thickness options...
                  </td>
                </tr>
              ) : filteredThickness.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center">
                    <Sliders className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-medium">No thickness options found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try clearing filters'
                        : 'Click "Add Thickness" to define new thickness levels'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredThickness.map((t, idx) => {
                  const thicknessVariants = variants.filter((v) => v.thicknessId === t.id);

                  return (
                    <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-4 text-center text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-medium shrink-0">
                            <Sliders className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {t.displayLabel}
                            </div>
                            <span className="text-xs text-gray-400">ID: {t.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-800 text-sm">
                        {t.value}
                      </td>
                      <td className="py-4 px-4 text-xs font-semibold uppercase text-gray-500">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
                          {t.unit}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
                          <Boxes className="w-3 h-3 text-gray-500" />
                          <span>{thicknessVariants.length}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            t.status.toLowerCase() === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {t.status.toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-gray-500">
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleEdit(t)}
                                className="p-1.5 hover:text-brand-blue hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                title="Edit Thickness"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStatusToggle(t)}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  t.status.toLowerCase() === 'active'
                                    ? 'hover:text-amber-600 hover:bg-amber-50'
                                    : 'hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={t.status.toLowerCase() === 'active' ? 'Deactivate' : 'Activate'}
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
            Showing {filteredThickness.length} of {thicknessList.length} thickness options
          </span>
        </div>
      </div>

      {/* Add / Edit Thickness Modal */}
      <ThicknessModal
        isOpen={isModalOpen}
        thickness={selectedThickness}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedThickness(null);
        }}
        onSuccess={(saved) => {
          onToast(
            selectedThickness
              ? `Thickness "${saved.displayLabel}" updated successfully`
              : `Thickness "${saved.displayLabel}" created successfully`,
            'success'
          );
        }}
      />

      {/* Status Modal */}
      <ThicknessStatusModal
        isOpen={!!statusModalThickness}
        thickness={statusModalThickness}
        onClose={() => setStatusModalThickness(null)}
        onSuccess={(updated) => {
          onToast(
            `Thickness "${updated.displayLabel}" is now ${updated.status}`,
            updated.status === 'active' ? 'success' : 'info'
          );
        }}
      />
    </div>
  );
}
