import type { SxProps, Theme } from '@mui/material/styles';

/**
 * 任务配置页面的样式定义 - Updated for Premium Redesign
 */
export const taskConfigStyles = {
  // 页面根容器
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    bgcolor: '#0A0A0A', // Deep dark background
    color: '#E0E0E0',
  } as SxProps<Theme>,

  // 页面容器 (兼容旧代码)
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    bgcolor: '#0A0A0A',
  } as SxProps<Theme>,

  // 自定义头部容器（Outer）
  headerOuter: {
    height: 72, // Slightly taller for premium feel
    px: 4,
    display: 'flex',
    justifyContent: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 1100,
    bgcolor: 'rgba(10, 10, 10, 0.8)', // Translucent
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
  } as SxProps<Theme>,

  // 自定义头部内容（Inner Container）
  headerInner: {
    width: '100%',
    maxWidth: '1200px', // Constrained width for better reading
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as SxProps<Theme>,

  // 内容区域
  contentArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    p: 4,
    display: 'flex',
    justifyContent: 'center',
    // 自定义滚动条
    '&::-webkit-scrollbar': { width: '8px' },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
  } as SxProps<Theme>,

  // 最大宽度容器
  maxWidthContainer: {
    width: '100%',
    maxWidth: '1200px',
  } as SxProps<Theme>,

  // 加载容器
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
    minHeight: '200px',
  } as SxProps<Theme>,

  // 错误容器
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
    flexDirection: 'column',
    gap: 2,
    p: 3,
  } as SxProps<Theme>,

  // 错误文本
  errorText: {
    color: 'error.main',
    textAlign: 'center',
    maxWidth: '600px',
  } as SxProps<Theme>,
};
