import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
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
import taskService from '../../../services/task-service';
import TaskCard from './TaskCard';
import EmptyTaskList from './EmptyTaskList';
import TaskSkeleton from './TaskSkeleton';
import {
  taskHeaderStyles,
  filterContainerStyles,
  fabStyles,
  globalFabStyles
} from '../../styles/TaskStyles';

interface TasksViewProps {
  toastRef?: React.RefObject<ToastRef>;
}

/**
 * 任务管理主视图组件
 * 负责显示任务列表、提供过滤和任务操作功能
 */
const TasksView: React.FC<TasksViewProps> = ({ toastRef }) => {
  // 状态管理
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 加载任务数据
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);

      try {
        let result;
        if (filterStatus === 'all') {
          result = await taskService.getTasksByStatus();
        } else {
          result = await taskService.getTasksByStatus(filterStatus);
        }

        if (result.success) {
          setTasks(result.data as Task[]);
        } else {
          setError('加载任务失败: ' + result.error);
        }
      } catch (error) {
        console.error('获取任务时出错:', error);
        setError('加载任务时发生错误');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchTasks();
  }, [filterStatus, refreshTrigger]);

  // 监听storage变化，处理任务配置页面的结果
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.taskConfigResult) {
        const result = changes.taskConfigResult.newValue;
        if (result && result.success) {
          // 刷新任务列表
          refreshTasks();
          // 显示成功提示
          toastRef?.current?.showToast(
            result.mode === 'create' ? '任务创建成功' : '任务更新成功',
            'success'
          );
          // 清除标记
          chrome.storage.local.remove('taskConfigResult');
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
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
    const url = chrome.runtime.getURL('taskconfig/taskconfig.html');
    const params = new URLSearchParams({ mode });
    if (taskId) {
      params.append('taskId', taskId);
    }

    chrome.tabs.create({
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
          sx={{ my: 2 }}
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
      <Box sx={{ mt: 2 }}>
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
    <Box sx={{ width: '100%', pt: 0.5 }}>
      {/* 头部区域 */}
      <Box sx={{ ...taskHeaderStyles, px: 0, mb: 1.5 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>
          任务管理
        </Typography>

        <Box sx={filterContainerStyles}>
          <Tooltip title="刷新任务列表">
            <span style={{ display: 'inline-block' }}>
              <IconButton
                onClick={refreshTasks}
                disabled={loading || isRefreshing}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>

          <FormControl size="small" sx={{ minWidth: 110, '& .MuiInputBase-root': { height: '34px' } }}>
            <InputLabel id="status-filter-label" sx={{ fontSize: '0.875rem' }}>状态</InputLabel>
            <Select
              labelId="status-filter-label"
              value={filterStatus}
              label="状态"
              onChange={handleFilterChange}
              sx={{ fontSize: '0.875rem' }}
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value={TaskStatus.ENABLED}>已启用</MenuItem>
              <MenuItem value={TaskStatus.DISABLED}>已禁用</MenuItem>
              <MenuItem value={TaskStatus.RUNNING}>运行中</MenuItem>
              <MenuItem value={TaskStatus.COMPLETED}>已完成</MenuItem>
              <MenuItem value={TaskStatus.FAILED}>失败</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* 任务列表 */}
      {renderTasks()}

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
    </Box>
  );
};

export default TasksView; 