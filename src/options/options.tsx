import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '../popup/styles/theme';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// 选项页面临时组件
const OptionsApp = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        MarksVault 设置
      </Typography>
      <Typography paragraph>
        设置页面正在开发中...
      </Typography>
    </Box>
  );
};

// 渲染选项页面
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <OptionsApp />
      </ThemeProvider>
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
} 