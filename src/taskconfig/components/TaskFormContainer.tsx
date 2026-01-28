import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TaskBasicForm from '../../popup/components/TasksView/TaskForm/TaskBasicForm';
import TaskTriggerForm from '../../popup/components/TasksView/TaskForm/TaskTriggerForm';
import TaskActionForm from '../../popup/components/TasksView/TaskForm/TaskActionForm';
import { Task } from '../../types/task';

interface TaskFormContainerProps {
  taskData: Task;
  onChange: (updatedData: Partial<Task>) => void;
  onValidityChange: (isValid: boolean) => void;
}

/**
 * 任务表单容器组件
 * 整合三个子表单：基础信息、触发条件、执行操作
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
    <Box
      sx={{
        maxWidth: { xs: '100%', md: '1200px' }, // 宽屏下避免左右拉得太开，小屏占满
        margin: '0 auto',
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 2, md: 3 }, // 增加间距以提升层次感
          width: '100%',
          px: { xs: 1, md: 2 },
          pb: 3,
        }}
      >
        {/* 左栏：基础信息、触发条件、执行操作选项 */}
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '0 0 360px' }, // 小屏占满，宽屏固定宽度
            minWidth: 0,
          }}
        >
          {/* 基础信息表单 */}
          <Paper
            elevation={1}
            sx={{
              p: 3,
              mb: 2,
              borderRadius: 2
            }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontSize: '1.1rem',
                fontWeight: 500,
                color: 'text.primary'
              }}
            >
              基础信息
            </Typography>
            <TaskBasicForm
              taskData={taskData}
              onChange={handleBasicInfoChange}
            />
          </Paper>

          {/* 触发条件表单 */}
          <Paper
            elevation={1}
            sx={{
              p: 3,
              mb: 2,
              borderRadius: 2
            }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontSize: '1.1rem',
                fontWeight: 500,
                color: 'text.primary'
              }}
            >
              触发条件
            </Typography>
            <TaskTriggerForm
              trigger={taskData.trigger}
              onChange={handleTriggerChange}
              currentAction={taskData.action}
            />
          </Paper>

          {/* 执行操作选项 */}
          <Paper
            elevation={1}
            sx={{
              p: 3,
              mb: 2,
              borderRadius: 2
            }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontSize: '1.1rem',
                fontWeight: 500,
                color: 'text.primary'
              }}
            >
              执行操作
            </Typography>
            <TaskActionForm
              action={taskData.action}
              onChange={handleActionChange}
              showDetailsInSeparateColumn={true}
            />
          </Paper>
        </Box>

        {/* 右栏：执行操作详细配置 */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <Paper
            elevation={1}
            sx={{
              p: 3,
              borderRadius: 2,
              position: { xs: 'static', md: 'sticky' },
              top: { md: 16 },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontSize: '1.1rem',
                fontWeight: 500,
                color: 'text.primary'
              }}
            >
              操作详细配置
            </Typography>
            <TaskActionForm
              action={taskData.action}
              onChange={handleActionChange}
              showOnlyDetails={true}
            />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default TaskFormContainer;
