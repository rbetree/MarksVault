import React from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
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
  isLoading: boolean;
  storedCredentials?: GitHubCredentials | null;
  errorMessage?: string;
}

const SyncView: React.FC<SyncViewProps> = ({
  authStatus,
  user,
  onAuth,
  isLoading,
  storedCredentials = null,
  errorMessage = ''
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
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
          </Box>
        ) : undefined
      }
    >
      {authStatus === AuthStatus.AUTHENTICATED && user ? (
        <SyncOperations />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', p: 2 }}>
          {errorMessage ? (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {errorMessage}
            </Alert>
          ) : null}

          {storedCredentials ? (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onAuth(storedCredentials)}
              disabled={authStatus === AuthStatus.AUTHENTICATING}
              sx={{ mb: 1, textTransform: 'none' }}
            >
              使用已保存 Token 重试连接
            </Button>
          ) : null}

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
