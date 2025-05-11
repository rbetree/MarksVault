import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import TaskBasicForm from './TaskBasicForm';
import TaskTriggerForm from './TaskTriggerForm';
import TaskActionForm from './TaskActionForm';
import { Task, createDefaultTask } from '../../../../types/task';
import taskService from '../../../../services/task-service';

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task; // 如果提供，则为编辑模式；否则为创建模式
  onTaskSaved: (taskId: string, isNew: boolean) => void;
  disableRestoreFocus?: boolean;
  disableEnforceFocus?: boolean;
  disableAutoFocus?: boolean;
}

/**
 * 任务创建/编辑对话框组件
 * 使用紧凑布局展示任务的各个配置部分
 */
const TaskDialog: React.FC<TaskDialogProps> = ({
  open,
  onClose,
  task,
  onTaskSaved,
  disableRestoreFocus,
  disableEnforceFocus,
  disableAutoFocus
}) => {
  // 表单数据状态
  const [formData, setFormData] = useState<Task>(createDefaultTask());
  
  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 表单验证状态
  const [basicValid, setBasicValid] = useState(false);
  const [triggerValid, setTriggerValid] = useState(false);
  const [actionValid, setActionValid] = useState(false);
  
  // 是否为编辑模式
  const isEditMode = !!task;
  
  // 当 task 属性变化时，更新表单数据
  useEffect(() => {
    if (task) {
      setFormData({ ...task });
      // 初始化时也设置验证状态
      setBasicValid(!!task.name.trim()); // 简单示例
      setTriggerValid(true); // 假设 trigger 总是有效
      setActionValid(true); // 假设 action 总是有效
    } else {
      const defaultTask = createDefaultTask();
      setFormData(defaultTask);
      setBasicValid(!!defaultTask.name.trim());
      setTriggerValid(true);
      setActionValid(true);
    }
  }, [task]);
  
  // 当对话框打开时，重置表单状态
  useEffect(() => {
    if (open) {
      setError(null);
      // 如果不是编辑模式，重置验证状态
      if (!isEditMode) {
        const defaultTask = createDefaultTask();
        setBasicValid(!!defaultTask.name.trim());
        setTriggerValid(true);
        setActionValid(true);
      }
    }
  }, [open, isEditMode]);
  
  // 处理基本信息更新
  const handleBasicInfoChange = (updatedBasicInfo: Partial<Task>, isValid: boolean) => {
    setFormData(prev => ({ ...prev, ...updatedBasicInfo }));
    setBasicValid(isValid);
  };
  
  // 处理触发器更新
  const handleTriggerChange = (updatedTrigger: Task['trigger'], isValid: boolean) => {
    setFormData(prev => ({ ...prev, trigger: updatedTrigger }));
    setTriggerValid(isValid);
  };
  
  // 处理操作更新
  const handleActionChange = (updatedAction: Task['action'], isValid: boolean) => {
    setFormData(prev => ({ ...prev, action: updatedAction }));
    setActionValid(isValid);
  };
  
  // 判断整个表单是否有效
  const isFormValid = basicValid && triggerValid && actionValid;
  
  // 处理保存任务
  const handleSave = async () => {
    if (!isFormValid) {
      setError('请检查表单信息，确保填写完整且有效');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    // 添加保存超时处理
    const saveTimeout = setTimeout(() => {
      if (isSaving) {
        console.warn('任务保存操作超时');
        setIsSaving(false);
        setError('保存任务超时，请重试。如果问题持续存在，请刷新页面后再试。');
      }
    }, 10000); // 10秒超时
    
    try {
      let result;
      
      if (isEditMode) {
        // 更新现有任务
        result = await taskService.updateTask(formData.id, formData);
      } else {
        // 创建新任务
        result = await taskService.createTask(formData);
      }
      
      if (result.success) {
        const savedTask = result.data as Task;
        onTaskSaved(savedTask.id, !isEditMode);
        onClose();
      } else {
        setError(`保存任务失败: ${result.error}`);
      }
    } catch (err) {
      console.error('保存任务时出错:', err);
      setError('保存任务时发生错误');
    } finally {
      clearTimeout(saveTimeout); // 清除超时定时器
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog 
      open={open}
      onClose={() => !isSaving && onClose()}
      maxWidth="md"
      PaperProps={{
        sx: {
          width: '600px',
          maxHeight: '80vh',
          height: 'auto'
        }
      }}
      disableRestoreFocus={disableRestoreFocus}
      disableEnforceFocus={disableEnforceFocus}
      disableAutoFocus={disableAutoFocus}
    >
      <DialogTitle sx={{ textAlign: 'center', py: 1.5 }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 'medium' }}>
          {isEditMode ? '编辑任务' : '创建新任务'}
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ px: 2.5, py: 2, height: '450px', overflowY: 'auto' }}>
        {error && (
          <Box sx={{ mb: 1.5, color: 'error.main', fontSize: '0.875rem' }}>
            {error}
          </Box>
        )}
        
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <TaskBasicForm 
              taskData={formData}
              onChange={handleBasicInfoChange}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TaskTriggerForm 
              trigger={formData.trigger}
              onChange={handleTriggerChange}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TaskActionForm 
              action={formData.action}
              onChange={handleActionChange}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: 'space-between' }}>
        <Button 
          onClick={onClose} 
          color="inherit"
          disabled={isSaving}
          size="small"
        >
          取消
        </Button>
        
        <Button 
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={isSaving || !isFormValid}
          startIcon={isSaving && <CircularProgress size={16} color="inherit" />}
          size="small"
        >
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaskDialog; 