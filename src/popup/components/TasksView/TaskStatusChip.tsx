import React from 'react';
import Chip from '@mui/material/Chip';
import { TaskStatus } from '../../../types/task';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import SyncIcon from '@mui/icons-material/Sync';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface TaskStatusChipProps {
  status: TaskStatus;
  size?: 'small' | 'medium';
}

/**
 * 任务状态标签组件
 * 用于显示任务的当前状态，不同状态使用不同的颜色和图标
 */
const TaskStatusChip: React.FC<TaskStatusChipProps> = ({ status, size = 'small' }) => {
  // 根据状态定义标签配置
  const getStatusConfig = () => {
    switch (status) {
      case TaskStatus.ENABLED:
        return {
          label: '已启用',
          color: 'success' as const,
          icon: <CheckCircleIcon />
        };
      case TaskStatus.DISABLED:
        return {
          label: '已禁用',
          color: 'default' as const,
          icon: <PauseCircleOutlineIcon />
        };
      case TaskStatus.RUNNING:
        return {
          label: '运行中',
          color: 'primary' as const,
          icon: <SyncIcon />
        };
      case TaskStatus.COMPLETED:
        return {
          label: '已完成',
          color: 'secondary' as const,
          icon: <DoneAllIcon />
        };
      case TaskStatus.FAILED:
        return {
          label: '失败',
          color: 'error' as const,
          icon: <ErrorOutlineIcon />
        };
      default:
        return {
          label: '未知',
          color: 'default' as const,
          icon: <ErrorOutlineIcon />
        };
    }
  };

  const { label, color, icon } = getStatusConfig();

  return (
    <Chip
      label={label}
      color={color}
      icon={icon}
      size={size}
      variant="filled"
      sx={{ 
        fontWeight: 500,
        fontSize: '10px',
        height: size === 'small' ? '20px' : '24px',
        '& .MuiChip-icon': {
          fontSize: size === 'small' ? 14 : 18,
          marginLeft: '2px'
        },
        '& .MuiChip-label': {
          padding: '0 6px',
          paddingLeft: '4px'
        }
      }}
    />
  );
};

export default TaskStatusChip; 