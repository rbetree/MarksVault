import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../popup/contexts/ThemeContext';
import ErrorBoundary from '../../popup/components/shared/ErrorBoundary';
import TaskConfigPage from '../../taskconfig/components/TaskConfigPage';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <TaskConfigPage />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
