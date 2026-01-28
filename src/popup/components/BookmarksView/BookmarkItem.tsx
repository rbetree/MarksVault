import React, { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemButton from '@mui/material/ListItemButton';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import UpdateIcon from '@mui/icons-material/Update';
import LinkIcon from '@mui/icons-material/Link';
import { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';
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
  onCreateBookmark?: () => void;
  onCreateFolder?: () => void;
  onUpdateToCurrentUrl?: (bookmarkId: string) => void;
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
  onCreateBookmark,
  onCreateFolder,
  onUpdateToCurrentUrl,
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

  const handleOpenInIncognito = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();

    if (!bookmark.url) return;

    try {
      await browser.windows.create({ url: bookmark.url, incognito: true });
    } catch (error) {
      console.error('打开隐身窗口失败:', error);
      // 兜底：至少在新标签页打开
      browser.tabs.create({ url: bookmark.url });
    }
  };

  const handleCreateBookmark = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    onCreateBookmark?.();
  };

  const handleCreateFolder = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    onCreateFolder?.();
  };

  const handleUpdateToCurrentUrl = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handleMenuClose();
    onUpdateToCurrentUrl?.(bookmark.id);
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
        {!bookmark.isFolder && bookmark.url && (
          <MenuItem
            onClick={handleOpenInNewTab}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
              在新标签中打开
            </ListItemText>
          </MenuItem>
        )}

        {!bookmark.isFolder && bookmark.url && <Divider sx={{ my: 0.5 }} />}

        {!bookmark.isFolder && bookmark.url && (
          <MenuItem
            onClick={handleOpenInIncognito}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
              在隐身窗口中打开
            </ListItemText>
          </MenuItem>
        )}

        <MenuItem
          onClick={handleCreateBookmark}
          disabled={!onCreateBookmark}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <BookmarkAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
            新建书签
          </ListItemText>
        </MenuItem>

        <MenuItem
          onClick={handleCreateFolder}
          disabled={!onCreateFolder}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <CreateNewFolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
            新建文件夹
          </ListItemText>
        </MenuItem>

        {!bookmark.isFolder && (
          <MenuItem
            onClick={handleUpdateToCurrentUrl}
            disabled={!onUpdateToCurrentUrl}
            sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: '28px' }}>
              <UpdateIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
              更新为当前网址
            </ListItemText>
          </MenuItem>
        )}

        <MenuItem
          onClick={handleEditClick}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
            编辑...
          </ListItemText>
        </MenuItem>

        <MenuItem
          onClick={handleDeleteClick}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
            删除
          </ListItemText>
        </MenuItem>
      </Menu>
    </ListItem>
  );
};

export default React.memo(BookmarkItem);
