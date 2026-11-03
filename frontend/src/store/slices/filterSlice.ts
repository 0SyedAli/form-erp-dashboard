import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DateRangePreset, FilterState, CustomerType } from '@/types';

const initialState: FilterState = {
  branchId: 'all',
  dateRange: 'mtd', // Default to Month-to-Date
  startDate: undefined,
  endDate: undefined,
  searchQuery: '',
  customerTypeFilter: 'ALL',
};

export const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setBranchFilter: (state, action: PayloadAction<string>) => {
      state.branchId = action.payload;
    },
    setDateRangeFilter: (state, action: PayloadAction<DateRangePreset>) => {
      state.dateRange = action.payload;
      if (action.payload !== 'custom') {
        state.startDate = undefined;
        state.endDate = undefined;
      }
    },
    setCustomDateRange: (
      state,
      action: PayloadAction<{ startDate: string; endDate: string }>
    ) => {
      state.dateRange = 'custom';
      state.startDate = action.payload.startDate;
      state.endDate = action.payload.endDate;
    },
    setSearchQueryFilter: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setCustomerTypeFilter: (
      state,
      action: PayloadAction<'ALL' | CustomerType>
    ) => {
      state.customerTypeFilter = action.payload;
    },
    resetFilters: (state) => {
      state.branchId = 'all';
      state.dateRange = 'mtd';
      state.startDate = undefined;
      state.endDate = undefined;
      state.searchQuery = '';
      state.customerTypeFilter = 'ALL';
    },
  },
});

export const {
  setBranchFilter,
  setDateRangeFilter,
  setCustomDateRange,
  setSearchQueryFilter,
  setCustomerTypeFilter,
  resetFilters,
} = filterSlice.actions;

export default filterSlice.reducer;
