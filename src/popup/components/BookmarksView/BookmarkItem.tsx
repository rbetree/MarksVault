import React, { useState, useEffect } from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemButton from '@mui/material/ListItemButton';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LinkIcon from '@mui/icons-material/Link';
import { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';
import { getFaviconUrl } from '../../../utils/favicon-service';
import bookmarkService from '../../../utils/bookmark-service';
import { styled } from '@mui/material/styles';

// 添加可拖放的文件夹样式
const DropTargetFolder = styled(ListItemButton)(({ theme }) => ({
  transition: 'all 0.15s ease-in-out',
  '&[data-isover="true"]': {
    backgroundColor: theme.palette.action.selected,
    boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
    transform: 'translateY(-1px)',
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.main,
      transform: 'scale(1.1)',
      transition: 'transform 0.15s ease-in-out',
    },
  },
}));

// 添加位置指示器样式
const PositionIndicator = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: 0,
  right: 0,
  height: '2px',
  backgroundColor: theme.palette.primary.main,
  zIndex: 1,
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

// 包装ListItemButton以支持位置指示器
const ItemContainer = styled(ListItemButton)(({ theme }) => ({
  position: 'relative',
  transition: 'all 0.15s ease-in-out',
  '&[data-isover="true"]': {
    backgroundColor: theme.palette.action.hover,
  },
}));

interface BookmarkItemProps {
  bookmark: BookmarkItemType;
  onEdit?: (bookmark: BookmarkItemType) => void;
  onDelete?: (bookmark: BookmarkItemType) => void;
  onOpen?: (bookmark: BookmarkItemType) => void;
  onOpenFolder?: (bookmark: BookmarkItemType) => void;
  onMoveBookmark?: (bookmarkId: string, destinationFolderId: string, index?: number) => Promise<boolean>;
}

// 拖拽数据类型
const DRAG_TYPE = 'application/marksvault-bookmark';

const BookmarkItem: React.FC<BookmarkItemProps> = ({
  bookmark,
  onEdit,
  onDelete,
  onOpen,
  onOpenFolder,
  onMoveBookmark
}) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [iconUrl, setIconUrl] = useState<string>('');
  const [iconError, setIconError] = useState<boolean>(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isOver, setIsOver] = useState<boolean>(false); // 拖拽悬停状态
  const [dropPosition, setDropPosition] = useState<DropPosition>('center'); // 拖拽位置
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('move'); // 交互模式
  const isMenuOpen = Boolean(menuAnchorEl);

  // 定义拖拽区域边缘宽度（像素）
  const EDGE_WIDTH = 40; // 列表视图需要更宽的边缘区域

  useEffect(() => {
    if (!bookmark.isFolder && bookmark.url) {
      setIconUrl(getFaviconUrl(bookmark.url));
      setIconError(false);
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

  // 拖拽悬停处理
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

  const handleIconError = () => {
    setIconError(true);
  };

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <IconButton 
          edge="end" 
          aria-label="操作" 
          onClick={handleMenuClick}
          size="small"
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      }
    >
      {bookmark.isFolder ? (
        <DropTargetFolder 
          onClick={handleItemClick}
          data-isover={isOver && interactionMode === 'move'} // 使用data-*属性
          draggable={true} // 允许文件夹拖拽
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 根据交互模式和拖拽位置显示不同的指示器 */}
          {isOver && interactionMode === 'sort' && (
            <>
              {dropPosition === 'left' && <LeftPositionIndicator />}
              {dropPosition === 'right' && <RightPositionIndicator />}
            </>
          )}
          <ListItemIcon>
            <FolderIcon color={isOver && interactionMode === 'move' ? "primary" : "primary"} />
          </ListItemIcon>
          <ListItemText 
            primary={bookmark.title} 
            secondary={itemCount !== null ? `${itemCount} 项` : ''}
            primaryTypographyProps={{ 
              noWrap: true,
              title: bookmark.title
            }}
          />
        </DropTargetFolder>
      ) : (
        <ItemContainer
          onClick={handleItemClick}
          draggable={true}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-isover={isOver && interactionMode === 'move'} // 使用data-*属性
        >
          {/* 根据交互模式和拖拽位置显示不同的指示器 */}
          {isOver && interactionMode === 'sort' && (
            <>
              {dropPosition === 'left' && <LeftPositionIndicator />}
              {dropPosition === 'right' && <RightPositionIndicator />}
            </>
          )}
          <ListItemIcon>
            {iconUrl && !iconError ? (
              <img 
                src={iconUrl} 
                alt={bookmark.title}
                style={{ width: '24px', height: '24px' }}
                onError={handleIconError}
              />
            ) : (
              <LinkIcon color="secondary" />
            )}
          </ListItemIcon>
          <ListItemText 
            primary={bookmark.title} 
            secondary={bookmark.url}
            primaryTypographyProps={{ 
              noWrap: true,
              title: bookmark.title
            }}
            secondaryTypographyProps={{ 
              noWrap: true,
              title: bookmark.url
            }}
          />
        </ItemContainer>
      )}

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
    </ListItem>
  );
};

export default BookmarkItem; 