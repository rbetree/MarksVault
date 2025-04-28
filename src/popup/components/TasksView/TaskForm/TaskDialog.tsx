import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TaskBasicForm from './TaskBasicForm';
import TaskTriggerForm from './TaskTriggerForm';
import TaskActionForm from './TaskActionForm';
import { Task, createDefaultTask } from '../../../../types/task';
import taskService from '../../../../services/task-service';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`task-form-tabpanel-${index}`}
      aria-labelledby={`task-form-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task; // 如果提供，则为编辑模式；否则为创建模式
  onTaskSaved: (taskId: string, isNew: boolean) => void;
}

/**
 * 任务创建/编辑对话框组件
 * 使用标签页分组展示任务的各个配置部分
 */
const TaskDialog: React.FC<TaskDialogProps> = ({
  open,
  onClose,
  task,
  onTaskSaved
}) => {
  // 当前激活的标签页索引
  const [tabIndex, setTabIndex] = useState(0);
  
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
      setTabIndex(0);
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
  
  // 处理标签页切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };
  
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
      setError('请检查所有选项卡，确保信息填写完整且有效');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
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
      setIsSaving(false);
    }
  };
  
  // 下一步按钮处理程序
  const handleNext = () => {
    setTabIndex(prev => Math.min(prev + 1, 2));
  };
  
  // 上一步按钮处理程序
  const handlePrev = () => {
    setTabIndex(prev => Math.max(prev - 1, 0));
  };
  
  return (
    <Dialog 
      open={open}
      onClose={() => !isSaving && onClose()}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {isEditMode ? '编辑任务' : '创建新任务'}
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabIndex} 
          onChange={handleTabChange}
          aria-label="任务配置选项卡"
          variant="fullWidth"
        >
          <Tab label="基本信息" id="task-form-tab-0" />
          <Tab label="触发条件" id="task-form-tab-1" />
          <Tab label="操作配置" id="task-form-tab-2" />
        </Tabs>
      </Box>
      
      <DialogContent>
        {error && (
          <Box sx={{ mb: 2, color: 'error.main' }}>
            {error}
          </Box>
        )}
        
        <TabPanel value={tabIndex} index={0}>
          <TaskBasicForm 
            taskData={formData}
            onChange={handleBasicInfoChange}
          />
        </TabPanel>
        
        <TabPanel value={tabIndex} index={1}>
          <TaskTriggerForm 
            trigger={formData.trigger}
            onChange={handleTriggerChange}
          />
        </TabPanel>
        
        <TabPanel value={tabIndex} index={2}>
          <TaskActionForm 
            action={formData.action}
            onChange={handleActionChange}
          />
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose} 
          color="inherit"
          disabled={isSaving}
        >
          取消
        </Button>
        
        <Box sx={{ flexGrow: 1 }} />
        
        {tabIndex > 0 && (
          <Button 
            onClick={handlePrev}
            disabled={isSaving}
          >
            上一步
          </Button>
        )}
        
        {tabIndex < 2 ? (
          <Button 
            onClick={handleNext}
            disabled={isSaving || (tabIndex === 0 && !basicValid) || (tabIndex === 1 && !triggerValid)}
          >
            下一步
          </Button>
        ) : (
          <Button 
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={isSaving || !isFormValid}
            startIcon={isSaving && <CircularProgress size={20} color="inherit" />}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TaskDialog; 