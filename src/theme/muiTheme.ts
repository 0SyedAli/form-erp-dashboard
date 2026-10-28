import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  typography: {
    fontFamily: [
      'var(--font-plus-jakarta-sans)',
      'Plus Jakarta Sans',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '18px',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.015em',
    },
    h4: {
      fontSize: '16px',
      fontWeight: 600,
      lineHeight: 1.45,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontSize: '15px',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '-0.005em',
    },
    body2: {
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0em',
    },
    button: {
      fontSize: '14px',
      fontWeight: 500,
      textTransform: 'none',
      letterSpacing: '0em',
    },
    caption: {
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.4,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
          fontWeight: 500,
          fontSize: '14px',
          textTransform: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
          fontSize: '14px',
          fontWeight: 400,
        },
        input: {
          fontSize: '14px',
          fontWeight: 400,
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
          fontSize: '14px',
          fontWeight: 500,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
          fontWeight: 600,
          fontSize: '13px',
          letterSpacing: '0.02em',
        },
        body: {
          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: 1.5,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
          fontWeight: 600,
          fontSize: '18px',
        },
      },
    },
  },
});
