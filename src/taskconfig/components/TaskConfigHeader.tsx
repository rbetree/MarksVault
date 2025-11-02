import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { TaskConfigMode } from '../hooks/useUrlParams';

interface TaskConfigHeaderProps {
  mode: TaskConfigMode;
  taskName?: string;
  isFormValid: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * 任务配置页面头部组件
 * 显示标题和操作按钮
 */
const TaskConfigHeader: React.FC<TaskConfigHeaderProps> = ({
  mode,
  taskName,
  isFormValid,
  isSaving,
  onSave,
  onCancel,
}) => {
  const title = mode === 'create' ? '新建任务' : `编辑任务：${taskName || ''}`;

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: '64px' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<CloseIcon />}
            onClick={onCancel}
            disabled={isSaving}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.5)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.8)',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            取消
          </Button>

          <Button
            variant="contained"
            color="secondary"
            startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={onSave}
            disabled={!isFormValid || isSaving}
            sx={{
              bgcolor: 'secondary.main',
              '&:hover': {
                bgcolor: 'secondary.dark',
              },
            }}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TaskConfigHeader;