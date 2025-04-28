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
  mb: 2,
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
  py: 1
};

// 任务列表头部
export const taskHeaderStyles: SxProps<Theme> = {
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  mb: 2
};

// 过滤器容器样式
export const filterContainerStyles: SxProps<Theme> = {
  display: 'flex', 
  gap: 1, 
  flexWrap: 'wrap'
};

// 悬浮按钮样式
export const fabStyles: SxProps<Theme> = {
  position: 'fixed',
  bottom: 80, // 考虑底部导航栏的高度
  right: 16,
  zIndex: 1000,
  boxShadow: 3 // 增加阴影效果，提高视觉层级
};

// 日期显示样式
export const dateDisplayStyles: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'center',
  color: 'text.secondary',
  fontSize: '0.75rem',
  mt: 1
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