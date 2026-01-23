import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import GitHubAuth from './GitHubAuth';
import SyncOperations from './SyncOperations';
import LoadingIndicator from '../shared/LoadingIndicator';
import { ToastRef } from '../shared/Toast';
import { AuthStatus, GitHubUser } from '../../../types/github';
import { GitHubCredentials } from '../../../utils/storage-service';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

const ActionArea = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 0.5, 0, 0.5),
  backgroundColor: 'transparent',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  width: '100%',
  justifyContent: 'space-between',
}));

const LeftColumn = styled(Box)(({ theme }) => ({
  width: '100%',
}));

interface SyncViewProps {
  toastRef?: React.RefObject<ToastRef>;
  authStatus: AuthStatus;
  user: GitHubUser | null;
  onAuth: (credentials: GitHubCredentials) => Promise<void>;
  onLogout: () => Promise<void>;
  isLoading: boolean;
}

const SyncView: React.FC<SyncViewProps> = ({
  toastRef,
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 操作区域 */}
      <ActionArea>
        <LeftColumn>
          <Paper
            sx={{
              p: '1px 4px',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '32px',
              borderRadius: 1,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              boxShadow: 'none',
              pl: 1
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: 400,
                fontSize: '0.9rem',
                color: 'text.primary',
              }}
            >
              GitHub 同步
            </Typography>
          </Paper>
        </LeftColumn>
      </ActionArea>

      {/* 内容区域 */}
      <Box
        sx={{
          flexGrow: 1,
          px: 0.5,
          pb: 1,
          pt: 1.5,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'transparent'
        }}
      >
        <Box sx={{ p: 0, overflow: 'hidden', backgroundColor: 'transparent' }}>
          {authStatus === AuthStatus.AUTHENTICATED && user ? (
            <SyncOperations
              user={user}
              onLogout={onLogout}
              toastRef={toastRef}
            />
          ) : (
            <GitHubAuth
              onAuth={onAuth}
              authStatus={authStatus}
              errorMessage=""
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SyncView; 