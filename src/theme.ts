import { createTheme } from '@mui/material/styles';

// Custom dark theme matching the game's aesthetic
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4a9eff',
      light: '#7ab8ff',
      dark: '#0078ff',
    },
    secondary: {
      main: '#ff6b6b',
      light: '#ff9494',
      dark: '#ff4242',
    },
    background: {
      default: '#0f0f23',
      paper: '#1a1a2e',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
          borderRight: '1px solid #3a3a5e',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
        },
      },
    },
  },
});
