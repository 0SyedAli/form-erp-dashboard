'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { SHARED_PRODUCT_CATALOGUE } from '@/data/mockData';
import {
  Plus,
  Download,
  Search,
  RotateCcw,
  Edit2,
  Trash2,
  MoreVertical,
  Package,
} from 'lucide-react';

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<'brands' | 'categories' | 'sizes' | 'thickness' | 'products' | 'variants'>('products');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = SHARED_PRODUCT_CATALOGUE.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      {/* Header matching screenshot Screen 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Products & Variants
          </h1>
          <p className="text-[13px] sm:text-sm text-gray-500 mt-0.5 font-normal">
            Manage brands, categories and product variants
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => alert('Bulk product spreadsheet import')}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Import</span>
          </button>
          <button
            onClick={() => alert('Add Product modal')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Tabs matching screenshot */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6 text-sm font-medium bg-white p-1.5 rounded-xl border border-gray-200/80 w-fit">
        {(['brands', 'categories', 'sizes', 'thickness', 'products', 'variants'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-2 rounded-lg capitalize transition-colors cursor-pointer ${
              activeTab === tab
                ? 'bg-brand-blue text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Grid: Left Filters, Right Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Left Filter Sidebar */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs space-y-4 text-sm h-fit">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-800 placeholder-gray-400 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1.5 text-sm">
              Brand
            </label>
            <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-800">
              <option>All Brands</option>
              <option>MoltyFoam</option>
              <option>Dura</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1.5 text-sm">
              Category
            </label>
            <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-800">
              <option>All Categories</option>
              <option>Orthopedic</option>
              <option>Original Foam</option>
              <option>Spring Luxury</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1.5 text-sm">
              Status
            </label>
            <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-normal text-gray-800">
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          <button
            onClick={() => setSearchQuery('')}
            className="w-full py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Right Products Table */}
        <div className="lg:col-span-9 bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600 font-semibold text-[13px] bg-gray-50/80">
                  <th className="py-3.5 px-4 w-10">#</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Brand</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-center">Variants</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 text-sm font-normal">
                {filteredProducts.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-4 text-gray-400 font-normal">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-4 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue shrink-0">
                          <Package className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <span className="text-xs font-mono text-gray-400 font-normal">{p.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-sm font-normal">
                      {p.name.includes('Dura') ? 'Dura' : 'MoltyFoam'}
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-sm font-normal">
                      {p.category}
                    </td>
                    <td className="py-4 px-4 text-center font-medium text-gray-800 text-sm">
                      {p.category === 'Accessories' ? 1 : 9}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Active
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-gray-400">
                        <button className="p-1 hover:text-brand-blue" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 hover:text-gray-700" title="More">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Pagination footer matching screenshot */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
            <span>Showing 1 to {filteredProducts.length} of 45 products</span>
            <div className="flex items-center gap-1 font-medium">
              <span className="w-6 h-6 rounded-md bg-brand-blue text-white flex items-center justify-center font-bold">1</span>
              <span className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center cursor-pointer">2</span>
              <span className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center cursor-pointer">3</span>
              <span className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center cursor-pointer">4</span>
              <span className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center cursor-pointer">5</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
