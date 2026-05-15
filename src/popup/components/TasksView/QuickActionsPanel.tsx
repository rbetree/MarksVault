import React, { useState } from 'react';
import { browser } from 'wxt/browser';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CachedIcon from '@mui/icons-material/Cached';
import DashboardCard from '../shared/DashboardCard';
import { useFaviconRefresh } from '../shared/FaviconRefreshContext';

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
  const [isWarmingFavicons, setIsWarmingFavicons] = useState(false);
  const { bumpRefreshToken } = useFaviconRefresh();

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

  const handleWarmupFavicons = async () => {
    setIsWarmingFavicons(true);

    try {
      const response = await browser.runtime.sendMessage({
        type: 'WARMUP_BOOKMARK_FAVICONS',
        payload: { scope: 'bookmark_bar' },
      });

      const isPlainObject = (value: unknown): value is Record<string, unknown> => {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      };

      if (!isPlainObject(response)) {
        throw new Error('预热请求返回格式异常');
      }

      if (response.success !== true) {
        throw new Error(typeof response.error === 'string' ? response.error : '预热失败');
      }

      const data = isPlainObject(response.data) ? (response.data as Record<string, unknown>) : {};
      const attempted = typeof data.attempted === 'number' ? data.attempted : 0;
      const warmed = typeof data.warmed === 'number' ? data.warmed : 0;
      const failed = typeof data.failed === 'number' ? data.failed : 0;
      const skipped = typeof data.skipped === 'number' ? data.skipped : 0;
      const durationMs = typeof data.durationMs === 'number' ? data.durationMs : 0;

      const durationText = durationMs > 0 ? `，耗时 ${(durationMs / 1000).toFixed(1)}s` : '';
      // 预热完成后，触发一次 popup 内 favicon 刷新，让书签列表立即重新请求 `_favicon`
      bumpRefreshToken();
      toastRef?.current?.showToast(
        `图标预热完成：尝试 ${attempted}，完成 ${warmed}，失败 ${failed}，跳过 ${skipped}${durationText}`,
        'success',
      );
    } catch (error) {
      console.error('预热 favicon 失败:', error);
      toastRef?.current?.showToast(
        error instanceof Error ? error.message : '预热失败',
        'error',
      );
    } finally {
      setIsWarmingFavicons(false);
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

        <Box sx={{ mt: 1.5 }}>
          <Button
            variant="outlined"
            color="primary"
            fullWidth
            startIcon={
              isWarmingFavicons ? <CircularProgress size={18} color="inherit" /> : <CachedIcon />
            }
            disabled={isAuthLoading || isBackingUp || isOpeningRestore || isWarmingFavicons}
            onClick={handleWarmupFavicons}
            sx={{ py: 0.8 }}
          >
            {isWarmingFavicons ? '预热图标中...' : '预热书签图标缓存'}
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5, lineHeight: 1.4 }}
          >
            说明：将后台短暂访问书签栏中的站点以触发 Chromium favicon 缓存，可能写入浏览历史。
          </Typography>
        </Box>
      </DashboardCard>
    </Box>
  );
};

export default QuickActionsPanel;
