import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { Trigger, TriggerType, EventType } from '../../../types/task';

interface TaskTriggerInfoProps {
  trigger: Trigger;
  compact?: boolean;
}

/**
 * 任务触发器信息组件
 * 显示任务的触发条件信息
 */
const TaskTriggerInfo: React.FC<TaskTriggerInfoProps> = ({ trigger, compact = false }) => {
  // 将时间戳转换为日期字符串
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '未指定';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 渲染事件触发器信息
  const renderEventTrigger = () => {
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

  return renderEventTrigger();
};

export default TaskTriggerInfo; 