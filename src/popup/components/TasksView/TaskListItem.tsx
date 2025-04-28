import React from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Task, TaskStatus } from '../../../types/task';
import TaskStatusChip from './TaskStatusChip';
import TaskTriggerInfo from './TaskTriggerInfo';
import taskService from '../../../services/task-service';

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
  
  // 判断任务是否可以启用/禁用
  const canToggleStatus = task.status !== TaskStatus.COMPLETED && 
                          task.status !== TaskStatus.RUNNING;
  
  return (
    <ListItem
      button
      onClick={handleClick}
      divider
      sx={{
        borderLeft: '4px solid',
        borderLeftColor: theme => 
          task.status === TaskStatus.ENABLED 
            ? theme.palette.success.main
            : task.status === TaskStatus.RUNNING
              ? theme.palette.primary.main
              : task.status === TaskStatus.FAILED
                ? theme.palette.error.main
                : 'transparent',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)'
        },
        py: 1
      }}
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
          <Box sx={{ mt: 0.5 }}>
            <TaskTriggerInfo trigger={task.trigger} compact />
          </Box>
        }
      />
      
      <Box>
        <Tooltip title={task.status === TaskStatus.ENABLED ? '禁用任务' : '启用任务'}>
          <span>
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
        
        <Tooltip title="编辑">
          <IconButton onClick={handleEdit} size="small">
            <EditIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="删除">
          <IconButton onClick={handleDelete} size="small">
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </ListItem>
  );
};

export default TaskListItem; 