import { Theme } from '@mui/material/styles';
import { SxProps } from '@mui/system';
import { TaskStatus } from '../../types/task';

/**
 * 任务UI共享样式
 * 为任务相关组件提供一致的视觉风格
 */

// 根据任务状态返回对应的主色
export const getTaskStatusColor = (status: TaskStatus, theme: Theme): string => {
  switch (status) {
    case TaskStatus.ENABLED:
      return theme.palette.success.main;
    case TaskStatus.RUNNING:
      return theme.palette.primary.main;
    case TaskStatus.FAILED:
      return theme.palette.error.main;
    case TaskStatus.COMPLETED:
      return theme.palette.info.main;
    case TaskStatus.DISABLED:
    default:
      return theme.palette.text.disabled;
  }
};

// 任务卡片样式
export const taskCardStyles: SxProps<Theme> = {
  mb: 1.5,
  transition: 'all 0.2s',
  borderLeft: '4px solid',
  '&:hover': {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
  }
};

// 根据任务状态返回卡片的边框样式
export const getTaskCardBorderStyle = (status: TaskStatus): SxProps<Theme> => ({
  borderLeftColor: (theme) => getTaskStatusColor(status, theme)
});

// 任务列表项样式
export const taskListItemStyles: SxProps<Theme> = {
  borderLeft: '4px solid',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)'
  },
  py: 0.75
};

// 任务列表头部
export const taskHeaderStyles: SxProps<Theme> = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  mb: 1.5
};

// 过滤器容器样式
export const filterContainerStyles: SxProps<Theme> = {
  display: 'flex',
  gap: 0.75,
  flexWrap: 'wrap'
};

// 悬浮按钮样式
export const fabStyles: SxProps<Theme> = {
  position: 'fixed',
  bottom: 80,
  right: 16,
  zIndex: 1000,
  boxShadow: 3
};

// 全局通用悬浮按钮样式
export const globalFabStyles: SxProps<Theme> = {
  position: 'fixed',
  bottom: 80,
  right: 16,
  zIndex: 1000,
  boxShadow: 3,
  size: 'medium'
};

// 日期显示样式
export const dateDisplayStyles: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'center',
  color: 'text.secondary',
  fontSize: '0.7rem',
  mt: 0.75
};

// 表单字段容器样式
export const formFieldContainerStyles: SxProps<Theme> = {
  mt: 2,
  mb: 2
};

// 表单分隔符样式
export const formDividerStyles: SxProps<Theme> = {
  my: 2
};

// 表单分组标题样式
export const formSectionTitleStyles: SxProps<Theme> = {
  fontWeight: 500,
  mt: 2,
  mb: 1
};

// 表单操作按钮样式
export const formButtonStyles: SxProps<Theme> = {
  mr: 1
};

// 表单操作面板样式
export const formActionsStyles: SxProps<Theme> = {
  display: 'flex',
  justifyContent: 'flex-end',
  pt: 2,
  pb: 1
};

// 表单错误文本样式
export const formErrorTextStyles: SxProps<Theme> = {
  color: 'error.main',
  my: 1
};

// 任务执行历史记录样式
export const taskHistorySectionStyles: SxProps<Theme> = {
  mt: 1,
  pt: 0.5
};

// 任务执行历史记录标题样式
export const taskHistoryTitleStyles: SxProps<Theme> = {
  fontSize: '10px',
  fontWeight: 500,
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  mb: 0.5
};

// 任务执行历史记录项样式
export const taskHistoryItemStyles: SxProps<Theme> = {
  py: 0.5,
  px: 0.5,
  borderRadius: 1,
  mb: 0.5,
  fontSize: '10px',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)'
  }
};

// 执行成功的历史记录项样式
export const taskHistorySuccessStyles: SxProps<Theme> = {
  color: 'success.main'
};

// 执行失败的历史记录项样式
export const taskHistoryFailedStyles: SxProps<Theme> = {
  color: 'error.main'
};

// 任务执行历史记录详情样式
export const taskHistoryDetailStyles: SxProps<Theme> = {
  px: 1,
  py: 0.5,
  fontSize: '9px',
  backgroundColor: 'rgba(0, 0, 0, 0.02)',
  borderRadius: 1,
  mt: 0.5
};

// 任务执行历史记录空提示样式
export const taskHistoryEmptyStyles: SxProps<Theme> = {
  color: 'text.disabled',
  fontSize: '9px',
  fontStyle: 'italic',
  textAlign: 'center',
  py: 0.5
};

/**
 * 安全合并多个SxProps样式对象
 * 解决TypeScript类型兼容性问题
 */
export const combineStyles = <T extends Theme = Theme>(
  ...styles: Array<SxProps<T> | undefined | null>
): SxProps<T> => {
  // 过滤掉undefined和null
  const validStyles = styles.filter(style => style !== undefined && style !== null) as SxProps<T>[];

  // 如果没有有效样式，返回空对象
  if (validStyles.length === 0) {
    return {} as SxProps<T>;
  }

  // 如果只有一个有效样式，直接返回它
  if (validStyles.length === 1) {
    return validStyles[0];
  }

  // 合并所有样式
  return validStyles.reduce((acc, style) => ({ ...acc, ...style }), {} as SxProps<T>);
}; 