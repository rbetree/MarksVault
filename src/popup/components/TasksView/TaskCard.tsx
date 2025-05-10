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
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { Task, TaskStatus, TriggerType } from '../../../types/task';
import TaskStatusChip from './TaskStatusChip';
import TaskTriggerInfo from './TaskTriggerInfo';
import TaskActionInfo from './TaskActionInfo';
import taskService from '../../../services/task-service';
import taskExecutor from '../../../services/task-executor';
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
  const [executing, setExecuting] = useState(false);
  
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
  
  // 手动执行任务
  const handleExecuteTask = async () => {
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
    // 事件触发器没有下次执行时间概念
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
  
  // 判断是否显示错误信息
  const shouldShowErrorInfo = () => {
    return task.status === TaskStatus.FAILED && 
           task.history.lastExecution && 
           !task.history.lastExecution.success && 
           task.history.lastExecution.error;
  };
  
  // 判断错误是否与GitHub凭据相关
  const isCredentialError = () => {
    if (!task.history.lastExecution || !task.history.lastExecution.error) return false;
    
    const errorMessage = task.history.lastExecution.error;
    return errorMessage.includes('GitHub凭据') || 
           errorMessage.includes('未找到GitHub凭据') || 
           errorMessage.includes('凭据无效');
  };
  
  // 判断任务是否可以启用/禁用
  const canToggleStatus = task.status !== TaskStatus.COMPLETED && 
                          task.status !== TaskStatus.RUNNING;
  
  // 判断任务是否可以手动执行
  const canExecuteTask = task.status !== TaskStatus.RUNNING && 
                         task.status !== TaskStatus.DISABLED;
  
  // 获取下次执行时间显示
  const nextExecutionTime = getNextExecutionTime();

  // 创建一个更紧凑的日期显示样式
  const compactDateDisplayStyles = combineStyles(dateDisplayStyles, { mt: 0.4 });

  return (
    <Card 
      variant="outlined"
      sx={combineStyles(taskCardStyles, getTaskCardBorderStyle(task.status))}
    >
      <CardContent sx={{ pb: 0.25, pt: 0.75, px: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 500, fontSize: '14px' }}>
            {task.name}
          </Typography>
          <TaskStatusChip status={task.status} />
        </Box>
        
        {task.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '11px' }}>
            {task.description}
          </Typography>
        )}
        
        {/* 错误信息提示 */}
        {shouldShowErrorInfo() && (
          <Alert 
            severity="error" 
            icon={<ErrorOutlineIcon fontSize="inherit" />}
            sx={{ 
              py: 0.25, 
              px: 0.5, 
              mb: 0.75, 
              '& .MuiAlert-message': { 
                fontSize: '11px', 
                padding: 0 
              } 
            }}
          >
            {task.history.lastExecution?.error}
            {isCredentialError() && (
              <Box component="span" sx={{ display: 'block', mt: 0.25, fontSize: '10px' }}>
                请到同步页面配置GitHub凭据
              </Box>
            )}
          </Alert>
        )}
        
        <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <TaskTriggerInfo trigger={task.trigger} compact />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* 手动执行按钮 */}
            <Tooltip title="立即执行">
              <span style={{ display: 'inline-block' }}>
                <IconButton 
                  onClick={handleExecuteTask} 
                  disabled={!canExecuteTask || executing}
                  color="primary"
                  size="small"
                  sx={{ padding: 0.5 }}
                >
                  {executing ? 
                    <CircularProgress size={16} /> : 
                    <RefreshIcon fontSize="small" />
                  }
                </IconButton>
              </span>
            </Tooltip>
            
            <Tooltip title={task.status === TaskStatus.ENABLED ? '禁用任务' : '启用任务'}>
              <span style={{ display: 'inline-block' }}>
                <IconButton 
                  onClick={handleToggleStatus} 
                  disabled={!canToggleStatus || loading}
                  color={task.status === TaskStatus.ENABLED ? 'primary' : 'default'}
                  size="small"
                  sx={{ padding: 0.5 }}
                >
                  {task.status === TaskStatus.ENABLED ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            
            <Tooltip title="编辑任务">
              <IconButton onClick={handleEdit} size="small" sx={{ padding: 0.5 }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="删除任务">
              <IconButton onClick={handleDelete} size="small" sx={{ padding: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <TaskActionInfo action={task.action} compact />
          </Box>
          <Button
            size="small"
            endIcon={expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            onClick={handleExpandClick}
            color="primary"
            sx={{ py: 0.25, px: 0.75, minWidth: 'auto', fontSize: '11px' }}
          >
            {expanded ? '收起' : '详情'}
          </Button>
        </Box>
        
        {/* 最后执行时间 */}
        {task.history.lastExecution && (
          <Box sx={compactDateDisplayStyles}>
            <HistoryIcon fontSize="inherit" sx={{ mr: 0.5, fontSize: '14px' }} />
            <Tooltip title={getLastExecutionText()}>
              <span>
                上次执行: {formatRelativeTime(task.history.lastExecution.timestamp)}
                {!task.history.lastExecution.success && (
                  <Chip 
                    label="失败" 
                    color="error" 
                    size="small" 
                    variant="outlined" 
                    sx={{ ml: 1, height: 16, fontSize: '0.6rem' }}
                  />
                )}
              </span>
            </Tooltip>
          </Box>
        )}
      </CardContent>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent sx={{ p: 0.75 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
            <EventIcon fontSize="small" sx={{ mr: 0.5, fontSize: '14px' }} />
            触发条件
          </Typography>
          <Box sx={{ mb: 1, pl: 1.5 }}>
            <TaskTriggerInfo trigger={task.trigger} />
          </Box>
          
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
            <PlayArrowIcon fontSize="small" sx={{ mr: 0.5, fontSize: '14px' }} />
            操作
          </Typography>
          <Box sx={{ mb: 1, pl: 1.5 }}>
            <TaskActionInfo action={task.action} />
          </Box>
          
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
            <HistoryIcon fontSize="small" sx={{ mr: 0.5, fontSize: '14px' }} />
            执行历史
          </Typography>
          <Box sx={{ pl: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
              上次执行: {getLastExecutionText()}
            </Typography>
            {task.history.lastExecution && task.history.lastExecution.details && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: '11px' }}>
                详情: {task.history.lastExecution.details}
              </Typography>
            )}
            {nextExecutionTime && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '11px' }}>
                下次执行: {formatDate(nextExecutionTime)}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ mt: 1, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
              <InfoOutlinedIcon fontSize="small" sx={{ mr: 0.5, fontSize: '14px' }} />
              创建时间: {formatDate(task.createdAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, opacity: 0.7, fontSize: '10px' }}>
              ID: {task.id}
            </Typography>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default TaskCard; 