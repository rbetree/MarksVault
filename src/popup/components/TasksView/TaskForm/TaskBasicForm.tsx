import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import FormHelperText from '@mui/material/FormHelperText';
import { Task, TaskStatus } from '../../../../types/task';

interface TaskBasicFormProps {
  taskData: Task;
  onChange: (updatedData: Partial<Task>, isValid: boolean) => void;
}

/**
 * 任务基本信息表单组件
 * 用于编辑任务的名称、描述和是否启用
 */
const TaskBasicForm: React.FC<TaskBasicFormProps> = ({ taskData, onChange }) => {
  // 表单数据状态
  const [name, setName] = useState(taskData.name);
  const [description, setDescription] = useState(taskData.description || '');
  const [enabled, setEnabled] = useState(taskData.status === TaskStatus.ENABLED);
  
  // 表单验证状态
  const [nameError, setNameError] = useState('');
  
  // 初始化表单数据
  useEffect(() => {
    setName(taskData.name);
    setDescription(taskData.description || '');
    setEnabled(taskData.status === TaskStatus.ENABLED);
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
    
    updateParent(newName, description, enabled);
  };
  
  // 处理描述更改
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    updateParent(name, newDescription, enabled);
  };
  
  // 处理启用状态更改
  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnabled = e.target.checked;
    setEnabled(newEnabled);
    updateParent(name, description, newEnabled);
  };
  
  // 更新父组件数据
  const updateParent = (newName: string, newDescription: string, newEnabled: boolean) => {
    const status = newEnabled ? TaskStatus.ENABLED : TaskStatus.DISABLED;
    const isValid = !!newName.trim();
    
    onChange(
      {
        name: newName,
        description: newDescription || '',
        status
      },
      isValid
    );
  };
  
  return (
    <Box sx={{ py: 1 }}>
      <Grid container spacing={3}>
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
            margin="normal"
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            label="任务描述"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={handleDescriptionChange}
            helperText="可选：描述该任务的用途和执行内容"
            variant="outlined"
            margin="normal"
          />
        </Grid>
        
        <Grid item xs={12}>
          <FormControl component="fieldset" variant="standard">
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={handleEnabledChange}
                  color="primary"
                />
              }
              label="启用任务"
            />
            <FormHelperText>
              {enabled 
                ? '任务将根据触发条件自动执行' 
                : '任务处于禁用状态，不会自动执行'}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaskBasicForm; 