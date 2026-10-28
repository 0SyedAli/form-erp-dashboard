'use client';

import React from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { store } from './index';
import { muiTheme } from '@/theme/muiTheme';

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider store={store}>
      <ThemeProvider theme={muiTheme}>
        {children}
      </ThemeProvider>
    </Provider>
  );
}

