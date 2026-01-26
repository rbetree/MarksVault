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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { Task, TaskStatus, TriggerType, TaskExecutionResult, EventType, ActionType } from '../../../types/task';
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
import { formatDate, formatRelativeTime, getExecutionResultText } from '../../../utils/date-utils';

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
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  
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
    
    // 如果是选择性推送任务，打开任务配置页面（执行模式）
    if (task.action.type === ActionType.SELECTIVE_PUSH) {
      const url = chrome.runtime.getURL(`taskconfig.html?mode=execute&taskId=${task.id}`);
      chrome.tabs.create({ url });
      return;
    }
    
    // 其他类型的任务，直接执行
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
  
  // 生成上次执行结果文本
  const getLastExecutionText = () => {
    const lastExecution = task.history.lastExecution;
    if (!lastExecution) return '从未执行';
    
    return getExecutionResultText(
      lastExecution.timestamp,
      lastExecution.success,
      lastExecution.error
    );
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
  
  // 判断是否为手动任务
  const isManualTask = task.trigger.type === TriggerType.MANUAL;
  
  // 判断任务是否可以启用/禁用（手动任务不需要此功能）
  const canToggleStatus = !isManualTask &&
                          task.status !== TaskStatus.COMPLETED &&
                          task.status !== TaskStatus.RUNNING;
  
  // 判断任务是否可以手动执行
  const canExecuteTask = task.status !== TaskStatus.RUNNING &&
                         task.status !== TaskStatus.DISABLED;
  
  // 获取下次执行时间显示
  const getNextExecutionTime = () => {
    // 事件触发器没有下次执行时间概念
    return null;
  };
  
  const nextExecutionTime = getNextExecutionTime();

  // 创建自定义样式对象，去除下边距
  const noBottomPaddingStyles = {
    pb: 0,
    '&.MuiCardContent-root:last-child': {
      pb: 0
    }
  };

  // 创建一个更紧凑的日期显示样式
  const compactDateDisplayStyles = combineStyles(dateDisplayStyles, { mt: 0.2, mb: 0 });

  // 创建紧凑的卡片内容样式
  const compactCardContentStyles = { pt: 0.5, px: 1.2, ...noBottomPaddingStyles };
  
  // 创建紧凑的展开内容样式
  const compactExpandedContentStyles = { pt: 0.6, px: 0.6, ...noBottomPaddingStyles };

  // 执行历史展开/折叠切换
  const handleHistoryItemClick = (timestamp: number) => {
    // 如果已展开且点击相同项，则折叠，否则展开点击项
    setExpandedHistory(expandedHistory === timestamp.toString() ? null : timestamp.toString());
  };

  // 切换历史记录的展开/收起状态
  const handleToggleHistory = () => {
    setHistoryExpanded(!historyExpanded);
  };

  // 格式化执行持续时间
  const formatDuration = (duration?: number): string => {
    if (duration === undefined) return '未知';
    if (duration < 1000) return `${duration}毫秒`;
    return `${(duration / 1000).toFixed(1)}秒`;
  };

  // 渲染任务执行历史记录
  const renderTaskHistory = () => {
    const { executions } = task.history;
    
    // 如果没有执行记录，显示空提示
    if (!executions || executions.length === 0) {
      return (
        <Box sx={{ 
          color: 'text.disabled',
          fontSize: '9px',
          fontStyle: 'italic',
          textAlign: 'center',
          py: 0.5
        }}>
          暂无执行记录
        </Box>
      );
    }
    
    // 根据历史展开状态决定显示多少条记录
    const visibleExecutions = historyExpanded ? 
      executions.slice(0, 5) : 
      executions.slice(0, 1);
    
    return (
      <List disablePadding>
        {visibleExecutions.map((execution, index) => {
          const isExpanded = expandedHistory === execution.timestamp.toString();
          const executionTime = new Date(execution.timestamp);
          const formattedTime = executionTime.toLocaleString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          
          return (
            <React.Fragment key={execution.timestamp}>
              <ListItem 
                disablePadding
                sx={{
                  py: 0.5,
                  px: 0.5,
                  borderRadius: 1,
                  mb: 0.5,
                  fontSize: '10px',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  },
                  color: execution.success ? 'success.main' : 'error.main'
                }}
                onClick={() => handleHistoryItemClick(execution.timestamp)}
                button
              >
                <ListItemIcon sx={{ minWidth: 24 }}>
                  {execution.success ? 
                    <CheckCircleOutlineIcon sx={{ fontSize: 14 }} /> : 
                    <ErrorOutlineIcon sx={{ fontSize: 14 }} />
                  }
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontSize: '10px' }}>
                        {formattedTime}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '10px' }}>
                        {execution.success ? '成功' : '失败'} 
                        {execution.duration && ` (${formatDuration(execution.duration)})`}
                      </Typography>
                    </Box>
                  }
                  disableTypography
                />
                {(execution.details || execution.error) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                    {isExpanded ? 
                      <KeyboardArrowUpIcon sx={{ fontSize: 14 }} /> : 
                      <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
                    }
                  </Box>
                )}
              </ListItem>
              
              {/* 展开的详情内容 */}
              {(execution.details || execution.error) && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{
                    px: 1,
                    py: 0.5,
                    fontSize: '9px',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: 1,
                    mt: 0.5
                  }}>
                    {execution.details && (
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {execution.details}
                      </Typography>
                    )}
                    {execution.error && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'error.main',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}
                      >
                        {execution.error}
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              )}
            </React.Fragment>
          );
        })}
      </List>
    );
  };

  return (
    <Card 
      variant="outlined"
      sx={combineStyles(taskCardStyles, getTaskCardBorderStyle(task.status))}
    >
      <CardContent sx={compactCardContentStyles}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.3 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 500, fontSize: '13px' }}>
            {task.name}
          </Typography>
          <TaskStatusChip status={task.status} />
        </Box>
        
        {task.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.3, fontSize: '10px' }}>
            {task.description}
          </Typography>
        )}
        
        {/* 错误信息提示 */}
        {shouldShowErrorInfo() && (
          <Alert 
            severity="error" 
            icon={<ErrorOutlineIcon fontSize="inherit" />}
            sx={{ 
              py: 0.2, 
              px: 0.4, 
              mb: 0.5, 
              '& .MuiAlert-message': { 
                fontSize: '10px', 
                padding: 0 
              } 
            }}
          >
            {task.history.lastExecution?.error}
            {isCredentialError() && (
              <Box component="span" sx={{ display: 'block', mt: 0.2, fontSize: '9px' }}>
                请到同步页面配置GitHub凭据
              </Box>
            )}
          </Alert>
        )}
        
        <Box sx={{ mt: 0.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <TaskTriggerInfo trigger={task.trigger} compact />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* 手动任务：显示更显眼的执行按钮 */}
            {isManualTask ? (
              <Tooltip title="立即执行">
                <span style={{ display: 'inline-block' }}>
                  <IconButton
                    onClick={handleExecuteTask}
                    disabled={!canExecuteTask || executing}
                    color="primary"
                    size="small"
                    sx={{
                      padding: 0.4,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '&.Mui-disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled',
                      }
                    }}
                  >
                    {executing ?
                      <CircularProgress size={14} sx={{ color: 'inherit' }} /> :
                      <PlayArrowIcon sx={{ fontSize: '14px' }} />
                    }
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <>
                {/* 自动任务：显示手动执行和启用/禁用按钮 */}
                <Tooltip title="立即执行">
                  <span style={{ display: 'inline-block' }}>
                    <IconButton
                      onClick={handleExecuteTask}
                      disabled={!canExecuteTask || executing}
                      color="primary"
                      size="small"
                      sx={{ padding: 0.4 }}
                    >
                      {executing ?
                        <CircularProgress size={14} /> :
                        <RefreshIcon sx={{ fontSize: '14px' }} />
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
                      sx={{ padding: 0.4 }}
                    >
                      {task.status === TaskStatus.ENABLED ?
                      <PauseIcon sx={{ fontSize: '14px' }} /> :
                      <PlayArrowIcon sx={{ fontSize: '14px' }} />}
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
            
            <Tooltip title="编辑任务">
              <IconButton onClick={handleEdit} size="small" sx={{ padding: 0.4 }}>
                <EditIcon sx={{ fontSize: '14px' }} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="删除任务">
              <IconButton onClick={handleDelete} size="small" sx={{ padding: 0.4 }}>
                <DeleteIcon sx={{ fontSize: '14px' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        <Box sx={{ mt: 0.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <TaskActionInfo action={task.action} compact />
          </Box>
          <Button
            size="small"
            endIcon={expanded ? <ExpandLessIcon sx={{ fontSize: '12px' }} /> : <ExpandMoreIcon sx={{ fontSize: '12px' }} />}
            onClick={handleExpandClick}
            color="primary"
            sx={{ py: 0.1, px: 0.5, minWidth: 'auto', fontSize: '10px' }}
          >
            {expanded ? '收起' : '详情'}
          </Button>
        </Box>
        
        {/* 最后执行时间 */}
        {task.history.lastExecution && (
          <Box sx={compactDateDisplayStyles}>
            <HistoryIcon fontSize="inherit" sx={{ mr: 0.3, fontSize: '12px' }} />
            <Tooltip title={getLastExecutionText()}>
              <span style={{ fontSize: '10px' }}>
                上次执行: {formatRelativeTime(task.history.lastExecution.timestamp)}
                {!task.history.lastExecution.success && (
                  <Chip 
                    label="失败" 
                    color="error" 
                    size="small" 
                    variant="outlined" 
                    sx={{ ml: 0.8, height: 14, fontSize: '0.55rem' }}
                  />
                )}
              </span>
            </Tooltip>
          </Box>
        )}
      </CardContent>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider variant="fullWidth" sx={{ mt: 0.5, opacity: 0.4 }} />
        <CardContent sx={compactExpandedContentStyles}>
          <Box>
            {/* 显示任务触发器详情 */}
            <Typography variant="body2" sx={{ fontSize: '10px', fontWeight: 'medium', mb: 0.3 }}>
              触发器:
            </Typography>
            <Box sx={{ pl: 1 }}>
              <TaskTriggerInfo trigger={task.trigger} compact={false} />
            </Box>
            
            {/* 显示任务操作详情 */}
            <Typography variant="body2" sx={{ fontSize: '10px', fontWeight: 'medium', mt: 1, mb: 0.3 }}>
              操作:
            </Typography>
            <Box sx={{ pl: 1 }}>
              <TaskActionInfo action={task.action} />
            </Box>
            
            {/* 任务执行历史 */}
            <Box sx={{ mt: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontSize: '10px', 
                  fontWeight: 'medium', 
                  mb: 0.3,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onClick={handleToggleHistory}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  执行历史:
                </Box>
                {historyExpanded ? 
                  <KeyboardArrowUpIcon sx={{ fontSize: 14 }} /> : 
                  <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />
                }
              </Typography>
              <Box sx={{ pl: 1 }}>
                {renderTaskHistory()}
              </Box>
            </Box>
            
            {/* 任务元数据 */}
            <Box sx={combineStyles(compactDateDisplayStyles, { mt: 1 })}>
              <Typography variant="body2" sx={{ fontSize: '9px', color: 'text.secondary' }}>
                创建于: {formatDate(task.createdAt)}
                {task.createdAt !== task.updatedAt && ` • 更新于: ${formatDate(task.updatedAt)}`}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default TaskCard; 
