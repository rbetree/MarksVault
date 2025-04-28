import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import RefreshIcon from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import { ToastRef } from '../shared/Toast';
import { Task, TaskStatus } from '../../../types/task';
import taskService from '../../../services/task-service';
import TaskCard from './TaskCard';
import TaskListItem from './TaskListItem';
import EmptyTaskList from './EmptyTaskList';
import TaskSkeleton from './TaskSkeleton';
import { 
  taskHeaderStyles, 
  filterContainerStyles,
  fabStyles
} from '../../styles/TaskStyles';

interface TasksViewProps {
  toastRef?: React.RefObject<ToastRef>;
}

type ViewMode = 'card' | 'list';

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
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    // 暂时显示通知，实际功能将在V6.5实现
    toastRef?.current?.showToast('任务编辑功能将在后续版本实现', 'info');
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
  
  // 处理创建任务
  const handleCreateTask = () => {
    // 暂时显示通知，实际功能将在V6.5实现
    toastRef?.current?.showToast('任务创建功能将在后续版本实现', 'info');
    setShowCreateModal(false);
  };
  
  // 切换视图模式
  const handleViewModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: ViewMode | null,
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };
  
  // 过滤器变更处理
  const handleFilterChange = (event: SelectChangeEvent<TaskStatus | 'all'>) => {
    setFilterStatus(event.target.value as TaskStatus | 'all');
  };
  
  // 渲染任务列表
  const renderTasks = () => {
    if (loading) {
      return <TaskSkeleton mode={viewMode} count={3} />;
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
    
    if (viewMode === 'card') {
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
    } else {
      return (
        <Paper variant="outlined" sx={{ mt: 2 }}>
          <List sx={{ width: '100%' }}>
            {tasks.map(task => (
              <TaskListItem
                key={task.id}
                task={task}
                onStatusChange={handleTaskStatusChange}
                onEdit={handleEditTask}
                onDelete={handleDeleteConfirm}
              />
            ))}
          </List>
        </Paper>
      );
    }
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
            <IconButton 
              onClick={refreshTasks} 
              disabled={loading || isRefreshing}
              size="small"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="视图模式"
            size="small"
          >
            <ToggleButton value="card" aria-label="卡片视图">
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="列表视图">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="task-status-filter-label">状态</InputLabel>
            <Select
              labelId="task-status-filter-label"
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
      
      {/* 任务列表区域 */}
      <Box sx={{ position: 'relative' }}>
        {isRefreshing && !loading && (
          <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {renderTasks()}
      </Box>
      
      {/* 悬浮添加按钮 - 固定显示，提升可发现性 */}
      <Fab 
        color="primary" 
        aria-label="添加任务"
        sx={{
          ...fabStyles,
          // 增加阴影效果，提高视觉层级
          boxShadow: 3
        }}
        onClick={() => setShowCreateModal(true)}
      >
        <AddIcon />
      </Fab>
      
      {/* 删除确认对话框 */}
      <Dialog
        open={deleteTaskId !== null}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除这个任务吗？此操作无法撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>取消</Button>
          <Button onClick={handleDeleteConfirmed} color="error" autoFocus>
            删除
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 创建任务对话框(后期版本完成) */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>创建新任务</DialogTitle>
        <DialogContent>
          <DialogContentText>
            任务创建功能将在后续版本中实现（V6.5）。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateModal(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TasksView; 