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
import { ToastRef } from '../shared/Toast';
import { Task, TaskStatus } from '../../../types/task';
import taskService from '../../../services/task-service';
import TaskCard from './TaskCard';
import TaskListItem from './TaskListItem';
import EmptyTaskList from './EmptyTaskList';

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
      }
    };
    
    fetchTasks();
  }, [filterStatus, refreshTrigger]);
  
  // 刷新任务列表
  const refreshTasks = () => {
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
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'card' ? 'list' : 'card');
  };
  
  // 过滤器变更处理
  const handleFilterChange = (event: SelectChangeEvent<TaskStatus | 'all'>) => {
    setFilterStatus(event.target.value as TaskStatus | 'all');
  };
  
  // 渲染任务列表
  const renderTasks = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (error) {
      return (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      );
    }
    
    if (tasks.length === 0) {
      return (
        <EmptyTaskList 
          onCreateTask={() => setShowCreateModal(true)}
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
        <List sx={{ width: '100%', mt: 2 }}>
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
      );
    }
  };
  
  return (
    <Box sx={{ p: 2 }}>
      {/* 头部区域 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h1">
          任务管理
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined"
            startIcon={viewMode === 'card' ? <FilterListIcon /> : <FilterListIcon />}
            onClick={toggleViewMode}
            size="small"
          >
            {viewMode === 'card' ? '列表视图' : '卡片视图'}
          </Button>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
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
        {renderTasks()}
      </Box>
      
      {/* 悬浮添加按钮 - 仅在有任务或正在过滤时显示 */}
      {(tasks.length > 0 || filterStatus !== 'all') && (
        <Fab 
          color="primary" 
          aria-label="添加任务"
          sx={{ 
            position: 'fixed',
            bottom: 80, // 考虑底部导航栏的高度
            right: 16
          }}
          onClick={() => setShowCreateModal(true)}
        >
          <AddIcon />
        </Fab>
      )}
      
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