import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
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
  category: string;
};

// 触发方式选项
const TRIGGER_OPTIONS: TriggerOption[] = [
  // 浏览器事件
  { value: 'event_browser_startup', label: '浏览器启动时', eventType: EventType.BROWSER_STARTUP, category: '浏览器事件' },
  // 移除扩展图标点击选项，因为在manifest.json中配置了default_popup，此事件永远不会触发
  // { value: 'event_extension_clicked', label: '扩展图标点击时', eventType: EventType.EXTENSION_CLICKED, category: '浏览器事件' },
  
  // 书签事件
  { value: 'event_bookmark_created', label: '创建书签时', eventType: EventType.BOOKMARK_CREATED, category: '书签事件' },
  { value: 'event_bookmark_removed', label: '删除书签时', eventType: EventType.BOOKMARK_REMOVED, category: '书签事件' },
  { value: 'event_bookmark_changed', label: '修改书签时', eventType: EventType.BOOKMARK_CHANGED, category: '书签事件' },
  { value: 'event_bookmark_moved', label: '移动书签时', eventType: EventType.BOOKMARK_MOVED, category: '书签事件' },
];

// 按类别组织触发器选项
const GROUPED_OPTIONS = TRIGGER_OPTIONS.reduce<Record<string, TriggerOption[]>>((groups, option) => {
  if (!groups[option.category]) {
    groups[option.category] = [];
  }
  groups[option.category].push(option);
  return groups;
}, {});

interface TaskTriggerFormProps {
  trigger: Trigger;
  onChange: (updatedTrigger: Trigger, isValid: boolean) => void;
}

/**
 * 任务触发器配置表单组件
 * 支持不同类型触发器的配置
 */
const TaskTriggerForm: React.FC<TaskTriggerFormProps> = ({ trigger, onChange }) => {
  // 触发器选项值
  const [triggerOptionValue, setTriggerOptionValue] = useState<string>('');
  
  // 条件配置
  const [showConditions, setShowConditions] = useState<boolean>(false);
  const [conditions, setConditions] = useState<Record<string, any>>({});
  
  // 初始化表单数据
  useEffect(() => {
    const eventTrigger = trigger as EventTrigger;
    const eventType = eventTrigger.event;
    
    // 设置事件触发器的触发选项值
    const option = TRIGGER_OPTIONS.find(opt => opt.eventType === eventType);
    
    if (option) {
      setTriggerOptionValue(option.value);
    }
    
    // 设置条件
    if (eventTrigger.conditions && Object.keys(eventTrigger.conditions).length > 0) {
      setConditions(eventTrigger.conditions);
      setShowConditions(true);
    }
  }, [trigger]);
  
  // 处理触发选项更改
  const handleTriggerOptionChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    setTriggerOptionValue(newValue);
    
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === newValue);
    if (selectedOption) {
      // 更新触发器，保留现有条件
      updateEventTrigger(selectedOption.eventType, showConditions ? conditions : undefined);
    }
  };
  
  // 切换是否显示条件
  const handleToggleConditions = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newShowConditions = event.target.checked;
    setShowConditions(newShowConditions);
    
    // 更新触发器
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === triggerOptionValue);
    if (selectedOption) {
      updateEventTrigger(selectedOption.eventType, newShowConditions ? conditions : undefined);
    }
  };
  
  // 处理条件更改
  const handleConditionChange = (key: string, value: string) => {
    const newConditions = { ...conditions, [key]: value };
    setConditions(newConditions);
    
    // 更新触发器
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === triggerOptionValue);
    if (selectedOption) {
      updateEventTrigger(selectedOption.eventType, newConditions);
    }
  };
  
  // 更新事件触发器
  const updateEventTrigger = (eventType: EventType, conditions?: Record<string, any>) => {
    const newTrigger = createEventTrigger(eventType, conditions);
    onChange(newTrigger, true); // 事件触发器始终有效
  };
  
  // 获取当前选中事件的类别
  const getCurrentEventCategory = (): string => {
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === triggerOptionValue);
    return selectedOption?.category || '';
  };
  
  // 渲染条件表单
  const renderConditionForm = () => {
    if (!showConditions) return null;
    
    const category = getCurrentEventCategory();
    
    return (
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          触发条件过滤
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {/* 书签相关条件 */}
        {category === '书签事件' && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="书签标题包含"
                placeholder="例如: Google"
                value={conditions.title || ''}
                onChange={(e) => handleConditionChange('title', e.target.value)}
                helperText="仅当书签标题包含此文本时触发"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="URL包含"
                placeholder="例如: google.com"
                value={conditions.url || ''}
                onChange={(e) => handleConditionChange('url', e.target.value)}
                helperText="仅当书签URL包含此文本时触发"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="父文件夹ID"
                placeholder="例如: 1"
                value={conditions.parentFolder || ''}
                onChange={(e) => handleConditionChange('parentFolder', e.target.value)}
                helperText="仅当书签在指定文件夹中时触发"
              />
            </Grid>
          </Grid>
        )}
        
        {/* 浏览器事件通常不需要条件过滤 */}
        {category === '浏览器事件' && (
          <Typography variant="body2" color="text.secondary">
            浏览器事件通常不需要特定的条件过滤。
          </Typography>
        )}
      </Paper>
    );
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
          {Object.entries(GROUPED_OPTIONS).map(([category, options]) => [
            <MenuItem key={category} disabled divider>
              {category}
            </MenuItem>,
            ...options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))
          ]).flat()}
        </Select>
        <FormHelperText>
          选择任务的触发条件
        </FormHelperText>
      </FormControl>
      
      <Box sx={{ mt: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showConditions}
              onChange={handleToggleConditions}
              name="showConditions"
            />
          }
          label="添加条件过滤"
        />
      </Box>
      
      {renderConditionForm()}
    </Box>
  );
};

export default TaskTriggerForm;