'use client';

import React, { useState, useMemo } from 'react';
import { Customer, CustomerType } from '@/types';
import {
  Search,
  UserPlus,
  Check,
  X,
  CreditCard,
  Building2,
  User,
  Truck,
  AlertCircle,
} from 'lucide-react';
import { useGetCustomersQuery, useCreateCustomerMutation } from '@/store/services/apiSlice';

interface POSCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomerId?: string | null;
  onSelectCustomer: (customer: Customer | null) => void;
  recommendedType?: CustomerType;
}

export default function POSCustomerModal({
  isOpen,
  onClose,
  selectedCustomerId,
  onSelectCustomer,
  recommendedType,
}: POSCustomerModalProps) {
  const { data: customers = [], isLoading } = useGetCustomersQuery();
  const [createCustomerMutation, { isLoading: isCreating }] = useCreateCustomerMutation();

  const [activeTab, setActiveTab] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Quick customer create form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<CustomerType>(recommendedType || 'WHOLESALE');
  const [newCreditLimit, setNewCreditLimit] = useState<number>(100000);
  const [newDueDays, setNewDueDays] = useState<number>(30);
  const [createError, setCreateError] = useState<string | null>(null);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (typeFilter !== 'ALL' && c.customerType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name.toLowerCase().includes(q);
        const matchCode = (c.customerCode || c.code || '').toLowerCase().includes(q);
        const matchPhone = c.phone.includes(q);
        const matchBiz = (c.businessName || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPhone && !matchBiz) return false;
      }
      return true;
    });
  }, [customers, typeFilter, searchQuery]);

  if (!isOpen) return null;

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newName.trim() || !newPhone.trim()) {
      setCreateError('Customer Name and Phone Number are required.');
      return;
    }

    try {
      const created = await createCustomerMutation({
        name: newName.trim(),
        phone: newPhone.trim(),
        customerType: newType,
        creditEnabled: true,
        creditLimit: newCreditLimit,
        creditTerms: `${newDueDays} Days Net Credit`,
        defaultDueDays: newDueDays,
        status: 'ACTIVE',
      }).unwrap();

      onSelectCustomer(created);
      onClose();
    } catch (err) {
      setCreateError((err as Error).message || 'Failed to create customer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-base text-slate-800 font-sans">
              Customer Account Selection
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Select or register customer for multi-tier pricing, invoicing &amp; credit billing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 px-5 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('SELECT')}
            className={`py-2.5 px-4 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer ${
              activeTab === 'SELECT'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Select Existing Customer ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CREATE');
              if (recommendedType) setNewType(recommendedType);
            }}
            className={`py-2.5 px-4 text-xs font-bold font-sans border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'CREATE'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New Customer</span>
          </button>
        </div>

        {activeTab === 'SELECT' ? (
          <>
            {/* Search & Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-slate-50/50">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, code or business..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1">
                {['ALL', 'WALK_IN', 'WHOLESALE', 'DISTRIBUTOR'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      typeFilter === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'ALL'
                      ? 'All'
                      : t === 'WALK_IN'
                      ? 'Walk-in'
                      : t === 'WHOLESALE'
                      ? 'Wholesale'
                      : 'Distributor'}
                  </button>
                ))}
              </div>
            </div>

            {/* Anonymous Walk-in Option */}
            <div className="px-4 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-xs font-bold text-blue-900">
                    Walk-in Counter Customer (Anonymous)
                  </span>
                  <span className="text-[11px] text-blue-700 ml-2">
                    Supported for Full Payment sales only
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(null);
                  onClose();
                }}
                className="px-3 py-1 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Use Anonymous
              </button>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 max-h-[380px]">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading customers...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No customers found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelected = selectedCustomerId === c.id;
                  const availableCredit = Math.max(0, c.creditLimit - c.currentOutstanding);
                  const isCreditExceeded = c.currentOutstanding >= c.creditLimit;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectCustomer(c);
                        onClose();
                      }}
                      className={`pt-2.5 first:pt-0 p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500/20'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            c.customerType === 'DISTRIBUTOR'
                              ? 'bg-purple-100 text-purple-700'
                              : c.customerType === 'WHOLESALE'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {c.customerType === 'DISTRIBUTOR' ? (
                            <Truck className="w-4 h-4" />
                          ) : c.customerType === 'WHOLESALE' ? (
                            <Building2 className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 font-sans">
                              {c.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                              {c.customerCode}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                                c.customerType === 'DISTRIBUTOR'
                                  ? 'bg-purple-100 text-purple-700'
                                  : c.customerType === 'WHOLESALE'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {c.customerType}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-sans">
                            <span>Phone: {c.phone}</span>
                            {c.businessName && <span>• {c.businessName}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Credit Summary */}
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900">
                          Due: Rs. {c.currentOutstanding.toLocaleString()}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            isCreditExceeded ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          Avail Credit: Rs. {availableCredit.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Limit: Rs. {c.creditLimit.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* CREATE TAB */
          <form onSubmit={handleCreateCustomer} className="p-5 space-y-4">
            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Lahore Foam Traders"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Tier Type *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CustomerType)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="WALK_IN">Walk-in Account</option>
                  <option value="WHOLESALE">Wholesale Dealer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Credit Limit (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={newCreditLimit}
                  onChange={(e) => setNewCreditLimit(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Default Due Days
                </label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={newDueDays}
                  onChange={(e) => setNewDueDays(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('SELECT')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Back to Selection
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isCreating ? 'Saving...' : 'Create & Select Customer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
