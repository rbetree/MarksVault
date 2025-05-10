import React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { Task, TaskStatus, TriggerType } from '../../../types/task';
import TaskStatusChip from './TaskStatusChip';
import TaskTriggerInfo from './TaskTriggerInfo';
import taskService from '../../../services/task-service';
import { 
  taskListItemStyles, 
  getTaskCardBorderStyle, 
  dateDisplayStyles,
  combineStyles 
} from '../../styles/TaskStyles';

interface TaskListItemProps {
  task: Task;
  onStatusChange?: (taskId: string, success: boolean) => void;
  onEdit?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
}

/**
 * 任务列表项组件
 * 简化版的任务信息，用于在列表中显示
 */
const TaskListItem: React.FC<TaskListItemProps> = ({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onSelect
}) => {
  // 处理任务选择
  const handleClick = () => {
    onSelect?.(task.id);
  };
  
  // 处理启用/禁用任务
  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发选择事件
    
    try {
      const isEnabled = task.status === TaskStatus.ENABLED;
      const result = isEnabled 
        ? await taskService.disableTask(task.id)
        : await taskService.enableTask(task.id);
      
      if (result.success) {
        onStatusChange?.(task.id, true);
      } else {
        onStatusChange?.(task.id, false);
        console.error('更改任务状态失败:', result.error);
      }
    } catch (error) {
      console.error('更改任务状态时出错:', error);
      onStatusChange?.(task.id, false);
    }
  };
  
  // 处理编辑任务
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发选择事件
    onEdit?.(task.id);
  };
  
  // 处理删除任务
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发选择事件
    onDelete?.(task.id);
  };
  
  // 格式化相对时间
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;
    
    // 如果时间已过，返回"已过期"
    if (diff < 0) return '已过期';
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}天后`;
    } else if (hours > 0) {
      return `${hours}小时后`;
    } else if (minutes > 0) {
      return `${minutes}分钟后`;
    } else {
      return '即将执行';
    }
  };
  
  // 获取任务下次执行时间
  const getNextExecutionTime = () => {
    // 事件触发器没有下次执行时间概念
    return null;
  };
  
  // 判断任务是否可以启用/禁用
  const canToggleStatus = task.status !== TaskStatus.COMPLETED && 
                          task.status !== TaskStatus.RUNNING;
  
  // 获取下次执行时间
  const nextExecutionTime = getNextExecutionTime();
  
  return (
    <ListItem
      onClick={handleClick}
      divider
      sx={combineStyles(taskListItemStyles, getTaskCardBorderStyle(task.status))}
    >
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              {task.name}
            </Typography>
            <Box sx={{ ml: 1 }}>
              <TaskStatusChip status={task.status} size="small" />
            </Box>
          </Box>
        }
        secondary={
          <>
            <Box sx={{ mt: 0.5 }}>
              <TaskTriggerInfo trigger={task.trigger} compact />
            </Box>
            
            {/* 下次执行时间 */}
            {nextExecutionTime && (
              <Box sx={combineStyles(dateDisplayStyles, { mt: 0.5 })}>
                <AccessTimeIcon fontSize="inherit" sx={{ mr: 0.5 }} />
                <span>下次执行: {formatRelativeTime(nextExecutionTime)}</span>
                {task.history.lastExecution && !task.history.lastExecution.success && (
                  <Chip 
                    label="上次失败" 
                    color="error" 
                    size="small" 
                    variant="outlined" 
                    sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
                  />
                )}
              </Box>
            )}
          </>
        }
      />
      
      <Box>
        <Tooltip title={task.status === TaskStatus.ENABLED ? '禁用任务' : '启用任务'}>
          <span style={{ display: 'inline-block' }}>
            <IconButton 
              onClick={handleToggleStatus} 
              disabled={!canToggleStatus}
              size="small"
              color={task.status === TaskStatus.ENABLED ? 'primary' : 'default'}
            >
              {task.status === TaskStatus.ENABLED ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </span>
        </Tooltip>
        
        <Tooltip title="编辑任务">
          <IconButton onClick={handleEdit} size="small">
            <EditIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="删除任务">
          <IconButton onClick={handleDelete} size="small">
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </ListItem>
  );
};

export default TaskListItem; 