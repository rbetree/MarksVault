import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import GitHubIcon from '@mui/icons-material/GitHub';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DashboardCard from '../shared/DashboardCard';
import Skeleton from '@mui/material/Skeleton';

import backupService from '../../../services/backup-service';
import { BackupStatus } from '../../../types/backup';
import { formatDate } from '../../../utils/date-utils';
import taskService, { isSystemTaskId } from '../../../services/task-service';
import { TaskStatus } from '../../../types/task';

/**
 * 概览页内容（保留文件名以避免大规模改动）：
 * - 仅展示 GitHub 连接状态、备份统计信息等“信息可视化”
 * - 备份/恢复等“操作”统一迁移到任务页
 */
const SyncOperations: React.FC = () => {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({});
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isStatsUpdating, setIsStatsUpdating] = useState(false);
  const [taskStats, setTaskStats] = useState({
    total: 0,
    enabled: 0,
    disabled: 0,
    failed: 0,
    lastExecutionTime: 0,
  });

  const handleBackupStatusUpdate = useCallback((updatedStatus: BackupStatus) => {
    setBackupStatus(updatedStatus);
    setIsStatsUpdating(false);
  }, []);

  // 组件挂载时加载备份状态
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsStatsLoading(true);

        // 打开概览页时优先使用缓存数据，避免每次打开都请求 GitHub
        const status = await backupService.getBackupStatus(false);
        setBackupStatus(status);
      } catch (error) {
        console.error('加载概览数据失败:', error);
      } finally {
        setIsStatsLoading(false);
      }
    };

    loadData();
  }, [handleBackupStatusUpdate]);

  // 加载任务统计信息（概览展示）
  useEffect(() => {
    const loadTaskStats = async () => {
      try {
        const result = await taskService.getTasksByStatus();
        if (!result.success) return;

        const rawData = result.data as unknown;
        const taskList: any[] = Array.isArray(rawData)
          ? (rawData as any[])
          : rawData && typeof rawData === 'object' && 'tasks' in (rawData as any)
            ? (Object.values((rawData as any).tasks ?? {}) as any[])
            : [];

        const tasks = taskList.filter(
          (t: any) => t && typeof t.id === 'string' && !isSystemTaskId(t.id)
        ) as any[];

        const enabled = tasks.filter(t => t.status === TaskStatus.ENABLED).length;
        const disabled = tasks.filter(t => t.status === TaskStatus.DISABLED).length;
        const failed = tasks.filter(t => t.status === TaskStatus.FAILED).length;

        const lastExecutionTime = tasks.reduce((max, t) => {
          const ts = t?.history?.lastExecution?.timestamp;
          return typeof ts === 'number' && ts > max ? ts : max;
        }, 0);

        setTaskStats({
          total: tasks.length,
          enabled,
          disabled,
          failed,
          lastExecutionTime,
        });
      } catch (error) {
        console.error('加载任务统计失败:', error);
      }
    };

    loadTaskStats();
  }, []);

  // 辅助函数：格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 手动刷新备份统计数据
  const handleRefreshStats = async () => {
    try {
      setIsStatsUpdating(true);
      const status = await backupService.getBackupStatus(true, handleBackupStatusUpdate);
      setBackupStatus(status);
    } catch (error) {
      console.error('刷新统计数据失败:', error);
      setIsStatsUpdating(false);
    }
  };

  return (
    <Box sx={{ m: 0 }}>
      <Grid container spacing={2}>
        {/* 备份统计信息 */}
        <Grid item xs={12} sm={6}>
          <DashboardCard
            title="备份统计"
            icon={<AssessmentIcon />}
            action={
              <Tooltip title={isStatsLoading ? '正在加载数据' : '刷新统计数据'}>
                <span style={{ display: 'inline-flex' }}>
                  <IconButton
                    size="small"
                    onClick={handleRefreshStats}
                    disabled={isStatsLoading || isStatsUpdating}
                    sx={{ p: 0.5, width: 28, height: 28 }}
                  >
                    {isStatsLoading || isStatsUpdating ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <RefreshIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            }
            sx={{ height: '100%' }}
          >
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  {isStatsLoading ? (
                    <Skeleton variant="text" width={36} height={32} sx={{ mx: 'auto' }} />
                  ) : (
                    <Typography
                      variant="h4"
                      sx={{ fontWeight: 600, fontSize: '1.5rem', mb: 0.5, color: 'primary.main' }}
                    >
                      {backupStatus.stats ? backupStatus.stats.totalBackups ?? 0 : 0}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    总备份
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  {isStatsLoading ? (
                    <Skeleton variant="text" width={36} height={32} sx={{ mx: 'auto' }} />
                  ) : (
                    <Typography variant="h4" sx={{ fontWeight: 600, fontSize: '1.5rem', mb: 0.5 }}>
                      {backupStatus.stats ? backupStatus.stats.totalBookmarks ?? 0 : 0}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    书签
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  {isStatsLoading ? (
                    <Skeleton variant="text" width={36} height={32} sx={{ mx: 'auto' }} />
                  ) : (
                    <Typography variant="h4" sx={{ fontWeight: 600, fontSize: '1.5rem', mb: 0.5 }}>
                      {backupStatus.stats ? backupStatus.stats.totalFolders ?? 0 : 0}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    文件夹
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              {isStatsLoading ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      上次备份
                    </Typography>
                    <Skeleton variant="text" width={96} height={16} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      最新大小
                    </Typography>
                    <Skeleton variant="text" width={64} height={16} />
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">上次备份</Typography>
                    <Typography variant="caption" color="text.primary">
                      {backupStatus.lastBackupTime ? formatDate(backupStatus.lastBackupTime) : '暂无'}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">最新大小</Typography>
                    <Typography variant="caption" color="text.primary">
                      {formatFileSize(backupStatus.stats?.fileSize)}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            {isStatsLoading ? (
              <Button
                fullWidth
                variant="outlined"
                size="small"
                disabled
                startIcon={<GitHubIcon fontSize="small" />}
                sx={{ mt: 2, textTransform: 'none', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }}
              >
                <Skeleton variant="text" width={84} height={16} />
              </Button>
            ) : (
              backupStatus.backupFileUrl ? (
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={<GitHubIcon fontSize="small" />}
                  component="a"
                  href={backupStatus.backupFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mt: 2, textTransform: 'none', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
                >
                  查看最新备份
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled
                  startIcon={<GitHubIcon fontSize="small" />}
                  sx={{ mt: 2, textTransform: 'none', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }}
                >
                  暂无备份
                </Button>
              )
            )}
          </DashboardCard>
        </Grid>

        {/* 任务统计 */}
        <Grid item xs={12} sm={6}>
          <DashboardCard
            title="任务概览"
            icon={<TaskAltIcon />}
            action={
              <Button
                size="small"
                onClick={() => {
                  window.location.hash = 'tasks';
                }}
                sx={{ minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
              >
                管理
              </Button>
            }
            sx={{ height: '100%' }}
          >
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{taskStats.total}</Typography>
                  <Typography variant="caption" color="text.secondary">总任务</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.08)', borderRadius: 1, textAlign: 'center', color: 'success.light' }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{taskStats.enabled}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>运行中</Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
                <Typography variant="caption" color="text.secondary">失败任务</Typography>
                <Typography variant="caption" color={taskStats.failed > 0 ? "error.main" : "text.secondary"} sx={{ fontWeight: taskStats.failed > 0 ? 'bold' : 'normal' }}>
                  {taskStats.failed}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
                <Typography variant="caption" color="text.secondary">已禁用</Typography>
                <Typography variant="caption" color="text.secondary">{taskStats.disabled}</Typography>
              </Box>
            </Box>

            {taskStats.lastExecutionTime > 0 && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  最近活动: {formatDate(taskStats.lastExecutionTime)}
                </Typography>
              </Box>
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SyncOperations;
