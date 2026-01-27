import React from 'react';
import Box from '@mui/material/Box';
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
    <PageLayout title="概览">
      {authStatus === AuthStatus.AUTHENTICATED && user ? (
        <SyncOperations
          user={user}
          onLogout={onLogout}
          toastRef={toastRef}
        />
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
