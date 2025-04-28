import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormHelperText from '@mui/material/FormHelperText';
import { 
  Trigger, 
  TriggerType, 
  TimeTrigger, 
  EventTrigger, 
  TimeScheduleType, 
  EventType,
  createTimeTrigger,
  createEventTrigger
} from '../../../../types/task';

interface TaskTriggerFormProps {
  trigger: Trigger;
  onChange: (updatedTrigger: Trigger, isValid: boolean) => void;
}

/**
 * 任务触发器配置表单组件
 * 用于配置任务的触发条件，包括基于时间和基于事件的触发器
 */
const TaskTriggerForm: React.FC<TaskTriggerFormProps> = ({ trigger, onChange }) => {
  // 触发器类型
  const [triggerType, setTriggerType] = useState<TriggerType>(trigger.type);
  
  // 时间触发器状态
  const [timeScheduleType, setTimeScheduleType] = useState<TimeScheduleType>(
    trigger.type === TriggerType.TIME ? (trigger as TimeTrigger).schedule.type : TimeScheduleType.DAILY
  );
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [executeDate, setExecuteDate] = useState<string>('');
  
  // 事件触发器状态
  const [eventType, setEventType] = useState<EventType>(
    trigger.type === TriggerType.EVENT ? (trigger as EventTrigger).event : EventType.BROWSER_STARTUP
  );
  
  // 通用状态
  const [enabled, setEnabled] = useState<boolean>(trigger.enabled);
  
  // 表单验证状态
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // 初始化表单数据
  useEffect(() => {
    setTriggerType(trigger.type);
    setEnabled(trigger.enabled);
    
    if (trigger.type === TriggerType.TIME) {
      const timeTrigger = trigger as TimeTrigger;
      setTimeScheduleType(timeTrigger.schedule.type);
      
      if (timeTrigger.schedule.intervalMinutes) {
        setIntervalMinutes(timeTrigger.schedule.intervalMinutes);
      }
      
      if (timeTrigger.schedule.hour !== undefined) {
        setHour(timeTrigger.schedule.hour);
      }
      
      if (timeTrigger.schedule.minute !== undefined) {
        setMinute(timeTrigger.schedule.minute);
      }
      
      if (timeTrigger.schedule.dayOfWeek !== undefined) {
        setDayOfWeek(timeTrigger.schedule.dayOfWeek);
      }
      
      if (timeTrigger.schedule.dayOfMonth !== undefined) {
        setDayOfMonth(timeTrigger.schedule.dayOfMonth);
      }
      
      if (timeTrigger.schedule.when) {
        const date = new Date(timeTrigger.schedule.when);
        const localISOString = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setExecuteDate(localISOString);
      } else {
        // 默认设置为当前时间后1小时
        const date = new Date(Date.now() + 3600000);
        const localISOString = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setExecuteDate(localISOString);
      }
    } else if (trigger.type === TriggerType.EVENT) {
      setEventType((trigger as EventTrigger).event);
    }
  }, [trigger]);
  
  // 处理触发器类型更改
  const handleTriggerTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as TriggerType;
    setTriggerType(newType);
    updateParentTrigger(newType);
  };
  
  // 处理时间调度类型更改
  const handleTimeScheduleTypeChange = (event: SelectChangeEvent<TimeScheduleType>) => {
    const newType = event.target.value as TimeScheduleType;
    setTimeScheduleType(newType);
    updateParentTimeTrigger(newType);
  };
  
  // 处理时间间隔更改
  const handleIntervalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setIntervalMinutes(value);
    
    const newErrors = { ...errors };
    if (isNaN(value) || value <= 0) {
      newErrors.interval = '请输入有效的时间间隔（分钟）';
    } else {
      delete newErrors.interval;
    }
    setErrors(newErrors);
    
    updateParentTimeTrigger(timeScheduleType, { intervalMinutes: value });
  };
  
  // 处理小时更改
  const handleHourChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setHour(value);
    updateParentTimeTrigger(timeScheduleType, { hour: value });
  };
  
  // 处理分钟更改
  const handleMinuteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setMinute(value);
    updateParentTimeTrigger(timeScheduleType, { minute: value });
  };
  
  // 处理星期几更改
  const handleDayOfWeekChange = (event: SelectChangeEvent<number>) => {
    const value = event.target.value as number;
    setDayOfWeek(value);
    updateParentTimeTrigger(timeScheduleType, { dayOfWeek: value });
  };
  
  // 处理月中日期更改
  const handleDayOfMonthChange = (event: SelectChangeEvent<number>) => {
    const value = event.target.value as number;
    setDayOfMonth(value);
    updateParentTimeTrigger(timeScheduleType, { dayOfMonth: value });
  };
  
  // 处理执行日期更改
  const handleExecuteDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setExecuteDate(value);
    
    const date = new Date(value);
    const timestamp = date.getTime();
    
    updateParentTimeTrigger(timeScheduleType, { when: timestamp });
  };
  
  // 处理事件类型更改
  const handleEventTypeChange = (event: SelectChangeEvent<EventType>) => {
    const value = event.target.value as EventType;
    setEventType(value);
    updateParentEventTrigger(value);
  };
  
  // 处理启用状态更改
  const handleEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setEnabled(value);
    
    if (triggerType === TriggerType.TIME) {
      updateParentTimeTrigger(timeScheduleType, { enabled: value });
    } else {
      updateParentEventTrigger(eventType, { enabled: value });
    }
  };
  
  // 更新父组件的触发器
  const updateParentTrigger = (type: TriggerType) => {
    let newTrigger: Trigger;
    
    if (type === TriggerType.TIME) {
      newTrigger = createTimeTrigger(TimeScheduleType.DAILY);
      (newTrigger as TimeTrigger).enabled = enabled;
    } else {
      newTrigger = createEventTrigger(EventType.BROWSER_STARTUP);
      (newTrigger as EventTrigger).enabled = enabled;
    }
    
    // 检查是否有效
    const isValid = validateTrigger(newTrigger);
    
    onChange(newTrigger, isValid);
  };
  
  // 更新父组件的时间触发器
  const updateParentTimeTrigger = (
    scheduleType: TimeScheduleType, 
    options: {
      intervalMinutes?: number;
      hour?: number;
      minute?: number;
      dayOfWeek?: number;
      dayOfMonth?: number;
      when?: number;
      enabled?: boolean;
    } = {}
  ) => {
    const newTrigger = createTimeTrigger(scheduleType);
    (newTrigger as TimeTrigger).enabled = options.enabled !== undefined ? options.enabled : enabled;
    
    switch (scheduleType) {
      case TimeScheduleType.ONCE:
        newTrigger.schedule.when = options.when || (executeDate ? new Date(executeDate).getTime() : Date.now() + 3600000);
        break;
      case TimeScheduleType.INTERVAL:
        newTrigger.schedule.intervalMinutes = options.intervalMinutes || intervalMinutes;
        break;
      case TimeScheduleType.DAILY:
        newTrigger.schedule.hour = options.hour !== undefined ? options.hour : hour;
        newTrigger.schedule.minute = options.minute !== undefined ? options.minute : minute;
        break;
      case TimeScheduleType.WEEKLY:
        newTrigger.schedule.dayOfWeek = options.dayOfWeek !== undefined ? options.dayOfWeek : dayOfWeek;
        newTrigger.schedule.hour = options.hour !== undefined ? options.hour : hour;
        newTrigger.schedule.minute = options.minute !== undefined ? options.minute : minute;
        break;
      case TimeScheduleType.MONTHLY:
        newTrigger.schedule.dayOfMonth = options.dayOfMonth !== undefined ? options.dayOfMonth : dayOfMonth;
        newTrigger.schedule.hour = options.hour !== undefined ? options.hour : hour;
        newTrigger.schedule.minute = options.minute !== undefined ? options.minute : minute;
        break;
    }
    
    // 检查是否有效
    const isValid = validateTrigger(newTrigger);
    
    onChange(newTrigger, isValid);
  };
  
  // 更新父组件的事件触发器
  const updateParentEventTrigger = (eventType: EventType, options: { enabled?: boolean } = {}) => {
    const newTrigger = createEventTrigger(eventType);
    (newTrigger as EventTrigger).enabled = options.enabled !== undefined ? options.enabled : enabled;
    
    // 事件触发器始终有效
    onChange(newTrigger, true);
  };
  
  // 验证触发器
  const validateTrigger = (trigger: Trigger): boolean => {
    if (trigger.type === TriggerType.TIME) {
      const timeTrigger = trigger as TimeTrigger;
      
      if (timeTrigger.schedule.type === TimeScheduleType.INTERVAL) {
        if (!timeTrigger.schedule.intervalMinutes || timeTrigger.schedule.intervalMinutes <= 0) {
          return false;
        }
      }
      
      return true;
    }
    
    // 事件触发器始终有效
    return true;
  };
  
  // 渲染时间触发器表单
  const renderTimeScheduleForm = () => {
    switch (timeScheduleType) {
      case TimeScheduleType.ONCE:
        return (
          <Grid item xs={12}>
            <TextField
              label="执行日期和时间"
              type="datetime-local"
              value={executeDate}
              onChange={handleExecuteDateChange}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              margin="normal"
              helperText="任务将在此时执行一次"
            />
          </Grid>
        );
        
      case TimeScheduleType.INTERVAL:
        return (
          <Grid item xs={12}>
            <TextField
              label="时间间隔（分钟）"
              type="number"
              value={intervalMinutes}
              onChange={handleIntervalChange}
              error={!!errors.interval}
              helperText={errors.interval || "任务将每隔指定的分钟数执行一次"}
              fullWidth
              margin="normal"
              inputProps={{ min: 1 }}
            />
          </Grid>
        );
        
      case TimeScheduleType.DAILY:
        return (
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="小时"
                type="number"
                value={hour}
                onChange={handleHourChange}
                margin="normal"
                inputProps={{ min: 0, max: 23 }}
              />
              <TextField
                label="分钟"
                type="number"
                value={minute}
                onChange={handleMinuteChange}
                margin="normal"
                inputProps={{ min: 0, max: 59 }}
              />
            </Box>
            <FormHelperText>任务将每天在此时间执行</FormHelperText>
          </Grid>
        );
        
      case TimeScheduleType.WEEKLY:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="day-of-week-label">星期几</InputLabel>
                <Select
                  labelId="day-of-week-label"
                  value={dayOfWeek}
                  onChange={handleDayOfWeekChange}
                  label="星期几"
                >
                  <MenuItem value={0}>星期日</MenuItem>
                  <MenuItem value={1}>星期一</MenuItem>
                  <MenuItem value={2}>星期二</MenuItem>
                  <MenuItem value={3}>星期三</MenuItem>
                  <MenuItem value={4}>星期四</MenuItem>
                  <MenuItem value={5}>星期五</MenuItem>
                  <MenuItem value={6}>星期六</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="小时"
                  type="number"
                  value={hour}
                  onChange={handleHourChange}
                  margin="normal"
                  inputProps={{ min: 0, max: 23 }}
                />
                <TextField
                  label="分钟"
                  type="number"
                  value={minute}
                  onChange={handleMinuteChange}
                  margin="normal"
                  inputProps={{ min: 0, max: 59 }}
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <FormHelperText>任务将每周在选定的日期和时间执行</FormHelperText>
            </Grid>
          </Grid>
        );
        
      case TimeScheduleType.MONTHLY:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="day-of-month-label">日期</InputLabel>
                <Select
                  labelId="day-of-month-label"
                  value={dayOfMonth}
                  onChange={handleDayOfMonthChange}
                  label="日期"
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {i + 1}日
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="小时"
                  type="number"
                  value={hour}
                  onChange={handleHourChange}
                  margin="normal"
                  inputProps={{ min: 0, max: 23 }}
                />
                <TextField
                  label="分钟"
                  type="number"
                  value={minute}
                  onChange={handleMinuteChange}
                  margin="normal"
                  inputProps={{ min: 0, max: 59 }}
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <FormHelperText>任务将每月在选定的日期和时间执行</FormHelperText>
            </Grid>
          </Grid>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{ py: 1 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle1">触发方式</Typography>
          <RadioGroup
            name="trigger-type"
            value={triggerType}
            onChange={handleTriggerTypeChange}
          >
            <FormControlLabel 
              value={TriggerType.TIME} 
              control={<Radio />} 
              label="基于时间" 
            />
            <FormControlLabel 
              value={TriggerType.EVENT} 
              control={<Radio />} 
              label="基于事件" 
            />
          </RadioGroup>
        </Grid>
        
        <Grid item xs={12}>
          <Divider />
        </Grid>
        
        {triggerType === TriggerType.TIME ? (
          <>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="time-schedule-type-label">时间类型</InputLabel>
                <Select
                  labelId="time-schedule-type-label"
                  value={timeScheduleType}
                  onChange={handleTimeScheduleTypeChange}
                  label="时间类型"
                >
                  <MenuItem value={TimeScheduleType.ONCE}>一次性</MenuItem>
                  <MenuItem value={TimeScheduleType.INTERVAL}>定时间隔</MenuItem>
                  <MenuItem value={TimeScheduleType.DAILY}>每天</MenuItem>
                  <MenuItem value={TimeScheduleType.WEEKLY}>每周</MenuItem>
                  <MenuItem value={TimeScheduleType.MONTHLY}>每月</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {renderTimeScheduleForm()}
          </>
        ) : (
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="event-type-label">事件类型</InputLabel>
              <Select
                labelId="event-type-label"
                value={eventType}
                onChange={handleEventTypeChange}
                label="事件类型"
              >
                <MenuItem value={EventType.BROWSER_STARTUP}>浏览器启动</MenuItem>
                <MenuItem value={EventType.BOOKMARK_CREATED}>创建书签</MenuItem>
                <MenuItem value={EventType.BOOKMARK_REMOVED}>删除书签</MenuItem>
                <MenuItem value={EventType.BOOKMARK_CHANGED}>修改书签</MenuItem>
                <MenuItem value={EventType.BOOKMARK_MOVED}>移动书签</MenuItem>
              </Select>
              <FormHelperText>任务将在指定事件发生时执行</FormHelperText>
            </FormControl>
          </Grid>
        )}
        
        <Grid item xs={12}>
          <Divider />
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
              label="启用触发器"
            />
            <FormHelperText>
              {enabled 
                ? '触发器已启用，将根据条件触发任务' 
                : '触发器已禁用，不会触发任务'}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaskTriggerForm; 