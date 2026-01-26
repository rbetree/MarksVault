import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../popup/components/App';
import { ThemeProvider } from '../../popup/contexts/ThemeContext';

// 选项页默认进入 settings 视图（避免复用 popup 的固定宽高样式）
if (!window.location.hash || window.location.hash === '#') {
  window.location.hash = 'settings';
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

