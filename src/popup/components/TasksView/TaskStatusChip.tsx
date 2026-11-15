import React from 'react';
import Chip from '@mui/material/Chip';
import { TaskStatus } from '../../../types/task';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import SyncIcon from '@mui/icons-material/Sync';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface TaskStatusChipProps {
  status: TaskStatus;
  size?: 'small' | 'medium';
}

/**
 * 任务状态标签组件
 * 只展示稳定的启用状态；执行结果（成功、失败、中断、结果不确定）
 * 由执行历史单独展示，不再混入启用状态
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
          icon: <SyncIcon sx={{ animation: 'mv-task-spin 1s linear infinite' }} />
        };
      // 旧版本用执行结果覆盖启用状态；读取时已迁移为 ENABLED，
      // 此处保留兜底显示，避免历史 UI 状态显示为失败
      case TaskStatus.COMPLETED:
      case TaskStatus.FAILED:
        return {
          label: '已启用',
          color: 'success' as const,
          icon: <CheckCircleIcon />
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
        '@keyframes mv-task-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
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
