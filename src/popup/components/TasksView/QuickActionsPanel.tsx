import React, { useState } from 'react';
import { browser } from 'wxt/browser';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DashboardCard from '../shared/DashboardCard';

import taskExecutor from '../../../services/task-executor';
import taskService, { SYSTEM_TASK_IDS } from '../../../services/task-service';
import { AuthStatus, GitHubUser } from '../../../types/github';
import { ToastRef } from '../shared/Toast';

interface QuickActionsPanelProps {
  toastRef?: React.RefObject<ToastRef>;
  authStatus: AuthStatus;
  user: GitHubUser | null;
  isAuthLoading: boolean;
  onExecuted?: () => void;
}

/**
 * 任务页快捷操作面板
 * 将“备份/恢复”等非自动化操作统一放到任务域中，概览页只负责信息展示。
 */
const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  toastRef,
  authStatus,
  user,
  isAuthLoading,
  onExecuted,
}) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isOpeningRestore, setIsOpeningRestore] = useState(false);

  const isAuthenticated = authStatus === AuthStatus.AUTHENTICATED && !!user;

  const ensureSystemTasksReady = async () => {
    const result = await taskService.ensureSystemTasks();
    if (!result.success) {
      throw new Error(result.error || '初始化系统任务失败');
    }
  };

  const handleBackupNow = async () => {
    if (!isAuthenticated) {
      toastRef?.current?.showToast('请先在“概览”页连接 GitHub', 'warning');
      return;
    }

    setIsBackingUp(true);
    try {
      await ensureSystemTasksReady();
      const result = await taskExecutor.executeTask(SYSTEM_TASK_IDS.BOOKMARKS_BACKUP);

      if (result.success) {
        toastRef?.current?.showToast('已完成备份', 'success');
        onExecuted?.();
      } else {
        toastRef?.current?.showToast(result.error || '备份失败', 'error');
      }
    } catch (error) {
      console.error('快捷备份失败:', error);
      toastRef?.current?.showToast(
        error instanceof Error ? error.message : '备份失败',
        'error'
      );
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!isAuthenticated) {
      toastRef?.current?.showToast('请先在“概览”页连接 GitHub', 'warning');
      return;
    }

    setIsOpeningRestore(true);
    try {
      await ensureSystemTasksReady();
      const url = browser.runtime.getURL(
        `/taskconfig.html?mode=execute&taskId=${SYSTEM_TASK_IDS.BOOKMARKS_RESTORE}`
      );
      await browser.tabs.create({ url, active: true });
    } catch (error) {
      console.error('打开恢复页面失败:', error);
      toastRef?.current?.showToast(
        error instanceof Error ? error.message : '打开恢复页面失败',
        'error'
      );
    } finally {
      setIsOpeningRestore(false);
    }
  };

  return (
    <Box sx={{ px: 0, pt: 0, mb: 2 }}>
      <DashboardCard
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>快捷操作</Typography>
          </Box>
        }
        icon={<TaskAltIcon />}
        contentSx={{ p: 1.5 }}
      >
        {!isAuthLoading && !isAuthenticated && (
          <Alert
            severity="warning"
            sx={{ mb: 1.5, py: 0, '& .MuiAlert-message': { fontSize: '0.85rem' } }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  window.location.hash = 'overview';
                }}
              >
                连接 GitHub
              </Button>
            }
          >
            未连接 GitHub
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            startIcon={
              isBackingUp ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />
            }
            disabled={isAuthLoading || !isAuthenticated || isBackingUp || isOpeningRestore}
            onClick={handleBackupNow}
            sx={{ py: 0.8 }}
          >
            立即备份
          </Button>

          <Button
            variant="outlined"
            color="primary"
            fullWidth
            startIcon={
              isOpeningRestore ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <CloudDownloadIcon />
              )
            }
            disabled={isAuthLoading || !isAuthenticated || isBackingUp || isOpeningRestore}
            onClick={handleRestore}
            sx={{ py: 0.8 }}
          >
            恢复书签
          </Button>
        </Box>
      </DashboardCard>
    </Box>
  );
};

export default QuickActionsPanel;
