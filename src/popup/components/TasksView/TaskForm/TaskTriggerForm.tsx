import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import { 
  Trigger, 
  TriggerType, 
  EventTrigger, 
  EventType,
  createEventTrigger
} from '../../../../types/task';

// 定义统一的触发方式类型
type TriggerOption = {
  value: string;
  label: string;
  eventType: EventType;
};

// 触发方式选项
const TRIGGER_OPTIONS: TriggerOption[] = [
  { value: 'event_browser_startup', label: '浏览器启动时', eventType: EventType.BROWSER_STARTUP },
  // 移除扩展图标点击选项，因为在manifest.json中配置了default_popup，此事件永远不会触发
  // { value: 'event_extension_clicked', label: '扩展图标点击时', eventType: EventType.EXTENSION_CLICKED },
  
  { value: 'event_bookmark_changed', label: '书签变更时', eventType: EventType.BOOKMARK_CHANGED },
];

interface TaskTriggerFormProps {
  trigger: Trigger;
  onChange: (updatedTrigger: Trigger, isValid: boolean) => void;
}

/**
 * 任务触发器配置表单组件
 * 用于选择任务的触发条件
 */
const TaskTriggerForm: React.FC<TaskTriggerFormProps> = ({ trigger, onChange }) => {
  // 触发器选项值
  const [triggerOptionValue, setTriggerOptionValue] = useState<string>('');
  
  // 初始化表单数据
  useEffect(() => {
    const eventTrigger = trigger as EventTrigger;
    const eventType = eventTrigger.event;
    
    // 设置事件触发器的触发选项值
    const option = TRIGGER_OPTIONS.find(opt => opt.eventType === eventType);
    
    if (option) {
      setTriggerOptionValue(option.value);
    }
  }, [trigger]);
  
  // 处理触发选项更改
  const handleTriggerOptionChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    setTriggerOptionValue(newValue);
    
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === newValue);
    if (selectedOption) {
      // 更新触发器
      updateEventTrigger(selectedOption.eventType);
    }
  };
  
  // 更新事件触发器
  const updateEventTrigger = (eventType: EventType) => {
    const newTrigger = createEventTrigger(eventType, undefined);
    onChange(newTrigger, true); // 事件触发器始终有效
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <FormControl fullWidth size="small" margin="dense">
        <InputLabel id="trigger-type-label">触发条件</InputLabel>
        <Select
          labelId="trigger-type-label"
          id="trigger-type"
          value={triggerOptionValue}
          label="触发条件"
          onChange={handleTriggerOptionChange}
          MenuProps={{
            PaperProps: {
              style: {
                maxHeight: 224, // 更紧凑的下拉高度
              },
            },
          }}
        >
          {TRIGGER_OPTIONS.map((option) => (
            <MenuItem 
              key={option.value} 
              value={option.value}
              dense // 使菜单项更紧凑
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default TaskTriggerForm;