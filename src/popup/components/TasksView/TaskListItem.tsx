import React, { useState } from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { Task, TaskStatus, TriggerType } from '../../../types/task';
import TaskStatusChip from './TaskStatusChip';
import TaskTriggerInfo from './TaskTriggerInfo';
import taskService from '../../../services/task-service';
import taskExecutor from '../../../services/task-executor';
import { 
  taskListItemStyles, 
  getTaskCardBorderStyle, 
  dateDisplayStyles,
  combineStyles 
} from '../../styles/TaskStyles';
import { formatRelativeTime } from '../../../utils/date-utils';

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
  const [executing, setExecuting] = useState(false);
  
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
  
  // 获取任务下次执行时间
  const getNextExecutionTime = () => {
    // 事件触发器没有下次执行时间概念
    return null;
  };
  
  // 判断是否为手动任务
  const isManualTask = task.trigger.type === TriggerType.MANUAL;
  
  // 判断任务是否可以启用/禁用（手动任务不需要此功能）
  const canToggleStatus = !isManualTask &&
                          task.status !== TaskStatus.COMPLETED &&
                          task.status !== TaskStatus.RUNNING;
  
  // 判断任务是否可以手动执行
  const canExecuteTask = task.status !== TaskStatus.RUNNING &&
                         task.status !== TaskStatus.DISABLED;
  
  // 手动执行任务
  const handleExecuteTask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (executing) return;
    
    setExecuting(true);
    try {
      console.log(`手动执行任务: ${task.id}`);
      await taskExecutor.executeTask(task.id);
      // 刷新任务列表，显示最新状态
      onStatusChange?.(task.id, true);
    } catch (error) {
      console.error('手动执行任务失败:', error);
      onStatusChange?.(task.id, false);
    } finally {
      setExecuting(false);
    }
  };
  
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              {task.name}
            </Typography>
            {isManualTask && (
              <Chip
                icon={<TouchAppIcon />}
                label="手动"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
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
      
      {/* 操作按钮 */}
      <Box>
        {isManualTask ? (
          // 手动任务：显示更显眼的执行按钮
          <Tooltip title="立即执行">
            <span style={{ display: 'inline-block' }}>
              <IconButton
                onClick={handleExecuteTask}
                disabled={!canExecuteTask || executing}
                color="primary"
                size="small"
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                  mr: 1
                }}
              >
                {executing ?
                  <CircularProgress size={20} sx={{ color: 'inherit' }} /> :
                  <PlayArrowIcon />
                }
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          // 自动任务：显示启用/禁用按钮
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
        )}
        
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