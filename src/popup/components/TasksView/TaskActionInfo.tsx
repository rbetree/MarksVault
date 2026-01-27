import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import BackupIcon from '@mui/icons-material/Backup';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import UploadIcon from '@mui/icons-material/Upload';
import { Action, ActionType, BackupAction } from '../../../types/task';

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
    
    const backupAction = action as BackupAction;
    const { target, options } = backupAction;
    const operationLabel = backupAction.operation === 'restore' ? '恢复' : '备份';
    
    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <BackupIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            {operationLabel} {operationLabel === '恢复' ? '自' : '到'} {target}
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <BackupIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            备份/恢复
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          操作: {operationLabel}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          目标: {target}
        </Typography>
        {backupAction.operation === 'restore' ? (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
            备份文件: {options?.backupFilePath ? options.backupFilePath : '最新备份'}
          </Typography>
        ) : options && options.commitMessage ? (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
            提交消息: {options.commitMessage}
          </Typography>
        ) : null}
      </Box>
    );
  };
  
  // 渲染推送操作信息
  const renderPushAction = () => {
    if (action.type !== ActionType.PUSH) return null;
    
    const { target, options } = action;
    
    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <UploadIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            推送书签到 {target}/{options.repoName}
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <UploadIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            推送书签
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          目标: {target}/{options.repoName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          路径: {options.folderPath}
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
    
    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CleaningServicesIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            {operations.length}个整理操作
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <CleaningServicesIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            书签整理
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          操作数量: {operations.length}
          </Typography>
      </Box>
    );
  };

  return (
    <>
      {renderBackupAction()}
      {renderPushAction()}
      {renderOrganizeAction()}
    </>
  );
};

export default TaskActionInfo; 
