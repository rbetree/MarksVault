import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TaskBasicForm from '../../popup/components/TasksView/TaskForm/TaskBasicForm';
import TaskTriggerForm from '../../popup/components/TasksView/TaskForm/TaskTriggerForm';
import TaskActionForm from '../../popup/components/TasksView/TaskForm/TaskActionForm';
import { Task } from '../../types/task';
import { ConfigCard } from './ConfigCard';

// Icons
import EditIcon from '@mui/icons-material/Edit';
import TimerIcon from '@mui/icons-material/Timer';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';

interface TaskFormContainerProps {
  taskData: Task;
  onChange: (updatedData: Partial<Task>) => void;
  onValidityChange: (isValid: boolean) => void;
}

/**
 * 任务表单容器组件 - Redesigned
 * Uses a responsive grid layout with ConfigCards
 */
const TaskFormContainer: React.FC<TaskFormContainerProps> = ({
  taskData,
  onChange,
  onValidityChange
}) => {
  // 各子表单的验证状态
  const [basicValid, setBasicValid] = useState(false);
  const [triggerValid, setTriggerValid] = useState(true);
  const [actionValid, setActionValid] = useState(true);

  // 当任何子表单验证状态变化时，通知父组件
  useEffect(() => {
    const isFormValid = basicValid && triggerValid && actionValid;
    onValidityChange(isFormValid);
  }, [basicValid, triggerValid, actionValid, onValidityChange]);

  // 处理基本信息更新
  const handleBasicInfoChange = (updatedBasicInfo: Partial<Task>, isValid: boolean) => {
    onChange(updatedBasicInfo);
    setBasicValid(isValid);
  };

  // 处理触发器更新
  const handleTriggerChange = (updatedTrigger: Task['trigger'], isValid: boolean) => {
    onChange({ trigger: updatedTrigger });
    setTriggerValid(isValid);
  };

  // 处理操作更新
  const handleActionChange = (updatedAction: Task['action'], isValid: boolean) => {
    onChange({ action: updatedAction });
    setActionValid(isValid);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={3}>
        {/* Row 1: Basic Info, Trigger, Action Type */}
        <Grid item xs={12} md={4}>
          <ConfigCard
            title="基础信息"
            icon={<EditIcon fontSize="small" />}
            description="设置任务名称"
          >
            <TaskBasicForm
              taskData={taskData}
              onChange={handleBasicInfoChange}
            />
          </ConfigCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <ConfigCard
            title="触发条件"
            icon={<TimerIcon fontSize="small" />}
            description="何时运行此任务"
          >
            <TaskTriggerForm
              trigger={taskData.trigger}
              onChange={handleTriggerChange}
              currentAction={taskData.action}
            />
          </ConfigCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <ConfigCard
            title="操作类型"
            icon={<CategoryIcon fontSize="small" />}
            description="选择执行的操作"
          >
            <TaskActionForm
              action={taskData.action}
              onChange={handleActionChange}
              showDetailsInSeparateColumn={true}
            />
          </ConfigCard>
        </Grid>

        {/* Row 2: Action Details */}
        <Grid item xs={12}>
          <ConfigCard
            title="详细配置"
            icon={<SettingsIcon fontSize="small" />}
            description="配置选定操作的具体参数"
            sx={{ minHeight: 400 }}
          >
            <TaskActionForm
              action={taskData.action}
              onChange={handleActionChange}
              showOnlyDetails={true}
            />
          </ConfigCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaskFormContainer;
