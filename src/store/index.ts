import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './slices/authSlice';
import filterReducer from './slices/filterSlice';
import invoiceDrawerReducer from './slices/invoiceDrawerSlice';
import { erpApi } from './services/apiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    filters: filterReducer,
    invoiceDrawer: invoiceDrawerReducer,
    [erpApi.reducerPath]: erpApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(erpApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
