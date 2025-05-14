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
import TaskDialog from './TaskForm';
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
  
  // 任务表单对话框状态
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<Task | undefined>(undefined);
  
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
  
  // 加载当前编辑的任务详情
  useEffect(() => {
    const fetchTask = async () => {
      if (!currentTaskId) {
        setCurrentTask(undefined);
        return;
      }
      
      try {
        const result = await taskService.getTaskById(currentTaskId);
        if (result.success) {
          setCurrentTask(result.data as Task);
        } else {
          toastRef?.current?.showToast(`加载任务详情失败: ${result.error}`, 'error');
          setCurrentTask(undefined);
        }
      } catch (error) {
        console.error('获取任务详情时出错:', error);
        toastRef?.current?.showToast('加载任务详情时发生错误', 'error');
        setCurrentTask(undefined);
      }
    };
    
    fetchTask();
  }, [currentTaskId, toastRef]);
  
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
  
  // 处理任务编辑
  const handleEditTask = (taskId: string) => {
    setCurrentTaskId(taskId);
    setShowTaskDialog(true);
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
  
  // 打开创建任务对话框
  const handleCreateTask = () => {
    setCurrentTaskId(null);
    setCurrentTask(undefined);
    setShowTaskDialog(true);
  };
  
  // 关闭任务对话框
  const handleCloseTaskDialog = () => {
    setShowTaskDialog(false);
    setCurrentTaskId(null);
    setCurrentTask(undefined);
  };
  
  // 任务保存后的回调
  const handleTaskSaved = (taskId: string, isNew: boolean) => {
    refreshTasks();
    toastRef?.current?.showToast(
      isNew ? '任务已创建' : '任务已更新', 
      'success'
    );
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
    <Box sx={{ p: 2 }}>
      {/* 头部区域 */}
      <Box sx={taskHeaderStyles}>
        <Typography variant="h5" component="h1">
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
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="status-filter-label">状态</InputLabel>
            <Select
              labelId="status-filter-label"
              value={filterStatus}
              label="状态"
              onChange={handleFilterChange}
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
        disabled={deleteTaskId !== null || showTaskDialog}
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
      
      {/* 任务创建/编辑对话框 */}
      <TaskDialog
        open={showTaskDialog}
        onClose={handleCloseTaskDialog}
        task={currentTask}
        onTaskSaved={handleTaskSaved}
        disableRestoreFocus={true}
      />
    </Box>
  );
};

export default TasksView; 