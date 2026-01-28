import React, { useState, useRef, useEffect } from 'react';
import { browser, type Browser } from 'wxt/browser';
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
  const getViewFromHash = (hash: string): NavOption => {
    if (hash === 'settings') return 'settings';
    if (hash === 'tasks') return 'tasks';
    if (hash === 'overview') return 'overview';
    // 兼容旧版本 hash
    if (hash === 'sync') return 'overview';
    return 'bookmarks';
  };

  // 从URL hash初始化当前视图
  const initView = (): NavOption => getViewFromHash(window.location.hash.substring(1));

  const [currentView, setCurrentView] = useState<NavOption>(initView());
  const toastRef = useRef<ToastRef>(null);

  // 监听 taskconfig/unlisted 页面写入的结果，用于在 popup 内展示 toast
  useEffect(() => {
    const MAX_NOTICE_AGE_MS = 60 * 1000;

    const isPlainObject = (value: unknown): value is Record<string, unknown> => {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    };

    const isRecent = (timestamp: unknown): boolean => {
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return false;
      return Date.now() - timestamp <= MAX_NOTICE_AGE_MS;
    };

    const handleTaskConfigResult = (value: unknown) => {
      if (!isPlainObject(value)) return;

      const timestamp = value['timestamp'];
      if (!isRecent(timestamp)) return;

      const success = value['success'] === true;
      const mode = value['mode'];
      const taskName = typeof value['taskName'] === 'string' ? value['taskName'] : '';

      if (success) {
        const verb = mode === 'edit' ? '任务已更新' : '任务已创建';
        const message = taskName ? `${verb}: ${taskName}` : verb;
        toastRef.current?.showToast(message, 'success');
      } else {
        toastRef.current?.showToast('任务保存失败', 'error');
      }
    };

    const handleTaskExecutionResult = (value: unknown) => {
      if (!isPlainObject(value)) return;

      const timestamp = value['timestamp'];
      if (!isRecent(timestamp)) return;

      const success = value['success'] === true;
      const message = typeof value['message'] === 'string'
        ? value['message']
        : success
          ? '任务执行成功'
          : '任务执行失败';

      toastRef.current?.showToast(message, success ? 'success' : 'error');
    };

    const clearKey = async (key: 'taskConfigResult' | 'taskExecutionResult') => {
      try {
        await browser.storage.local.remove(key);
      } catch (error) {
        console.warn(`清理 ${key} 失败:`, error);
      }
    };

    const handleStorageChange = (
      changes: { [key: string]: Browser.storage.StorageChange },
      areaName: Browser.storage.AreaName
    ) => {
      if (areaName !== 'local') return;

      const taskConfigChange = changes.taskConfigResult;
      if (taskConfigChange?.newValue) {
        handleTaskConfigResult(taskConfigChange.newValue);
        void clearKey('taskConfigResult');
      }

      const taskExecutionChange = changes.taskExecutionResult;
      if (taskExecutionChange?.newValue) {
        handleTaskExecutionResult(taskExecutionChange.newValue);
        void clearKey('taskExecutionResult');
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    // popup 打开时，如存在残留结果且仍在有效期内，则展示一次并清理
    const init = async () => {
      try {
        const stored = await browser.storage.local.get(['taskConfigResult', 'taskExecutionResult']);
        if (stored.taskConfigResult) {
          handleTaskConfigResult(stored.taskConfigResult);
          await clearKey('taskConfigResult');
        }
        if (stored.taskExecutionResult) {
          handleTaskExecutionResult(stored.taskExecutionResult);
          await clearKey('taskExecutionResult');
        }
      } catch (error) {
        console.warn('读取 task result 失败:', error);
      }
    };
    void init();

    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // GitHub用户状态管理
  const [authStatus, setAuthStatus] = useState<AuthStatus>(AuthStatus.INITIAL);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 同步 hash 导航（支持页面内跳转/外部 deep link）
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(getViewFromHash(window.location.hash.substring(1)));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
        return (
          <TasksView
            toastRef={toastRef}
            authStatus={authStatus}
            user={user}
            isAuthLoading={isLoading}
          />
        );
      case 'overview':
        return (
          <SyncView
            toastRef={toastRef}
            authStatus={authStatus}
            user={user}
            onAuth={handleAuth}
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
    // 更新URL hash以支持刷新和从选项页打开
    window.location.hash = value;
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
              overflow: 'auto', // 统一所有页面的滚动行为
              display: 'flex',
              flexDirection: 'column',
              pb: 7, // 为所有页面添加底部导航栏的高度间距
              px: 0, // 由各页面布局组件控制内边距（确保顶部栏贴边）
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
