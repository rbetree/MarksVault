import React, { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
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
import bookmarkService, { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';
import { getFaviconUrl } from '../../../utils/favicon-service';
import { useBookmarkDragDrop } from './useBookmarkDragDrop';

// 样式化组件
const GridItemContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  minHeight: '68px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.5),
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s ease-in-out',
  position: 'relative',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    transform: 'translateY(-1px)',
    boxShadow: theme.shadows[2],
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
  width: '36px',
  height: '36px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: theme.spacing(0.2),
  overflow: 'hidden',
}));

const ItemTitle = styled(Typography)(({ theme }) => ({
  fontSize: '12px',
  fontWeight: 400,
  maxWidth: '52px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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

interface BookmarkGridItemProps {
  bookmark: BookmarkItemType;
  index: number; // Visual index
  isSearching?: boolean;
  resolveBookmarkPath?: (bookmarkId: string) => Promise<string>;
  onEdit?: (bookmark: BookmarkItemType) => void;
  onDelete?: (bookmark: BookmarkItemType) => void;
  onOpen?: (bookmark: BookmarkItemType) => void;
  onOpenFolder?: (bookmark: BookmarkItemType) => void;
  onMoveBookmark?: (bookmarkId: string, destinationFolderId: string, index?: number) => Promise<boolean>;
}

const BookmarkGridItem: React.FC<BookmarkGridItemProps> = ({
  bookmark,
  index,
  isSearching = false,
  resolveBookmarkPath,
  onEdit,
  onDelete,
  onOpen,
  onOpenFolder,
  onMoveBookmark
}) => {
  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const [iconUrl, setIconUrl] = useState<string>('');
  const [iconError, setIconError] = useState<boolean>(false);
  const isMenuOpen = Boolean(menuAnchorPosition);
  const [pathTitle, setPathTitle] = useState<string>('');
  const resolvingPathRef = useRef(false);

  // 文件夹子项数量：优先使用已加载树上的 children.length（禁止在 item 级别额外打 API）
  const folderItemCount = bookmark.isFolder && Array.isArray(bookmark.children)
    ? bookmark.children.length
    : null;

  // 搜索态：hover 时懒计算路径并写入 title tooltip
  useEffect(() => {
    setPathTitle('');
    resolvingPathRef.current = false;
  }, [bookmark.id, bookmark.title, bookmark.parentId, isSearching]);

  const handleMouseEnter = () => {
    if (!isSearching || !resolveBookmarkPath) return;
    if (pathTitle || resolvingPathRef.current) return;
    resolvingPathRef.current = true;

    resolveBookmarkPath(bookmark.id)
      .then(path => {
        if (path) setPathTitle(path);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        resolvingPathRef.current = false;
      });
  };

  // 使用自定义 Hook 处理拖拽逻辑
  const {
    isOver,
    dropPosition,
    interactionMode,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop
  } = useBookmarkDragDrop({
    bookmark,
    layoutType: 'grid',
    index,
    onMoveBookmark
  });

  // 加载网站图标
  useEffect(() => {
    if (!bookmark.isFolder && bookmark.url) {
      setIconUrl(getFaviconUrl(bookmark.url));
      setIconError(false);
    }
  }, [bookmark.url, bookmark.isFolder]);


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

  const handleEditClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    if (onEdit) {
      onEdit(bookmark);
    }
  };

  const handleDeleteClick = (event: React.MouseEvent<HTMLElement>) => {
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
      browser.tabs.create({ url: bookmark.url });
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
            browser.tabs.create({ url: item.url });
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
      onMouseEnter={handleMouseEnter}
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
          <FolderIcon sx={{ fontSize: 36, color: isOver && interactionMode === 'move' ? 'primary.main' : 'primary.main' }} />
        ) : (
          iconUrl && !iconError ? (
            <img
              src={iconUrl}
              alt={bookmark.title}
              style={{ maxWidth: '100%', maxHeight: '100%' }}
              onError={handleIconError}
            />
          ) : (
            <LinkIcon sx={{ fontSize: 36, color: 'secondary.main' }} />
          )
        )}
      </IconContainer>

      <ItemTitle title={isSearching && pathTitle ? pathTitle : bookmark.title}>
        {bookmark.title}
      </ItemTitle>

      <Menu
        open={isMenuOpen}
        onClose={handleMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={menuAnchorPosition || undefined}
      >
        <MenuItem
          onClick={handleEditClick}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <EditIcon fontSize="small" sx={{ fontSize: '1.1rem' }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.85rem' } }}>编辑</ListItemText>
        </MenuItem>
        {!bookmark.isFolder && bookmark.url && (
          <MenuItem
            onClick={handleOpenInNewTab}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <OpenInNewIcon fontSize="small" sx={{ fontSize: '1.1rem' }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.85rem' } }}>新标签页打开</ListItemText>
          </MenuItem>
        )}
        {bookmark.isFolder && (
          <MenuItem
            onClick={handleOpenAllInNewTabs}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <OpenInNewIcon fontSize="small" sx={{ fontSize: '1.1rem' }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.85rem' } }}>在新标签页中打开所有</ListItemText>
          </MenuItem>
        )}
        {bookmark.isFolder && (
          <MenuItem
            onClick={handleExportFolder}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <FileDownloadIcon fontSize="small" sx={{ fontSize: '1.1rem' }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.85rem' } }}>导出文件夹</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={handleDeleteClick}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <DeleteIcon fontSize="small" sx={{ fontSize: '1.1rem' }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '0.85rem' } }}>删除</ListItemText>
        </MenuItem>
      </Menu>
    </GridItemContainer>
  );
};

export default React.memo(BookmarkGridItem);
