import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FolderIcon from '@mui/icons-material/Folder';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { styled } from '@mui/material/styles';
import { BookmarkItem as BookmarkItemType } from '../../utils/bookmark-service';
import { getFaviconUrl } from '../../utils/favicon-service';
import bookmarkService from '../../utils/bookmark-service';

// 拖拽数据类型 - 与BookmarkItem保持一致
const DRAG_TYPE = 'application/marksvault-bookmark';

// 样式化组件
const GridItemContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isOver' && prop !== 'isFolder'
})<{ isOver?: boolean; isFolder?: boolean }>(({ theme, isOver, isFolder }) => ({
  width: '80px',
  minHeight: '90px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1),
  margin: theme.spacing(0.5, 0),
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s ease-in-out',
  position: 'relative',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    transform: 'translateY(-2px)',
  },
  ...(isOver && isFolder && {
    backgroundColor: theme.palette.action.selected,
    boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
    transform: 'translateY(-2px) scale(1.05)',
    '& .MuiSvgIcon-root': {
      color: theme.palette.primary.main,
      transform: 'scale(1.1)',
      transition: 'transform 0.15s ease-in-out',
    },
  }),
}));

const IconContainer = styled(Box)(({ theme }) => ({
  width: '48px',
  height: '48px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: theme.spacing(1),
  overflow: 'hidden',
}));

const ItemTitle = styled(Typography)(({ theme }) => ({
  fontSize: '12px',
  fontWeight: 400,
  maxWidth: '80px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginTop: theme.spacing(0.5),
  lineHeight: 1.2,
}));

const ItemCount = styled(Typography)(({ theme }) => ({
  fontSize: '10px',
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(0.2),
  marginRight: theme.spacing(0.5),
}));

// 修改按钮样式，移除绝对定位
const MenuButton = styled(IconButton)(({ theme }) => ({
  padding: 1,
  fontSize: '1rem',
  color: theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  }
}));

// 添加一个容器用于包装计数和菜单按钮
const InfoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: theme.spacing(0.2),
}));

// 添加左侧位置指示器样式
const LeftPositionIndicator = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: '2px',
  backgroundColor: theme.palette.primary.main,
  zIndex: 1,
  height: '100%',
}));

// 添加右侧位置指示器样式
const RightPositionIndicator = styled('div')(({ theme }) => ({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: '2px',
  backgroundColor: theme.palette.primary.main,
  zIndex: 1,
  height: '100%',
}));

// 交互模式类型
type InteractionMode = 'sort' | 'move';
// 拖放位置类型
type DropPosition = 'left' | 'right' | 'center';

interface BookmarkGridItemProps {
  bookmark: BookmarkItemType;
  onEdit?: (bookmark: BookmarkItemType) => void;
  onDelete?: (bookmark: BookmarkItemType) => void;
  onOpen?: (bookmark: BookmarkItemType) => void;
  onOpenFolder?: (bookmark: BookmarkItemType) => void;
  onMoveBookmark?: (bookmarkId: string, destinationFolderId: string, index?: number) => Promise<boolean>;
}

const BookmarkGridItem: React.FC<BookmarkGridItemProps> = ({
  bookmark,
  onEdit,
  onDelete,
  onOpen,
  onOpenFolder,
  onMoveBookmark
}) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [iconUrl, setIconUrl] = useState<string>('');
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isOver, setIsOver] = useState<boolean>(false); // 拖拽悬停状态
  const [dropPosition, setDropPosition] = useState<DropPosition>('center'); // 拖拽位置
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('move'); // 交互模式
  const isMenuOpen = Boolean(menuAnchorEl);

  // 定义拖拽区域边缘宽度（像素）
  const EDGE_WIDTH = 20;

  // 加载网站图标
  useEffect(() => {
    if (!bookmark.isFolder && bookmark.url) {
      setIconUrl(getFaviconUrl(bookmark.url));
    }
  }, [bookmark.url, bookmark.isFolder]);

  // 当组件挂载或书签ID变化时，获取文件夹项目计数
  useEffect(() => {
    if (bookmark.isFolder) {
      const fetchItemCount = async () => {
        const result = await bookmarkService.getFolderItemCount(bookmark.id);
        if (result.success) {
          setItemCount(result.data);
        }
      };
      
      fetchItemCount();
    }
  }, [bookmark.id, bookmark.isFolder]);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleItemClick = () => {
    if (bookmark.isFolder && onOpenFolder) {
      onOpenFolder(bookmark);
    } else if (!bookmark.isFolder && bookmark.url && onOpen) {
      onOpen(bookmark);
    }
  };

  // 拖拽开始处理
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    // 设置拖拽数据，包括书签和文件夹
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      isFolder: bookmark.isFolder,
      parentId: bookmark.parentId,
      index: bookmark.index
    }));
    
    // 设置拖拽效果
    event.dataTransfer.effectAllowed = 'move';
  };

  // 确定拖拽位置和交互模式
  const determineDropPositionAndMode = (event: React.DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const elementWidth = rect.width;
    
    // 根据鼠标在元素上的水平位置判断
    if (mouseX < EDGE_WIDTH) {
      // 靠近左边缘，显示左侧指示器
      setDropPosition('left');
      setInteractionMode('sort');
    } else if (mouseX > elementWidth - EDGE_WIDTH) {
      // 靠近右边缘，显示右侧指示器
      setDropPosition('right');
      setInteractionMode('sort');
    } else {
      // 在中央区域
      setDropPosition('center');
      // 如果是文件夹，则使用移动模式；否则使用排序模式
      setInteractionMode(bookmark.isFolder ? 'move' : 'sort');
    }
  };

  // 拖拽悬停处理（文件夹可以接收拖拽项，非文件夹用于排序）
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    // 检查是否有正确的数据类型
    if (event.dataTransfer.types.includes(DRAG_TYPE)) {
      event.preventDefault(); // 允许放置
      event.dataTransfer.dropEffect = 'move';
      
      // 确定拖拽位置和交互模式
      determineDropPositionAndMode(event);
      
      // 更新悬停状态
      setIsOver(true);
    }
  };

  // 拖拽进入处理
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(DRAG_TYPE)) {
      event.preventDefault();
      
      // 确定拖拽位置和交互模式
      determineDropPositionAndMode(event);
      
      // 设置悬停状态为true
      setIsOver(true);
    }
  };

  // 拖拽离开处理
  const handleDragLeave = () => {
    setIsOver(false); // 设置悬停状态为false
    setInteractionMode('move'); // 重置交互模式
    setDropPosition('center'); // 重置拖拽位置
  };

  // 拖拽放置处理
  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // 重置状态
    setIsOver(false);
    
    try {
      const dragData = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
      
      // 确保不是拖自身
      if (dragData.id === bookmark.id) {
        return;
      }
      
      if (onMoveBookmark) {
        if (interactionMode === 'move' && bookmark.isFolder) {
          // 情况1: 移动模式 - 放置在文件夹中心，将项目移入文件夹
          await onMoveBookmark(dragData.id, bookmark.id);
        } else if (interactionMode === 'sort' && bookmark.parentId) {
          // 情况2: 排序模式 - 放置在项目边缘，在同级项目之间重新排序
          // 计算目标索引
          let targetIndex = bookmark.index ?? 0;
          
          // 如果放在右侧，则索引增加1
          if (dropPosition === 'right') {
            targetIndex += 1;
          }
          
          await onMoveBookmark(dragData.id, bookmark.parentId, targetIndex);
        }
      }
    } catch (error) {
      console.error('拖放处理错误:', error);
    } finally {
      // 重置交互状态
      setInteractionMode('move');
      setDropPosition('center');
    }
  };

  const handleEdit = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    if (onEdit) {
      onEdit(bookmark);
    }
  };

  const handleDelete = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    if (onDelete) {
      onDelete(bookmark);
    }
  };

  const handleOpenInNewTab = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    if (bookmark.url) {
      chrome.tabs.create({ url: bookmark.url });
    }
  };

  const handleOpenAllInNewTabs = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    
    if (bookmark.isFolder) {
      // 获取文件夹中的所有书签
      const result = await bookmarkService.getBookmarksInFolder(bookmark.id);
      if (result.success && result.data) {
        // 打开所有有URL的项
        result.data.forEach((item: BookmarkItemType) => {
          if (item.url) {
            chrome.tabs.create({ url: item.url });
          }
        });
      }
    }
  };

  const handleExportFolder = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    
    if (bookmark.isFolder) {
      // 实现文件夹导出逻辑
      alert(`导出文件夹功能正在开发中...`);
    }
  };

  return (
    <GridItemContainer 
      onClick={handleItemClick}
      draggable={true} // 所有项目都可拖拽，包括文件夹
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      isOver={isOver && interactionMode === 'move'} // 只有在移动模式下才应用全局高亮
      isFolder={bookmark.isFolder}
    >
      {/* 根据交互模式和拖拽位置显示不同的指示器 */}
      {isOver && interactionMode === 'sort' && (
        <>
          {dropPosition === 'left' && <LeftPositionIndicator />}
          {dropPosition === 'right' && <RightPositionIndicator />}
        </>
      )}
      
      <IconContainer>
        {bookmark.isFolder ? (
          <FolderIcon sx={{ fontSize: 48, color: isOver && interactionMode === 'move' ? 'primary.main' : 'primary.main' }} />
        ) : (
          iconUrl ? (
            <img 
              src={iconUrl} 
              alt={bookmark.title} 
              style={{ maxWidth: '100%', maxHeight: '100%' }} 
            />
          ) : (
            <img 
              src={chrome.runtime.getURL('assets/icons/default-favicon.png')} 
              alt={bookmark.title} 
              style={{ maxWidth: '100%', maxHeight: '100%' }} 
              onError={(e) => {
                // 如果默认图标加载失败，使用占位符
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )
        )}
      </IconContainer>

      <ItemTitle title={bookmark.title}>
        {bookmark.title}
      </ItemTitle>

      <InfoContainer>
        {bookmark.isFolder && itemCount !== null && (
          <ItemCount>{itemCount} 项</ItemCount>
        )}
        <MenuButton 
          size="small" 
          onClick={handleMenuClick}
        >
          <MoreHorizIcon fontSize="small" />
        </MenuButton>
      </InfoContainer>

      <Menu
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>编辑</ListItemText>
        </MenuItem>
        {!bookmark.isFolder && bookmark.url && (
          <MenuItem onClick={handleOpenInNewTab}>
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>新标签页打开</ListItemText>
          </MenuItem>
        )}
        {bookmark.isFolder && (
          <MenuItem onClick={handleOpenAllInNewTabs}>
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>在新标签页中打开所有</ListItemText>
          </MenuItem>
        )}
        {bookmark.isFolder && (
          <MenuItem onClick={handleExportFolder}>
            <ListItemIcon>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>导出文件夹</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>删除</ListItemText>
        </MenuItem>
      </Menu>
    </GridItemContainer>
  );
};

export default BookmarkGridItem; 