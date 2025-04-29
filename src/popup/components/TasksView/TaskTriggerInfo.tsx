import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import RepeatIcon from '@mui/icons-material/Repeat';
import TodayIcon from '@mui/icons-material/Today';
import DateRangeIcon from '@mui/icons-material/DateRange';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { Trigger, TriggerType, TimeScheduleType, EventType } from '../../../types/task';

interface TaskTriggerInfoProps {
  trigger: Trigger;
  compact?: boolean;
}

/**
 * 任务触发器信息组件
 * 显示任务的触发条件信息
 */
const TaskTriggerInfo: React.FC<TaskTriggerInfoProps> = ({ trigger, compact = false }) => {
  // 格式化时间为HH:MM格式
  const formatTime = (hour?: number, minute?: number) => {
    if (hour === undefined || minute === undefined) return '--:--';
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // 获取周几的文本表示
  const getDayOfWeekText = (day?: number) => {
    if (day === undefined) return '未指定';
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[day];
  };

  // 将时间戳转换为日期字符串
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '未指定';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 渲染时间触发器信息
  const renderTimeTrigger = () => {
    if (trigger.type !== TriggerType.TIME) return null;

    const { schedule } = trigger;
    
    let icon = <AccessTimeIcon fontSize="small" color="action" />;
    let title = '未知时间类型';
    let description = '未指定';

    switch (schedule.type) {
      case TimeScheduleType.ONCE:
        icon = <EventIcon fontSize="small" color="action" />;
        title = '一次性';
        description = formatTimestamp(schedule.when);
        break;
        
      case TimeScheduleType.INTERVAL:
        icon = <RepeatIcon fontSize="small" color="action" />;
        title = '定时间隔';
        description = schedule.intervalMinutes 
          ? `每 ${schedule.intervalMinutes} 分钟`
          : '未指定间隔';
        break;
        
      case TimeScheduleType.DAILY:
        icon = <TodayIcon fontSize="small" color="action" />;
        title = '每天';
        description = `每天 ${formatTime(schedule.hour, schedule.minute)}`;
        break;
        
      case TimeScheduleType.WEEKLY:
        icon = <DateRangeIcon fontSize="small" color="action" />;
        title = '每周';
        description = `每 ${getDayOfWeekText(schedule.dayOfWeek)} ${formatTime(schedule.hour, schedule.minute)}`;
        break;
        
      case TimeScheduleType.MONTHLY:
        icon = <CalendarMonthIcon fontSize="small" color="action" />;
        title = '每月';
        description = `每月 ${schedule.dayOfMonth || '?'} 日 ${formatTime(schedule.hour, schedule.minute)}`;
        break;
    }

    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {React.cloneElement(icon, { fontSize: 'small', sx: { fontSize: '14px' } })}
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            {title}: {description}
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          {React.cloneElement(icon, { fontSize: 'small', sx: { fontSize: '14px' } })}
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          {description}
        </Typography>
        {trigger.nextTrigger && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, mt: 0.5, fontSize: '11px' }}>
            下次执行: {formatTimestamp(trigger.nextTrigger)}
          </Typography>
        )}
      </Box>
    );
  };

  // 渲染事件触发器信息
  const renderEventTrigger = () => {
    if (trigger.type !== TriggerType.EVENT) return null;

    const { event } = trigger;
    
    let title = '未知事件类型';
    
    switch (event) {
      case EventType.BROWSER_STARTUP:
        title = '浏览器启动时';
        break;
      case EventType.BOOKMARK_CREATED:
        title = '创建书签时';
        break;
      case EventType.BOOKMARK_REMOVED:
        title = '删除书签时';
        break;
      case EventType.BOOKMARK_CHANGED:
        title = '修改书签时';
        break;
      case EventType.BOOKMARK_MOVED:
        title = '移动书签时';
        break;
    }

    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <NotificationsIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            事件: {title}
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <NotificationsIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            事件触发
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          {title}
        </Typography>
        {trigger.lastTriggered && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, mt: 0.5, fontSize: '11px' }}>
            上次触发: {formatTimestamp(trigger.lastTriggered)}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <>
      {trigger.type === TriggerType.TIME ? renderTimeTrigger() : renderEventTrigger()}
    </>
  );
};

export default TaskTriggerInfo; 