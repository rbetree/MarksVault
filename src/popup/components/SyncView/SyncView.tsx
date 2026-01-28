import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LogoutIcon from '@mui/icons-material/Logout';
import GitHubIcon from '@mui/icons-material/GitHub';
import GitHubAuth from './GitHubAuth';
import SyncOperations from './SyncOperations';
import LoadingIndicator from '../shared/LoadingIndicator';
import { ToastRef } from '../shared/Toast';
import { AuthStatus, GitHubUser } from '../../../types/github';
import { GitHubCredentials } from '../../../utils/storage-service';
import PageLayout from '../shared/PageLayout';

interface SyncViewProps {
  toastRef?: React.RefObject<ToastRef>;
  authStatus: AuthStatus;
  user: GitHubUser | null;
  onAuth: (credentials: GitHubCredentials) => Promise<void>;
  onLogout: () => Promise<void>;
  isLoading: boolean;
}

const SyncView: React.FC<SyncViewProps> = ({
  authStatus,
  user,
  onAuth,
  onLogout,
  isLoading
}) => {
  // 显示加载指示器
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <LoadingIndicator />
      </Box>
    );
  }

  return (
    <PageLayout
      title="概览"
      actions={
        authStatus === AuthStatus.AUTHENTICATED && user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="前往 GitHub 主页">
              <IconButton
                size="small"
                component="a"
                href={user.html_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'rgba(255,255,255,0.05)' } }}
              >
                <GitHubIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="断开连接">
              <IconButton
                size="small"
                onClick={onLogout}
                sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.dark' } }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : undefined
      }
    >
      {authStatus === AuthStatus.AUTHENTICATED && user ? (
        <SyncOperations />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', p: 2 }}>
          <GitHubAuth
            onAuth={onAuth}
            authStatus={authStatus}
            errorMessage=""
          />
        </Box>
      )}
    </PageLayout>
  );
};

export default SyncView;
