import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './slices/authSlice';
import filterReducer from './slices/filterSlice';
import invoiceDrawerReducer from './slices/invoiceDrawerSlice';
import { erpApi } from './services/apiSlice';
import { authApi } from './services/authApi';
import { catalogueApi } from './services/catalogueApi';
import { inventoryApi } from './services/inventoryApi';
import { posApi } from './services/posApi';
import { purchasesApi } from './services/purchasesApi';
import { reportsApi } from './services/reportsApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    filters: filterReducer,
    invoiceDrawer: invoiceDrawerReducer,
    [erpApi.reducerPath]: erpApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [catalogueApi.reducerPath]: catalogueApi.reducer,
    [inventoryApi.reducerPath]: inventoryApi.reducer,
    [posApi.reducerPath]: posApi.reducer,
    [purchasesApi.reducerPath]: purchasesApi.reducer,
    [reportsApi.reducerPath]: reportsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }).concat(
      erpApi.middleware,
      authApi.middleware,
      catalogueApi.middleware,
      inventoryApi.middleware,
      posApi.middleware,
      purchasesApi.middleware,
      reportsApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
