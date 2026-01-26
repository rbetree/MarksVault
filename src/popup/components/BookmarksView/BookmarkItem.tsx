import React, { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemButton from '@mui/material/ListItemButton';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LinkIcon from '@mui/icons-material/Link';
import bookmarkService, { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';
import { getFaviconUrl } from '../../../utils/favicon-service';
import { styled } from '@mui/material/styles';
import { useBookmarkDragDrop } from './useBookmarkDragDrop';

// 添加可拖放的文件夹样式
const DropTargetFolder = styled(ListItemButton)(({ theme }) => ({
  transition: 'all 0.15s ease-in-out',
  padding: theme.spacing(0.1, 0.5),
  minHeight: '40px', // 统一规范高度为 40px
  display: 'flex',
  alignItems: 'center',
  breakInside: 'avoid',
  position: 'relative',
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

// 添加上方位置指示器样式
const TopPositionIndicator = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  height: '2px',
  backgroundColor: theme.palette.primary.main,
  zIndex: 1,
}));

// 添加下方位置指示器样式
const BottomPositionIndicator = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: '2px',
  backgroundColor: theme.palette.primary.main,
  zIndex: 1,
}));

// 包装ListItemButton以支持位置指示器
const ItemContainer = styled(ListItemButton)(({ theme }) => ({
  position: 'relative',
  transition: 'all 0.15s ease-in-out',
  paddingTop: theme.spacing(0.1),
  paddingBottom: theme.spacing(0.1),
  paddingLeft: theme.spacing(0.5),
  paddingRight: theme.spacing(0.5),
  minHeight: '40px', // 统一规范高度为 40px
  display: 'flex',
  alignItems: 'center',
  breakInside: 'avoid',
  '&[data-isover="true"]': {
    backgroundColor: theme.palette.action.hover,
  },
}));

interface BookmarkItemProps {
  bookmark: BookmarkItemType;
  index: number;
  isSearching?: boolean;
  resolveBookmarkPath?: (bookmarkId: string) => Promise<string>;
  onEdit?: (bookmark: BookmarkItemType) => void;
  onDelete?: (bookmark: BookmarkItemType) => void;
  onOpen?: (bookmark: BookmarkItemType) => void;
  onOpenFolder?: (bookmark: BookmarkItemType) => void;
  onMoveBookmark?: (bookmarkId: string, destinationFolderId: string, index?: number) => Promise<boolean>;
}

const BookmarkItem: React.FC<BookmarkItemProps> = ({
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
    layoutType: 'list',
    index,
    onMoveBookmark
  });

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

  const handleIconError = () => {
    setIconError(true);
  };

  return (
    <ListItem
      disablePadding
    >
      {bookmark.isFolder ? (
        <DropTargetFolder
          onClick={handleItemClick}
          onMouseEnter={handleMouseEnter}
          onContextMenu={handleContextMenu}
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
              {dropPosition === 'top' && <TopPositionIndicator />}
              {dropPosition === 'bottom' && <BottomPositionIndicator />}
            </>
          )}
          <ListItemIcon sx={{ minWidth: '32px' }}>
            <FolderIcon sx={{ fontSize: 24 }} color={isOver && interactionMode === 'move' ? "primary" : "primary"} />
          </ListItemIcon>
          <ListItemText
            primary={bookmark.title}
            secondary={bookmark.isFolder ? (folderItemCount !== null ? `${folderItemCount} 项` : ' ') : ''}
            primaryTypographyProps={{
              noWrap: true,
              title: isSearching && pathTitle ? pathTitle : bookmark.title,
              variant: 'body2',
              sx: { fontWeight: 500, lineHeight: 1.4, fontSize: '12px' }
            }}
            secondaryTypographyProps={{
              variant: 'caption',
              sx: { lineHeight: 1.4, minHeight: '1.4em', fontSize: '11px' }
            }}
          />
        </DropTargetFolder>
      ) : (
        <ItemContainer
          onClick={handleItemClick}
          onMouseEnter={handleMouseEnter}
          onContextMenu={handleContextMenu}
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
              {dropPosition === 'top' && <TopPositionIndicator />}
              {dropPosition === 'bottom' && <BottomPositionIndicator />}
            </>
          )}
          <ListItemIcon sx={{ minWidth: '32px' }}>
            {iconUrl && !iconError ? (
              <img
                src={iconUrl}
                alt={bookmark.title}
                style={{ width: '24px', height: '24px' }}
                onError={handleIconError}
              />
            ) : (
              <LinkIcon sx={{ fontSize: 24 }} color="secondary" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={bookmark.title}
            secondary={bookmark.url}
            primaryTypographyProps={{
              noWrap: true,
              title: isSearching && pathTitle ? pathTitle : bookmark.title,
              variant: 'body2',
              sx: { fontWeight: 500, lineHeight: 1.4, fontSize: '12px' }
            }}
            secondaryTypographyProps={{
              noWrap: true,
              title: bookmark.url,
              variant: 'caption',
              sx: { lineHeight: 1.4, minHeight: '1.4em', fontSize: '11px' }
            }}
          />
        </ItemContainer>
      )}

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
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>编辑</ListItemText>
        </MenuItem>
        {!bookmark.isFolder && bookmark.url && (
          <MenuItem
            onClick={handleOpenInNewTab}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>新标签页打开</ListItemText>
          </MenuItem>
        )}
        {bookmark.isFolder && (
          <MenuItem
            onClick={handleOpenAllInNewTabs}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>在新标签页中打开所有</ListItemText>
          </MenuItem>
        )}
        {bookmark.isFolder && (
          <MenuItem
            onClick={handleExportFolder}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>导出文件夹</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={handleDeleteClick}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>删除</ListItemText>
        </MenuItem>
      </Menu>
    </ListItem>
  );
};

export default React.memo(BookmarkItem);
