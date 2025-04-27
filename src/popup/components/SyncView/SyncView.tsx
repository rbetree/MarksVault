import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import GitHubAuth from './GitHubAuth';
import SyncOperations from './SyncOperations';
import LoadingIndicator from '../shared/LoadingIndicator';
import { ToastRef } from '../shared/Toast';
import { AuthStatus, GitHubUser } from '../../../types/github';
import { GitHubCredentials } from '../../../utils/storage-service';

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
      <Paper elevation={2} sx={{ p: 0, overflow: 'hidden' }}>
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
      </Paper>
    </Box>
  );
};

export default SyncView; 