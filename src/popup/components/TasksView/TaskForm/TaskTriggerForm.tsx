import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
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

// 定义统一的触发方式类型
type TriggerOption = {
  value: string;
  label: string;
  triggerType: TriggerType;
  timeType?: TimeScheduleType;
  eventType?: EventType;
};

// 触发方式选项
const TRIGGER_OPTIONS: TriggerOption[] = [
  // 时间触发器选项
  { value: 'time_once', label: '一次性', triggerType: TriggerType.TIME, timeType: TimeScheduleType.ONCE },
  { value: 'time_interval', label: '定时间隔', triggerType: TriggerType.TIME, timeType: TimeScheduleType.INTERVAL },
  { value: 'time_daily', label: '每天', triggerType: TriggerType.TIME, timeType: TimeScheduleType.DAILY },
  { value: 'time_weekly', label: '每周', triggerType: TriggerType.TIME, timeType: TimeScheduleType.WEEKLY },
  { value: 'time_monthly', label: '每月', triggerType: TriggerType.TIME, timeType: TimeScheduleType.MONTHLY },
  
  // 事件触发器选项
  { value: 'event_browser_startup', label: '浏览器启动时', triggerType: TriggerType.EVENT, eventType: EventType.BROWSER_STARTUP },
  { value: 'event_bookmark_created', label: '创建书签时', triggerType: TriggerType.EVENT, eventType: EventType.BOOKMARK_CREATED },
  { value: 'event_bookmark_removed', label: '删除书签时', triggerType: TriggerType.EVENT, eventType: EventType.BOOKMARK_REMOVED },
  { value: 'event_bookmark_changed', label: '修改书签时', triggerType: TriggerType.EVENT, eventType: EventType.BOOKMARK_CHANGED },
  { value: 'event_bookmark_moved', label: '移动书签时', triggerType: TriggerType.EVENT, eventType: EventType.BOOKMARK_MOVED },
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
  
  // 时间触发器相关状态
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [executeDate, setExecuteDate] = useState<string>('');
  
  // 表单验证状态
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // 初始化表单数据
  useEffect(() => {
    if (trigger.type === TriggerType.TIME) {
      const timeTrigger = trigger as TimeTrigger;
      const timeType = timeTrigger.schedule.type;
      
      // 设置时间触发器的触发选项值
      const option = TRIGGER_OPTIONS.find(opt => 
        opt.triggerType === TriggerType.TIME && opt.timeType === timeType
      );
      
      if (option) {
        setTriggerOptionValue(option.value);
      }
      
      // 设置其他时间触发器相关状态
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
      } else if (timeType === TimeScheduleType.ONCE) {
        // 默认设置为当前时间后1小时
        const date = new Date(Date.now() + 3600000);
        const localISOString = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setExecuteDate(localISOString);
      }
    } else if (trigger.type === TriggerType.EVENT) {
      const eventTrigger = trigger as EventTrigger;
      const eventType = eventTrigger.event;
      
      // 设置事件触发器的触发选项值
      const option = TRIGGER_OPTIONS.find(opt => 
        opt.triggerType === TriggerType.EVENT && opt.eventType === eventType
      );
      
      if (option) {
        setTriggerOptionValue(option.value);
      }
    }
  }, [trigger]);
  
  // 处理触发选项更改
  const handleTriggerOptionChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    setTriggerOptionValue(newValue);
    
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === newValue);
    if (selectedOption) {
      if (selectedOption.triggerType === TriggerType.TIME) {
        updateTimeTrigger(selectedOption.timeType!);
      } else {
        updateEventTrigger(selectedOption.eventType!);
      }
    }
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
    
    updateTimeTrigger(TimeScheduleType.INTERVAL, { intervalMinutes: value });
  };
  
  // 处理小时更改
  const handleHourChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setHour(value);
    
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === triggerOptionValue);
    if (selectedOption && selectedOption.timeType) {
      updateTimeTrigger(selectedOption.timeType, { hour: value });
    }
  };
  
  // 处理分钟更改
  const handleMinuteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setMinute(value);
    
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === triggerOptionValue);
    if (selectedOption && selectedOption.timeType) {
      updateTimeTrigger(selectedOption.timeType, { minute: value });
    }
  };
  
  // 处理星期几更改
  const handleDayOfWeekChange = (event: SelectChangeEvent<number>) => {
    const value = event.target.value as number;
    setDayOfWeek(value);
    updateTimeTrigger(TimeScheduleType.WEEKLY, { dayOfWeek: value });
  };
  
  // 处理月中日期更改
  const handleDayOfMonthChange = (event: SelectChangeEvent<number>) => {
    const value = event.target.value as number;
    setDayOfMonth(value);
    updateTimeTrigger(TimeScheduleType.MONTHLY, { dayOfMonth: value });
  };
  
  // 处理执行日期更改
  const handleExecuteDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setExecuteDate(value);
    
    const date = new Date(value);
    const timestamp = date.getTime();
    
    updateTimeTrigger(TimeScheduleType.ONCE, { when: timestamp });
  };
  
  // 更新时间触发器
  const updateTimeTrigger = (
    scheduleType: TimeScheduleType, 
    options: {
      intervalMinutes?: number;
      hour?: number;
      minute?: number;
      dayOfWeek?: number;
      dayOfMonth?: number;
      when?: number;
    } = {}
  ) => {
    const newTrigger = createTimeTrigger(scheduleType);
    (newTrigger as TimeTrigger).enabled = true;
    
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
  
  // 更新事件触发器
  const updateEventTrigger = (eventType: EventType) => {
    const newTrigger = createEventTrigger(eventType);
    (newTrigger as EventTrigger).enabled = true;
    
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
  
  // 渲染附加配置项
  const renderAdditionalConfig = () => {
    const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === triggerOptionValue);
    if (!selectedOption) return null;
    
    if (selectedOption.triggerType === TriggerType.TIME) {
      switch (selectedOption.timeType) {
        case TimeScheduleType.ONCE:
          return (
            <TextField
              label="执行日期和时间"
              type="datetime-local"
              value={executeDate}
              onChange={handleExecuteDateChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              margin="dense"
              size="small"
              helperText="任务将在此时执行一次"
            />
          );
          
        case TimeScheduleType.INTERVAL:
          return (
            <TextField
              label="时间间隔（分钟）"
              type="number"
              value={intervalMinutes}
              onChange={handleIntervalChange}
              error={!!errors.interval}
              helperText={errors.interval || "任务将每隔指定的分钟数执行一次"}
              fullWidth
              margin="dense"
              size="small"
              inputProps={{ min: 1 }}
            />
          );
          
        case TimeScheduleType.DAILY:
          return (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    label="小时"
                    type="number"
                    value={hour}
                    onChange={handleHourChange}
                    fullWidth
                    size="small"
                    margin="dense"
                    inputProps={{ min: 0, max: 23 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="分钟"
                    type="number"
                    value={minute}
                    onChange={handleMinuteChange}
                    fullWidth
                    size="small"
                    margin="dense"
                    inputProps={{ min: 0, max: 59 }}
                  />
                </Grid>
              </Grid>
              <FormHelperText>任务将每天在此时间执行</FormHelperText>
            </Box>
          );
          
        case TimeScheduleType.WEEKLY:
          return (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small" margin="dense">
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
                <Grid item xs={6}>
                  <TextField
                    label="小时"
                    type="number"
                    value={hour}
                    onChange={handleHourChange}
                    fullWidth
                    size="small"
                    margin="dense"
                    inputProps={{ min: 0, max: 23 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="分钟"
                    type="number"
                    value={minute}
                    onChange={handleMinuteChange}
                    fullWidth
                    size="small"
                    margin="dense"
                    inputProps={{ min: 0, max: 59 }}
                  />
                </Grid>
              </Grid>
              <FormHelperText>任务将每周在选定的日期和时间执行</FormHelperText>
            </Box>
          );
          
        case TimeScheduleType.MONTHLY:
          return (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small" margin="dense">
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
                <Grid item xs={6}>
                  <TextField
                    label="小时"
                    type="number"
                    value={hour}
                    onChange={handleHourChange}
                    fullWidth
                    size="small"
                    margin="dense"
                    inputProps={{ min: 0, max: 23 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="分钟"
                    type="number"
                    value={minute}
                    onChange={handleMinuteChange}
                    fullWidth
                    size="small"
                    margin="dense"
                    inputProps={{ min: 0, max: 59 }}
                  />
                </Grid>
              </Grid>
              <FormHelperText>任务将每月在选定的日期和时间执行</FormHelperText>
            </Box>
          );
          
        default:
          return null;
      }
    }
    
    // 对于事件触发器，不需要额外配置
    return (
      <FormHelperText sx={{ mt: 1 }}>
        {selectedOption.label}执行
      </FormHelperText>
    );
  };
  
  return (
    <Box sx={{ py: 0.5 }}>
      <FormControl fullWidth size="small" margin="dense">
        <InputLabel id="trigger-option-label">触发方式</InputLabel>
        <Select
          labelId="trigger-option-label"
          value={triggerOptionValue}
          onChange={handleTriggerOptionChange}
          label="触发方式"
        >
          <MenuItem disabled value="">
            <em>请选择触发方式</em>
          </MenuItem>
          
          <MenuItem disabled>
            <em>-- 基于时间 --</em>
          </MenuItem>
          {TRIGGER_OPTIONS.filter(opt => opt.triggerType === TriggerType.TIME).map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
          
          <MenuItem disabled>
            <em>-- 基于事件 --</em>
          </MenuItem>
          {TRIGGER_OPTIONS.filter(opt => opt.triggerType === TriggerType.EVENT).map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {renderAdditionalConfig()}
    </Box>
  );
};

export default TaskTriggerForm;