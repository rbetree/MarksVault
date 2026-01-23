import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LinkIcon from '@mui/icons-material/Link';
import { styled } from '@mui/material/styles';
import { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';
import { getFaviconUrl } from '../../../utils/favicon-service';
import bookmarkService from '../../../utils/bookmark-service';

// 拖拽数据类型 - 与BookmarkItem保持一致
const DRAG_TYPE = 'application/marksvault-bookmark';

// 样式化组件
const GridItemContainer = styled(Box)(({ theme }) => ({
  width: '60px',
  minHeight: '72px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.25, 0.25),
  margin: theme.spacing(0.1, 0),
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s ease-in-out',
  position: 'relative',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    transform: 'translateY(-1px)',
  },
  '&[data-isover="true"][data-isfolder="true"]': {
    backgroundColor: theme.palette.action.selected,
    boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
    transform: 'translateY(-2px) scale(1.05)',
    '& .MuiSvgIcon-root': {
      color: theme.palette.primary.main,
      transform: 'scale(1.1)',
      transition: 'transform 0.15s ease-in-out',
    },
  },
}));

const IconContainer = styled(Box)(({ theme }) => ({
  width: '40px',
  height: '40px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: theme.spacing(0.2),
  overflow: 'hidden',
}));

const ItemTitle = styled(Typography)(({ theme }) => ({
  fontSize: '11px',
  fontWeight: 400,
  maxWidth: '60px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginTop: theme.spacing(0.1),
  lineHeight: 1.4, // 确保 g 显示完整
}));

const ItemCount = styled(Typography)(({ theme }) => ({
  fontSize: '10px',
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(0.1),
  lineHeight: 1.4,
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
  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const [iconUrl, setIconUrl] = useState<string>('');
  const [iconError, setIconError] = useState<boolean>(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isOver, setIsOver] = useState<boolean>(false); // 拖拽悬停状态
  const [dropPosition, setDropPosition] = useState<DropPosition>('center'); // 拖拽位置
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('move'); // 交互模式
  const isMenuOpen = Boolean(menuAnchorPosition);

  // 定义拖拽区域边缘宽度（像素）
  const EDGE_WIDTH = 20;

  // 加载网站图标
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

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuAnchorPosition({
      top: event.clientY,
      left: event.clientX,
    });
  };

  const handleMenuClose = () => {
    setMenuAnchorPosition(null);
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

  // 处理图标加载失败
  const handleIconError = () => {
    setIconError(true);
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
      onContextMenu={handleContextMenu}
      data-isover={isOver && interactionMode === 'move'} // 使用data-*属性
      data-isfolder={bookmark.isFolder} // 使用data-*属性
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
          <FolderIcon sx={{ fontSize: 40, color: isOver && interactionMode === 'move' ? 'primary.main' : 'primary.main' }} />
        ) : (
          iconUrl && !iconError ? (
            <img
              src={iconUrl}
              alt={bookmark.title}
              style={{ maxWidth: '100%', maxHeight: '100%' }}
              onError={handleIconError}
            />
          ) : (
            <LinkIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
          )
        )}
      </IconContainer>

      <ItemTitle title={bookmark.title}>
        {bookmark.title}
      </ItemTitle>

      {bookmark.isFolder && (
        <ItemCount sx={{ minHeight: '1.2em' }}>
          {itemCount !== null ? `${itemCount} 项` : ' '}
        </ItemCount>
      )}

      <Menu
        open={isMenuOpen}
        onClose={handleMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={menuAnchorPosition || undefined}
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