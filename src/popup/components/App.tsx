import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Header from './Header';
import AppBottomNavigation, { NavOption } from './BottomNavigation';
import BookmarksView from './BookmarksView';
import ErrorBoundary from './ErrorBoundary';
import Toast, { ToastRef } from './Toast';

// 不同导航项的内容组件
const TasksView = () => <Box sx={{ p: 3 }}><h2>任务管理</h2><p>任务管理功能正在开发中...</p></Box>;
const SyncView = () => <Box sx={{ p: 3 }}><h2>同步设置</h2><p>同步功能正在开发中...</p></Box>;
const SettingsView = () => <Box sx={{ p: 3 }}><h2>系统设置</h2><p>设置功能正在开发中...</p></Box>;

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<NavOption>('bookmarks');
  const toastRef = useRef<ToastRef>(null);

  // 根据当前选中的导航项渲染不同的内容
  const renderContent = () => {
    switch (currentView) {
      case 'bookmarks':
        return <BookmarksView toastRef={toastRef} />;
      case 'tasks':
        return <TasksView />;
      case 'sync':
        return <SyncView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <BookmarksView toastRef={toastRef} />;
    }
  };

  // 处理导航变化
  const handleNavChange = (value: NavOption) => {
    setCurrentView(value);
  };

  return (
    <ErrorBoundary>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <Header />
        
        <Container
          disableGutters
          maxWidth={false}
          sx={{
            flexGrow: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            pb: 7, // 留出底部导航的高度
          }}
        >
          {renderContent()}
        </Container>
        
        <AppBottomNavigation
          value={currentView}
          onChange={handleNavChange}
        />
        
        <Toast ref={toastRef} />
      </Box>
    </ErrorBoundary>
  );
};

export default App; 