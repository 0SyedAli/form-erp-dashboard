import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface InvoiceDrawerState {
  isOpen: boolean;
  selectedInvoiceId: string | null;
}

const initialState: InvoiceDrawerState = {
  isOpen: false,
  selectedInvoiceId: null,
};

export const invoiceDrawerSlice = createSlice({
  name: 'invoiceDrawer',
  initialState,
  reducers: {
    openInvoiceDrawer: (state, action: PayloadAction<string>) => {
      state.selectedInvoiceId = action.payload;
      state.isOpen = true;
    },
    closeInvoiceDrawer: (state) => {
      state.isOpen = false;
      state.selectedInvoiceId = null;
    },
  },
});

export const { openInvoiceDrawer, closeInvoiceDrawer } = invoiceDrawerSlice.actions;
export default invoiceDrawerSlice.reducer;
