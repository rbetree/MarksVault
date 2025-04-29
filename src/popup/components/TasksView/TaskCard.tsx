import React, { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import HistoryIcon from '@mui/icons-material/History';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import { Task, TaskStatus, TimeScheduleType, TriggerType } from '../../../types/task';
import TaskStatusChip from './TaskStatusChip';
import TaskTriggerInfo from './TaskTriggerInfo';
import TaskActionInfo from './TaskActionInfo';
import taskService from '../../../services/task-service';
import { 
  taskCardStyles, 
  getTaskCardBorderStyle, 
  dateDisplayStyles,
  combineStyles 
} from '../../styles/TaskStyles';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, success: boolean) => void;
  onEdit?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

/**
 * 任务卡片组件
 * 显示任务详细信息，支持折叠/展开，提供基本操作按钮
 */
const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onStatusChange, 
  onEdit, 
  onDelete 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 切换展开/折叠状态
  const handleExpandClick = () => {
    setExpanded(!expanded);
  };
  
  // 处理启用/禁用任务
  const handleToggleStatus = async () => {
    if (loading) return;
    
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };
  
  // 处理编辑任务
  const handleEdit = () => {
    onEdit?.(task.id);
  };
  
  // 处理删除任务
  const handleDelete = () => {
    onDelete?.(task.id);
  };
  
  // 格式化日期/时间
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    if (task.status !== TaskStatus.ENABLED) {
      return null;
    }
    
    if (task.trigger.type === TriggerType.TIME && 'nextTrigger' in task.trigger && task.trigger.nextTrigger) {
      return task.trigger.nextTrigger;
    }
    
    return null;
  };
  
  // 生成上次执行结果文本
  const getLastExecutionText = () => {
    const lastExecution = task.history.lastExecution;
    if (!lastExecution) return '从未执行';
    
    const dateStr = formatDate(lastExecution.timestamp);
    const result = lastExecution.success ? '成功' : '失败';
    
    return `${dateStr} - ${result}${lastExecution.error ? `: ${lastExecution.error}` : ''}`;
  };
  
  // 判断任务是否可以启用/禁用
  const canToggleStatus = task.status !== TaskStatus.COMPLETED && 
                          task.status !== TaskStatus.RUNNING;
  
  // 获取下次执行时间显示
  const nextExecutionTime = getNextExecutionTime();

  return (
    <Card 
      variant="outlined"
      sx={combineStyles(taskCardStyles, getTaskCardBorderStyle(task.status))}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
            {task.name}
          </Typography>
          <TaskStatusChip status={task.status} />
        </Box>
        
        {task.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {task.description}
          </Typography>
        )}
        
        <Box sx={{ mt: 1 }}>
          <TaskTriggerInfo trigger={task.trigger} compact />
        </Box>
        
        <Box sx={{ mt: 1 }}>
          <TaskActionInfo action={task.action} compact />
        </Box>
        
        {/* 下次执行时间 */}
        {nextExecutionTime && (
          <Box sx={dateDisplayStyles}>
            <AccessTimeIcon fontSize="inherit" sx={{ mr: 0.5 }} />
            <Tooltip title={`下次执行: ${formatDate(nextExecutionTime)}`}>
              <span>下次执行: {formatRelativeTime(nextExecutionTime)}</span>
            </Tooltip>
          </Box>
        )}
        
        {/* 最后执行时间 */}
        {task.history.lastExecution && (
          <Box sx={dateDisplayStyles}>
            <HistoryIcon fontSize="inherit" sx={{ mr: 0.5 }} />
            <Tooltip title={getLastExecutionText()}>
              <span>
                上次执行: {formatRelativeTime(task.history.lastExecution.timestamp)}
                {!task.history.lastExecution.success && (
                  <Chip 
                    label="失败" 
                    color="error" 
                    size="small" 
                    variant="outlined" 
                    sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
                  />
                )}
              </span>
            </Tooltip>
          </Box>
        )}
      </CardContent>
      
      <CardActions disableSpacing>
        <Tooltip title={task.status === TaskStatus.ENABLED ? '禁用任务' : '启用任务'}>
          <span style={{ display: 'inline-block' }}>
            <IconButton 
              onClick={handleToggleStatus} 
              disabled={!canToggleStatus || loading}
              color={task.status === TaskStatus.ENABLED ? 'primary' : 'default'}
              size="small"
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
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Button
          size="small"
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={handleExpandClick}
          color="primary"
        >
          {expanded ? '收起' : '详情'}
        </Button>
      </CardActions>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <EventIcon fontSize="small" sx={{ mr: 0.5 }} />
            触发条件
          </Typography>
          <Box sx={{ mb: 2, pl: 2 }}>
            <TaskTriggerInfo trigger={task.trigger} />
          </Box>
          
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <PlayArrowIcon fontSize="small" sx={{ mr: 0.5 }} />
            操作
          </Typography>
          <Box sx={{ mb: 2, pl: 2 }}>
            <TaskActionInfo action={task.action} />
          </Box>
          
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <HistoryIcon fontSize="small" sx={{ mr: 0.5 }} />
            执行历史
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2" color="text.secondary">
              上次执行: {getLastExecutionText()}
            </Typography>
            {nextExecutionTime && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                下次执行: {formatDate(nextExecutionTime)}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
              创建时间: {formatDate(task.createdAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.7 }}>
              ID: {task.id}
            </Typography>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default TaskCard; 