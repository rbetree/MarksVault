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
import Tooltip from '@mui/material/Tooltip';
import { Task, TaskStatus } from '../../../types/task';
import TaskStatusChip from './TaskStatusChip';
import TaskTriggerInfo from './TaskTriggerInfo';
import TaskActionInfo from './TaskActionInfo';
import taskService from '../../../services/task-service';

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
  
  // 格式化创建时间
  const formatCreatedTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };
  
  // 生成上次执行结果文本
  const getLastExecutionText = () => {
    const lastExecution = task.history.lastExecution;
    if (!lastExecution) return '从未执行';
    
    const dateStr = new Date(lastExecution.timestamp).toLocaleString('zh-CN');
    const result = lastExecution.success ? '成功' : '失败';
    
    return `${dateStr} - ${result}${lastExecution.error ? `: ${lastExecution.error}` : ''}`;
  };
  
  // 判断任务是否可以启用/禁用
  const canToggleStatus = task.status !== TaskStatus.COMPLETED && 
                          task.status !== TaskStatus.RUNNING;

  return (
    <Card 
      variant="outlined"
      sx={{ 
        mb: 2,
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
            {task.name}
          </Typography>
          <TaskStatusChip status={task.status} />
        </Box>
        
        {task.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {task.description}
          </Typography>
        )}
        
        <Box sx={{ mt: 1 }}>
          <TaskTriggerInfo trigger={task.trigger} compact />
        </Box>
        
        <Box sx={{ mt: 1 }}>
          <TaskActionInfo action={task.action} compact />
        </Box>
      </CardContent>
      
      <CardActions disableSpacing>
        <Tooltip title={task.status === TaskStatus.ENABLED ? '禁用任务' : '启用任务'}>
          <span>
            <IconButton 
              onClick={handleToggleStatus} 
              disabled={!canToggleStatus || loading}
              color={task.status === TaskStatus.ENABLED ? 'primary' : 'default'}
            >
              {task.status === TaskStatus.ENABLED ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </span>
        </Tooltip>
        
        <Tooltip title="编辑">
          <IconButton onClick={handleEdit}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="删除">
          <IconButton onClick={handleDelete}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Button
          size="small"
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={handleExpandClick}
        >
          {expanded ? '收起' : '详情'}
        </Button>
      </CardActions>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            触发条件
          </Typography>
          <Box sx={{ mb: 2 }}>
            <TaskTriggerInfo trigger={task.trigger} />
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>
            操作
          </Typography>
          <Box sx={{ mb: 2 }}>
            <TaskActionInfo action={task.action} />
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>
            执行历史
          </Typography>
          <Typography variant="body2" color="text.secondary">
            上次执行: {getLastExecutionText()}
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              创建时间: {formatCreatedTime(task.createdAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {task.id}
            </Typography>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default TaskCard; 