import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../popup/components/App';
import { ThemeProvider } from '../../popup/contexts/ThemeContext';

// 渲染弹出窗口
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
} 
