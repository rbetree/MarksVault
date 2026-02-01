import React, { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import SaveIcon from '@mui/icons-material/Save';
import Typography from '@mui/material/Typography';
import Fade from '@mui/material/Fade';

import TaskFormContainer from './TaskFormContainer';
import SelectivePushExecutor from './SelectivePushExecutor';
import BackupRestoreExecutor from './BackupRestoreExecutor';
import { useUrlParams } from '../hooks/useUrlParams';
import { useTaskConfigData } from '../hooks/useTaskConfigData';
import { Task, ActionType, BackupAction } from '../../types/task';
import { taskConfigStyles } from '../styles/taskConfigStyles';

/**
 * 任务配置页面主组件 - Redesigned
 * 整合URL参数解析、数据加载、表单管理和保存逻辑
 */
const TaskConfigPage: React.FC = () => {
  // 解析URL参数
  const { mode, taskId } = useUrlParams();

  // 加载任务数据
  const { taskData, loading, loadError, saving, saveError, clearSaveError, saveTask } =
    useTaskConfigData(mode, taskId);

  // 表单状态
  const [formData, setFormData] = useState<Task | null>(null);
  const [isFormValid, setIsFormValid] = useState<boolean>(false);

  // 当任务数据加载完成时，初始化表单数据
  useEffect(() => {
    if (taskData) {
      setFormData(taskData);
    }
  }, [taskData]);

  /**
   * 处理表单数据变化
   */
  const handleFormChange = (updatedData: Partial<Task>) => {
    setFormData((prev) => (prev ? { ...prev, ...updatedData } : prev));
    if (saveError) {
      clearSaveError();
    }
  };

  /**
   * 处理表单验证状态变化
   */
  const handleValidityChange = (isValid: boolean) => {
    setIsFormValid(isValid);
  };

  /**
   * 处理保存操作
   */
  const handleSave = async () => {
    if (!formData || !isFormValid) {
      return;
    }

    try {
      const result = await saveTask(formData);

      if (result.success && result.taskId) {
        // 将保存结果写入 chrome.storage.local（用于 popup 内展示 toast）；失败时不应阻塞关闭页面
        try {
          await browser.storage.local.set({
            taskConfigResult: {
              success: true,
              taskId: result.taskId,
              mode: mode,
              taskName: formData.name,
              timestamp: Date.now(),
            },
          });
        } catch (error) {
          console.warn('写入 taskConfigResult 失败:', error);
        }

        // 关闭当前页面
        window.close();
      } else {
        // 保存失败，错误信息已经在useTaskConfigData中处理
        console.error('保存任务失败:', result.error);
      }
    } catch (err) {
      console.error('保存任务时发生错误:', err);
    }
  };

  /**
   * 处理取消操作
   */
  const handleCancel = () => {
    window.close();
  };

  /**
   * 处理执行完成
   */
  const handleExecuteComplete = () => {
    window.close();
  };

  // 加载中状态
  if (loading) {
    return (
      <Box sx={taskConfigStyles.pageContainer}>
        <Box sx={taskConfigStyles.loadingContainer}>
          <CircularProgress size={48} thickness={4} sx={{ color: 'primary.main' }} />
        </Box>
      </Box>
    );
  }

  // 错误状态
  if (loadError) {
    return (
      <Box sx={taskConfigStyles.pageContainer}>
        <Box sx={taskConfigStyles.errorContainer}>
          <Alert severity="error" variant="filled" sx={{ maxWidth: 600, width: '100%', borderRadius: 2 }}>
            {loadError}
          </Alert>
          <Button variant="outlined" color="inherit" onClick={() => window.location.reload()}>
            重试
          </Button>
        </Box>
      </Box>
    );
  }

  // 数据未加载完成
  if (!formData) {
    return (
      <Box sx={taskConfigStyles.pageContainer}>
        <Box sx={taskConfigStyles.loadingContainer}>
          <CircularProgress size={48} thickness={4} />
        </Box>
      </Box>
    );
  }

  // 执行模式：渲染选择性推送执行器
  if (mode === 'execute') {
    // 选择性推送任务：交互式执行
    if (formData.action.type === ActionType.SELECTIVE_PUSH) {
      return (
        <Box sx={taskConfigStyles.pageContainer}>
          <SelectivePushExecutor
            task={formData}
            onComplete={handleExecuteComplete}
            onCancel={handleCancel}
          />
        </Box>
      );
    }

    // 恢复书签任务（高风险）：交互式执行 + 二次确认
    if (
      formData.action.type === ActionType.BACKUP &&
      (formData.action as BackupAction).operation === 'restore'
    ) {
      return (
        <Box sx={taskConfigStyles.pageContainer}>
          <BackupRestoreExecutor
            task={formData}
            onComplete={handleExecuteComplete}
            onCancel={handleCancel}
          />
        </Box>
      );
    }

    return (
      <Box sx={taskConfigStyles.pageContainer}>
        <Box sx={taskConfigStyles.errorContainer}>
          <Alert severity="error" sx={{ maxWidth: 600 }}>
            此任务不支持在执行模式下打开
          </Alert>
        </Box>
      </Box>
    );
  }

  // 创建/编辑模式：渲染任务表单
  const title = mode === 'create' ? '新建任务' : '编辑任务';
  const subtitle = formData.name || '未命名任务';

  return (
    <Box sx={taskConfigStyles.root}>
      {/* Premium Header */}
      <Box sx={taskConfigStyles.headerOuter}>
        <Box sx={taskConfigStyles.headerInner}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {subtitle}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="text"
              onClick={handleCancel}
              disabled={saving}
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                px: 3,
                borderRadius: 20,
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: 'text.primary',
                },
              }}
            >
              取消
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={!isFormValid || saving}
              sx={{
                px: 4,
                py: 1,
                borderRadius: 20,
                fontWeight: 600,
                boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(0,118,255,0.23)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)',
                  boxShadow: 'none',
                }
              }}
            >
              {saving ? '保存中...' : '保存更改'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Content Area */}
      <Box sx={taskConfigStyles.contentArea}>
        <Fade in={true} timeout={500}>
          <Box sx={taskConfigStyles.maxWidthContainer}>
            {saveError && (
              <Alert 
                severity="error" 
                variant="filled"
                sx={{ mb: 4, borderRadius: 2 }}
                onClose={clearSaveError}
              >
                {saveError}
              </Alert>
            )}

            <TaskFormContainer
              taskData={formData}
              onChange={handleFormChange}
              onValidityChange={handleValidityChange}
            />
          </Box>
        </Fade>
      </Box>
    </Box>
  );
};

export default TaskConfigPage;
