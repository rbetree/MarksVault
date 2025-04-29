import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import BackupIcon from '@mui/icons-material/Backup';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CodeIcon from '@mui/icons-material/Code';
import { Action, ActionType } from '../../../types/task';

interface TaskActionInfoProps {
  action: Action;
  compact?: boolean;
}

/**
 * 任务操作信息组件
 * 显示任务的操作类型和详情
 */
const TaskActionInfo: React.FC<TaskActionInfoProps> = ({ action, compact = false }) => {
  // 渲染备份操作信息
  const renderBackupAction = () => {
    if (action.type !== ActionType.BACKUP) return null;
    
    const { target, options } = action;
    
    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <BackupIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            备份到 {target}
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <BackupIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            备份操作
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          目标: {target}
        </Typography>
        {options && options.commitMessage && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
            提交消息: {options.commitMessage}
          </Typography>
        )}
      </Box>
    );
  };
  
  // 渲染整理操作信息
  const renderOrganizeAction = () => {
    if (action.type !== ActionType.ORGANIZE) return null;
    
    const { operations } = action;
    
    // 获取操作类型的显示文本
    const getOperationText = (op: string) => {
      switch (op) {
        case 'move': return '移动';
        case 'delete': return '删除';
        case 'rename': return '重命名';
        case 'validate': return '验证';
        default: return op;
      }
    };
    
    // 简单展示操作数量
    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CleaningServicesIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            整理操作 ({operations.length}项)
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <CleaningServicesIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            整理操作
          </Typography>
        </Box>
        {operations.map((op, index) => (
          <Typography key={index} variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
            {getOperationText(op.operation)} 
            {op.filters?.pattern && ` (匹配: ${op.filters.pattern})`}
            {op.filters?.olderThan && ` (早于: ${op.filters.olderThan}天)`}
            {op.filters?.newerThan && ` (晚于: ${op.filters.newerThan}天)`}
          </Typography>
        ))}
      </Box>
    );
  };
  
  // 渲染自定义操作信息
  const renderCustomAction = () => {
    if (action.type !== ActionType.CUSTOM) return null;
    
    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CodeIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            自定义操作
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <CodeIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            自定义操作
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          {action.description}
        </Typography>
      </Box>
    );
  };

  switch (action.type) {
    case ActionType.BACKUP:
      return renderBackupAction();
    case ActionType.ORGANIZE:
      return renderOrganizeAction();
    case ActionType.CUSTOM:
      return renderCustomAction();
    default:
      return (
        <Typography variant="body2" color="error">
          未知操作类型
        </Typography>
      );
  }
};

export default TaskActionInfo; 