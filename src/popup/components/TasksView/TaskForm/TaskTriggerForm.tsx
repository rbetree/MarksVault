import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
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
  // 事件触发器选项
  { value: 'event_browser_startup', label: '浏览器启动时', eventType: EventType.BROWSER_STARTUP },
  { value: 'event_bookmark_created', label: '创建书签时', eventType: EventType.BOOKMARK_CREATED },
  { value: 'event_bookmark_removed', label: '删除书签时', eventType: EventType.BOOKMARK_REMOVED },
  { value: 'event_bookmark_changed', label: '修改书签时', eventType: EventType.BOOKMARK_CHANGED },
  { value: 'event_bookmark_moved', label: '移动书签时', eventType: EventType.BOOKMARK_MOVED },
];

interface TaskTriggerFormProps {
  trigger: Trigger;
  onChange: (updatedTrigger: Trigger, isValid: boolean) => void;
}

/**
 * 任务触发器配置表单组件
 * 使用下拉框选择触发方式，简化界面
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
      updateEventTrigger(selectedOption.eventType);
    }
  };
  
  // 更新事件触发器
  const updateEventTrigger = (eventType: EventType) => {
    const newTrigger = createEventTrigger(eventType);
    onChange(newTrigger, true); // 事件触发器始终有效
  };
  
  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <FormControl fullWidth size="small" margin="dense">
        <InputLabel id="trigger-type-label">触发条件</InputLabel>
        <Select
          labelId="trigger-type-label"
          id="trigger-type"
          value={triggerOptionValue}
          label="触发条件"
          onChange={handleTriggerOptionChange}
        >
          {TRIGGER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          选择任务的触发条件
        </FormHelperText>
      </FormControl>
    </Box>
  );
};

export default TaskTriggerForm;