import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import NotificationsIcon from '@mui/icons-material/Notifications';
import WebIcon from '@mui/icons-material/Web';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { Trigger, TriggerType, EventType } from '../../../types/task';
import { formatTimestamp } from '../../../utils/date-utils';

interface TaskTriggerInfoProps {
  trigger: Trigger;
  compact?: boolean;
}

/**
 * 任务触发器信息组件
 * 显示任务的触发条件信息
 */
const TaskTriggerInfo: React.FC<TaskTriggerInfoProps> = ({ trigger, compact = false }) => {
  // 获取事件图标
  const getEventIcon = (eventType: EventType) => {
    switch (eventType) {
      case EventType.BROWSER_STARTUP:
      case EventType.EXTENSION_CLICKED:
        return <WebIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />;
        
      case EventType.BOOKMARK_CHANGED:
        return <BookmarkIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />;
        
      default:
        return <NotificationsIcon fontSize="small" color="action" sx={{ fontSize: '14px' }} />;
    }
  };

  // 获取事件类型文本描述
  const getEventTypeText = (eventType: EventType): string => {
    switch (eventType) {
      case EventType.BROWSER_STARTUP:
        return '浏览器启动时';
      case EventType.EXTENSION_CLICKED:
        return '扩展图标点击时';
        
      case EventType.BOOKMARK_CHANGED:
        return '书签变更时';
        
      default:
        return '未知事件类型';
    }
  };

  // 获取条件描述
  const getConditionsDescription = (conditions?: Record<string, any>): React.ReactNode => {
    if (!conditions || Object.keys(conditions).length === 0) {
      return null;
    }
    
    const conditionsChips = [];
    
    // URL条件
    if (conditions.url) {
      conditionsChips.push(
        <Chip 
          key="url" 
          size="small" 
          label={`URL包含: ${conditions.url}`} 
          variant="outlined" 
          sx={{ fontSize: '10px' }}
        />
      );
    }
    
    // 标题条件
    if (conditions.title) {
      conditionsChips.push(
        <Chip 
          key="title" 
          size="small" 
          label={`标题包含: ${conditions.title}`} 
          variant="outlined" 
          sx={{ fontSize: '10px' }}
        />
      );
    }
    
    // 父文件夹条件
    if (conditions.parentFolder) {
      conditionsChips.push(
        <Chip 
          key="parentFolder" 
          size="small" 
          label={`文件夹ID: ${conditions.parentFolder}`} 
          variant="outlined" 
          sx={{ fontSize: '10px' }}
        />
      );
    }
    
    if (conditionsChips.length === 0) {
      return null;
    }
    
    return (
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <FilterAltIcon fontSize="small" color="action" sx={{ fontSize: '12px' }} />
          <Typography variant="body2" sx={{ ml: 0.5, fontSize: '11px' }}>
            条件过滤:
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ ml: 3, flexWrap: 'wrap', gap: '4px' }}>
          {conditionsChips}
        </Stack>
      </Box>
    );
  };

  // 渲染事件触发器信息
  const renderEventTrigger = () => {
    const { event, conditions } = trigger;
    const eventTitle = getEventTypeText(event);
    const eventIcon = getEventIcon(event);
    
    if (compact) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {eventIcon}
          <Typography variant="body2" sx={{ ml: 0.75, fontSize: '11px' }}>
            事件: {eventTitle}
          </Typography>
          {conditions && Object.keys(conditions).length > 0 && (
            <FilterAltIcon fontSize="small" color="action" sx={{ ml: 0.5, fontSize: '12px' }} />
          )}
        </Box>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          {eventIcon}
          <Typography variant="subtitle2" sx={{ ml: 0.75, fontSize: '12px' }}>
            事件触发
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: '11px' }}>
          {eventTitle}
        </Typography>
        
        {/* 显示条件信息 */}
        {getConditionsDescription(conditions)}
        
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