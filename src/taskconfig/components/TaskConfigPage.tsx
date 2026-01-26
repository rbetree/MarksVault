import React, { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { Box, CircularProgress, Alert } from '@mui/material';
import TaskConfigHeader from './TaskConfigHeader';
import TaskFormContainer from './TaskFormContainer';
import SelectivePushExecutor from './SelectivePushExecutor';
import { useUrlParams } from '../hooks/useUrlParams';
import { useTaskConfigData } from '../hooks/useTaskConfigData';
import { Task, ActionType } from '../../types/task';
import { taskConfigStyles } from '../styles/taskConfigStyles';

/**
 * 任务配置页面主组件
 * 整合URL参数解析、数据加载、表单管理和保存逻辑
 */
const TaskConfigPage: React.FC = () => {
  // 解析URL参数
  const { mode, taskId } = useUrlParams();

  // 加载任务数据
  const { taskData, loading, error, saving, saveTask } = useTaskConfigData(mode, taskId);

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
    if (formData) {
      setFormData({
        ...formData,
        ...updatedData,
      });
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
        // 将保存结果写入chrome.storage.local
        await browser.storage.local.set({
          taskConfigResult: {
            success: true,
            taskId: result.taskId,
            mode: mode,
            timestamp: Date.now(),
          },
        });

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
          <CircularProgress size={48} />
        </Box>
      </Box>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Box sx={taskConfigStyles.pageContainer}>
        <Box sx={taskConfigStyles.errorContainer}>
          <Alert severity="error" sx={{ maxWidth: 600 }}>
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  // 数据未加载完成
  if (!formData) {
    return (
      <Box sx={taskConfigStyles.pageContainer}>
        <Box sx={taskConfigStyles.loadingContainer}>
          <CircularProgress size={48} />
        </Box>
      </Box>
    );
  }

  // 执行模式：渲染选择性推送执行器
  if (mode === 'execute') {
    // 验证任务类型是否为SELECTIVE_PUSH
    if (formData.action.type !== ActionType.SELECTIVE_PUSH) {
      return (
        <Box sx={taskConfigStyles.pageContainer}>
          <Box sx={taskConfigStyles.errorContainer}>
            <Alert severity="error" sx={{ maxWidth: 600 }}>
              此任务不是选择性推送任务，无法在执行模式下打开
            </Alert>
          </Box>
        </Box>
      );
    }

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

  // 创建/编辑模式：渲染任务表单
  return (
    <Box sx={taskConfigStyles.pageContainer}>
      {/* 头部 */}
      <TaskConfigHeader
        mode={mode}
        taskName={formData.name}
        isFormValid={isFormValid}
        isSaving={saving}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {/* 内容区域 */}
      <Box sx={taskConfigStyles.contentArea}>
        <TaskFormContainer
          taskData={formData}
          onChange={handleFormChange}
          onValidityChange={handleValidityChange}
        />
      </Box>
    </Box>
  );
};

export default TaskConfigPage;
