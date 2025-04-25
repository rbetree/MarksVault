import { createTheme } from '@mui/material/styles';

// 创建自定义主题
const theme = createTheme({
  palette: {
    primary: {
      main: '#4285F4', // Google蓝色
    },
    secondary: {
      main: '#34A853', // Google绿色
    },
    error: {
      main: '#EA4335', // Google红色
    },
    warning: {
      main: '#FBBC05', // Google黄色
    },
    background: {
      default: '#FFFFFF',
      paper: '#F5F5F5',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
    h4: {
      fontSize: '20px',
      fontWeight: 500,
    },
    h5: {
      fontSize: '16px',
      fontWeight: 500,
    },
    body1: {
      fontSize: '14px',
    },
    body2: {
      fontSize: '12px',
    },
    button: {
      fontSize: '14px',
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          borderRadius: 0,
        },
      },
    },
  },
});

export default theme; 