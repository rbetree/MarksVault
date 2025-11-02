import { SxProps, Theme } from '@mui/material';

/**
 * 任务配置页面的样式定义
 */
export const taskConfigStyles = {
  // 页面容器：全屏高度，flex布局
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    bgcolor: 'background.default',
  } as SxProps<Theme>,

  // 内容区域：可滚动
  contentArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    py: 3,
    px: 2,
  } as SxProps<Theme>,

  // 表单容器：最大宽度800px，居中
  formContainer: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as SxProps<Theme>,

  // 表单部分：使用Paper组件
  formSection: {
    p: 2.5,
    borderRadius: 2,
  } as SxProps<Theme>,

  // 加载容器：居中显示
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: 2,
  } as SxProps<Theme>,

  // 错误容器：居中显示
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: 2,
    px: 3,
  } as SxProps<Theme>,

  // 错误文本
  errorText: {
    color: 'error.main',
    textAlign: 'center',
    maxWidth: '600px',
  } as SxProps<Theme>,
};