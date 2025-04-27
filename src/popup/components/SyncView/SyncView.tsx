import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import GitHubAuth from './GitHubAuth';
import SyncOperations from './SyncOperations';
import LoadingIndicator from '../shared/LoadingIndicator';
import { ToastRef } from '../shared/Toast';
import { AuthStatus, GitHubUser } from '../../../types/github';
import githubService from '../../../services/github-service';
import { GitHubCredentials } from '../../../utils/storage-service';
import storageService from '../../../utils/storage-service';

interface SyncViewProps {
  toastRef?: React.RefObject<ToastRef>;
}

const SyncView: React.FC<SyncViewProps> = ({ toastRef }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(AuthStatus.INITIAL);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
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
    setErrorMessage('');
    
    try {
      const userData = await githubService.validateCredentials(credentials);
      
      // 存储有效的凭据
      await storageService.saveGitHubCredentials(credentials);
      
      setUser(userData);
      setAuthStatus(AuthStatus.AUTHENTICATED);
      
      toastRef?.current?.showToast('GitHub认证成功', 'success');
    } catch (error) {
      console.error('Authentication failed:', error);
      setErrorMessage('认证失败，请检查您的访问令牌是否正确。');
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

  // 显示加载指示器
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <LoadingIndicator />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        p: 2,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        同步设置
      </Typography>
      
      <Paper elevation={2} sx={{ p: 0, overflow: 'hidden' }}>
        {authStatus === AuthStatus.AUTHENTICATED && user ? (
          <SyncOperations 
            user={user}
            onLogout={handleLogout}
            toastRef={toastRef}
          />
        ) : (
          <GitHubAuth
            onAuth={handleAuth}
            authStatus={authStatus}
            errorMessage={errorMessage}
          />
        )}
      </Paper>
    </Box>
  );
};

export default SyncView; 