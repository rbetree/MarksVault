import { Theme } from '@mui/material/styles';

// 创建Grid视图的样式
const gridStyles = (theme: Theme) => ({
  // 网格容器样式
  gridContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    padding: theme.spacing(1),
    justifyContent: 'start',
    width: '100%',
    overflowY: 'auto',
    gap: theme.spacing(2),
  },
  
  // 单个网格项样式
  gridItem: {
    width: '100px',
    minHeight: '110px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1),
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      transform: 'translateY(-3px)',
      boxShadow: theme.shadows[2],
    },
  },
  
  // 图标样式
  iconContainer: {
    backgroundColor: theme.palette.background.paper,
    borderRadius: '12px',
    width: '64px',
    height: '64px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
    boxShadow: theme.shadows[1],
    overflow: 'hidden',
  },
  
  // 文件夹图标样式
  folderIcon: {
    color: theme.palette.primary.main,
    fontSize: '36px',
  },
  
  // 书签图标样式
  bookmarkIconImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  
  // 标题样式
  itemTitle: {
    fontSize: '13px',
    fontWeight: 500,
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: theme.spacing(0.5),
    lineHeight: 1.2,
  },
  
  // 网格项透明样式（用于拖放时）
  gridItemTransparent: {
    opacity: 0.5,
  },
  
  // 网格项活动样式（用于选中或拖放时）
  gridItemActive: {
    backgroundColor: theme.palette.action.selected,
  },
  
  // 右键菜单图标样式
  menuIcon: {
    position: 'absolute',
    top: '5px',
    right: '5px',
    opacity: 0,
    transition: 'opacity 0.2s',
    backgroundColor: theme.palette.background.paper,
    borderRadius: '50%',
    padding: '2px',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  
  // 鼠标悬停时显示菜单图标
  gridItemWithMenu: {
    position: 'relative',
    '&:hover $menuIcon': {
      opacity: 1,
    },
  },
  
  // 空状态样式
  emptyState: {
    width: '100%',
    textAlign: 'center',
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  
  // 导航区域样式
  navigationArea: {
    padding: theme.spacing(1, 2),
    display: 'flex',
    alignItems: 'center',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  
  // 导航标题样式
  navigationTitle: {
    marginLeft: theme.spacing(1),
    fontWeight: 500,
  },
});

export default gridStyles; 