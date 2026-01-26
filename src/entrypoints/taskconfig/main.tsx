import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '../../popup/contexts/ThemeContext';
import TaskConfigPage from '../../taskconfig/components/TaskConfigPage';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <CssBaseline />
      <TaskConfigPage />
    </ThemeProvider>
  </React.StrictMode>
);
