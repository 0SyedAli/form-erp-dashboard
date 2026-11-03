'use client';

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { store, useAppDispatch } from './index';
import { muiTheme } from '@/theme/muiTheme';
import { useGetMeQuery } from './services/authApi';
import { setAuthenticatedAccount, markSessionChecked } from './slices/authSlice';

function SessionInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { data, isSuccess, isError } = useGetMeQuery(undefined, {
    skip: typeof window === 'undefined',
  });

  useEffect(() => {
    if (isSuccess && data?.data) {
      dispatch(setAuthenticatedAccount(data.data));
    } else if (isError) {
      dispatch(markSessionChecked());
    }
  }, [isSuccess, isError, data, dispatch]);

  return <>{children}</>;
}

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider store={store}>
      <ThemeProvider theme={muiTheme}>
        <SessionInitializer>{children}</SessionInitializer>
      </ThemeProvider>
    </Provider>
  );
}
