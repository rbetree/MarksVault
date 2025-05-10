import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Header from './shared/Header';
import AppBottomNavigation, { NavOption } from './shared/BottomNavigation';
import BookmarksView from './BookmarksView/BookmarksView';
import ErrorBoundary from './shared/ErrorBoundary';
import Toast, { ToastRef } from './shared/Toast';
import SyncView from './SyncView/SyncView';
import TasksView from './TasksView/TasksView';
import SettingsView from './SettingsView/SettingsView';
import { AuthStatus, GitHubUser } from '../../types/github';
import { GitHubCredentials } from '../../utils/storage-service';
import storageService from '../../utils/storage-service';
import githubService from '../../services/github-service';
import { StyledEngineProvider } from '@mui/material/styles';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<NavOption>('bookmarks');
  const toastRef = useRef<ToastRef>(null);
  
  // GitHub用户状态管理
  const [authStatus, setAuthStatus] = useState<AuthStatus>(AuthStatus.INITIAL);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 组件挂载时检查现有凭据
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        setIsLoading(true);
        const credentialsResult = await storageService.getGitHubCredentials();
        
        if (credentialsResult.success && credentialsResult.data) {
          try {
            const userData = await githubService.validateCredentials(credentialsResult.data);
            setUser(userData);
            setAuthStatus(AuthStatus.AUTHENTICATED);
          } catch (error) {
            console.error('Stored credentials are invalid:', error);
            setAuthStatus(AuthStatus.INITIAL);
            await storageService.clearGitHubCredentials();
          }
        } else {
          setAuthStatus(AuthStatus.INITIAL);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setAuthStatus(AuthStatus.INITIAL);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingAuth();
  }, []);

  // 处理认证
  const handleAuth = async (credentials: GitHubCredentials) => {
    setAuthStatus(AuthStatus.AUTHENTICATING);
    
    try {
      const userData = await githubService.validateCredentials(credentials);
      
      // 存储有效的凭据
      await storageService.saveGitHubCredentials(credentials);
      
      setUser(userData);
      setAuthStatus(AuthStatus.AUTHENTICATED);
      
      toastRef?.current?.showToast('GitHub认证成功', 'success');
    } catch (error) {
      console.error('Authentication failed:', error);
      setAuthStatus(AuthStatus.FAILED);
    }
  };

  // 处理注销
  const handleLogout = async () => {
    try {
      await storageService.clearGitHubCredentials();
      setUser(null);
      setAuthStatus(AuthStatus.INITIAL);
      toastRef?.current?.showToast('已断开GitHub连接', 'info');
    } catch (error) {
      console.error('Logout failed:', error);
      toastRef?.current?.showToast('断开连接失败', 'error');
    }
  };

  // 根据当前选中的导航项渲染不同的内容
  const renderContent = () => {
    switch (currentView) {
      case 'bookmarks':
        return <BookmarksView toastRef={toastRef} />;
      case 'tasks':
        return <TasksView toastRef={toastRef} />;
      case 'sync':
        return (
          <SyncView 
            toastRef={toastRef} 
            authStatus={authStatus}
            user={user}
            onAuth={handleAuth}
            onLogout={handleLogout}
            isLoading={isLoading}
          />
        );
      case 'settings':
        return <SettingsView toastRef={toastRef} />;
      default:
        return <BookmarksView toastRef={toastRef} />;
    }
  };

  // 处理导航变化
  const handleNavChange = (value: NavOption) => {
    setCurrentView(value);
  };

  return (
    <StyledEngineProvider injectFirst>
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
          <Header 
            user={user}
            onLogout={handleLogout}
          />
          
          <Container
            disableGutters
            maxWidth={false}
            sx={{
              flexGrow: 1,
              overflow: 'auto',
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
    </StyledEngineProvider>
  );
};

export default App; 