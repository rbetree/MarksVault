import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { Task, TaskStatus } from '../../../../types/task';

interface TaskBasicFormProps {
  taskData: Task;
  onChange: (updatedData: Partial<Task>, isValid: boolean) => void;
}

/**
 * 任务基本信息表单组件
 * 用于编辑任务的名称
 */
const TaskBasicForm: React.FC<TaskBasicFormProps> = ({ taskData, onChange }) => {
  // 表单数据状态
  const [name, setName] = useState(taskData.name);
  
  // 表单验证状态
  const [nameError, setNameError] = useState('');
  
  // 初始化表单数据
  useEffect(() => {
    setName(taskData.name);
  }, [taskData]);
  
  // 处理名称更改
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    
    // 验证名称
    if (!newName.trim()) {
      setNameError('任务名称不能为空');
    } else {
      setNameError('');
    }
    
    updateParent(newName);
  };
  
  // 更新父组件数据
  const updateParent = (newName: string) => {
    const isValid = !!newName.trim();
    
    onChange(
      {
        name: newName,
        status: TaskStatus.ENABLED
      },
      isValid
    );
  };
  
  return (
    <Box sx={{ py: 0.5 }}>
      <Grid container>
        <Grid item xs={12}>
          <TextField
            label="任务名称"
            fullWidth
            required
            value={name}
            onChange={handleNameChange}
            error={!!nameError}
            helperText={nameError || '给任务起个明确的名称'}
            variant="outlined"
            margin="dense"
            size="small"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaskBasicForm; 