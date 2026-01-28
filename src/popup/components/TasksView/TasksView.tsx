import React, { useState, useEffect } from 'react';
import { browser, type Browser } from 'wxt/browser';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import { ToastRef } from '../shared/Toast';
import { Task, TaskStatus } from '../../../types/task';
import taskService, { isSystemTaskId } from '../../../services/task-service';
import TaskCard from './TaskCard';
import EmptyTaskList from './EmptyTaskList';
import TaskSkeleton from './TaskSkeleton';
import {
  globalFabStyles
} from '../../styles/TaskStyles';
import { AuthStatus, GitHubUser } from '../../../types/github';
import QuickActionsPanel from './QuickActionsPanel';
import PageLayout from '../shared/PageLayout';

interface TasksViewProps {
  toastRef?: React.RefObject<ToastRef>;
  authStatus: AuthStatus;
  user: GitHubUser | null;
  isAuthLoading: boolean;
}

const TasksView: React.FC<TasksViewProps> = ({
  toastRef,
  authStatus,
  user,
  isAuthLoading
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 加载任务列表
  useEffect(() => {
    let isMounted = true;

    const fetchTasks = async () => {
      try {
        if (loading) {
          // 只在初始加载时显示骨架屏
        }

        setError(null);

        const result = filterStatus === 'all'
          ? await taskService.getTasksByStatus()
          : await taskService.getTasksByStatus(filterStatus);

        if (!isMounted) return;

        if (result.success) {
          // 兼容旧数据：result.data 既可能是 Task[]，也可能是 { tasks: Record<string, Task> }
          const rawData = result.data as unknown;
          const taskList: Task[] = Array.isArray(rawData)
            ? (rawData as Task[])
            : rawData && typeof rawData === 'object' && 'tasks' in (rawData as any)
              ? (Object.values((rawData as any).tasks ?? {}) as Task[])
              : [];

          // 过滤掉系统任务
          const filteredTasks = taskList.filter(
            t => t && typeof t.id === 'string' && !isSystemTaskId(t.id)
          );
          setTasks(filteredTasks);
        } else {
          setError(result.error || '获取任务列表失败');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('加载任务失败:', err);
        setError('加载任务失败，请稍后重试');
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchTasks();

    return () => {
      isMounted = false;
    };
  }, [filterStatus, refreshTrigger]);

  // 监听存储变化，自动刷新任务列表
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: Browser.storage.StorageChange },
      areaName: Browser.storage.AreaName
    ) => {
      // 任务存储 key 为 tasks_data（见 task-service.ts）
      if (areaName === 'local' && changes.tasks_data) {
        // 只有当任务数据真的发生变化时才刷新
        setRefreshTrigger(prev => prev + 1);
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, [toastRef]);

  // 刷新任务列表
  const refreshTasks = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
  };

  // 处理任务状态变更
  const handleTaskStatusChange = (taskId: string, success: boolean) => {
    if (success) {
      refreshTasks();
      toastRef?.current?.showToast('任务状态已更新', 'success');
    } else {
      toastRef?.current?.showToast('更新任务状态失败', 'error');
    }
  };

  // 打开任务配置页面
  const openTaskConfigPage = (mode: 'create' | 'edit', taskId?: string) => {
    const url = browser.runtime.getURL('/taskconfig.html');
    const params = new URLSearchParams({ mode });
    if (taskId) {
      params.append('taskId', taskId);
    }

    browser.tabs.create({
      url: `${url}?${params.toString()}`,
      active: true
    });
  };

  // 处理任务编辑
  const handleEditTask = (taskId: string) => {
    openTaskConfigPage('edit', taskId);
  };

  // 处理删除确认
  const handleDeleteConfirm = (taskId: string) => {
    setDeleteTaskId(taskId);
  };

  // 关闭删除确认对话框
  const handleDeleteCancel = () => {
    setDeleteTaskId(null);
  };

  // 执行删除操作
  const handleDeleteConfirmed = async () => {
    if (!deleteTaskId) return;

    try {
      const result = await taskService.deleteTask(deleteTaskId);

      if (result.success) {
        refreshTasks();
        toastRef?.current?.showToast('任务已删除', 'success');
      } else {
        toastRef?.current?.showToast(`删除任务失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('删除任务时出错:', error);
      toastRef?.current?.showToast('删除任务时发生错误', 'error');
    } finally {
      setDeleteTaskId(null);
    }
  };

  // 打开创建任务页面
  const handleCreateTask = () => {
    openTaskConfigPage('create');
  };

  // 过滤器变更处理
  const handleFilterChange = (event: SelectChangeEvent<TaskStatus | 'all'>) => {
    setFilterStatus(event.target.value as TaskStatus | 'all');
  };

  // 渲染任务列表
  const renderTasks = () => {
    if (loading) {
      return <TaskSkeleton count={3} />;
    }

    if (error) {
      return (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={refreshTasks}>
              重试
            </Button>
          }
        >
          {error}
        </Alert>
      );
    }

    if (tasks.length === 0) {
      return (
        <EmptyTaskList
          filtered={filterStatus !== 'all'}
        />
      );
    }

    return (
      <Box>
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={handleTaskStatusChange}
            onEdit={handleEditTask}
            onDelete={handleDeleteConfirm}
          />
        ))}
      </Box>
    );
  };

  return (
    <PageLayout
      title="任务管理"
      contentSx={{
        pb: 18, // 为固定悬浮按钮预留足够底部空间
      }}
      actions={
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title="刷新任务列表">
            <span style={{ display: 'inline-block' }}>
              <IconButton
                onClick={refreshTasks}
                disabled={loading || isRefreshing}
                size="small"
                sx={{ p: 0.5, mr: 1 }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <FormControl size="small" sx={{ minWidth: 80, '& .MuiInputBase-root': { height: '24px', fontSize: '0.8rem', border: 'none' }, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}>
            <Select
              value={filterStatus}
              onChange={handleFilterChange}
              sx={{
                fontSize: '0.8rem',
                '& .MuiSelect-select': { py: 0, pr: '24px !important' }
              }}
              variant="standard"
              disableUnderline
            >
              <MenuItem value="all" sx={{ fontSize: '0.85rem', minHeight: '32px', py: 0.5 }}>全部</MenuItem>
              <MenuItem value={TaskStatus.ENABLED} sx={{ fontSize: '0.85rem', minHeight: '32px', py: 0.5 }}>已启用</MenuItem>
              <MenuItem value={TaskStatus.DISABLED} sx={{ fontSize: '0.85rem', minHeight: '32px', py: 0.5 }}>已禁用</MenuItem>
              <MenuItem value={TaskStatus.RUNNING} sx={{ fontSize: '0.85rem', minHeight: '32px', py: 0.5 }}>运行中</MenuItem>
              <MenuItem value={TaskStatus.COMPLETED} sx={{ fontSize: '0.85rem', minHeight: '32px', py: 0.5 }}>已完成</MenuItem>
              <MenuItem value={TaskStatus.FAILED} sx={{ fontSize: '0.85rem', minHeight: '32px', py: 0.5 }}>失败</MenuItem>
            </Select>
          </FormControl>
        </Box>
      }
    >
      <Box>
        <QuickActionsPanel
          toastRef={toastRef}
          authStatus={authStatus}
          user={user}
          isAuthLoading={isAuthLoading}
          onExecuted={refreshTasks}
        />
        {renderTasks()}
      </Box>

      {/* 浮动添加按钮 */}
      <Fab
        color="primary"
        size="medium"
        aria-label="添加任务"
        sx={globalFabStyles}
        onClick={handleCreateTask}
        disabled={deleteTaskId !== null}
      >
        <AddIcon />
      </Fab>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteTaskId !== null}
        onClose={handleDeleteCancel}
        disableRestoreFocus={true}
        disableEnforceFocus={true}
        disableAutoFocus={false}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除这个任务吗？此操作无法撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="inherit">
            取消
          </Button>
          <Button onClick={handleDeleteConfirmed} color="error" autoFocus>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

export default TasksView;
