import React, { useState, useEffect } from 'react';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemButton from '@mui/material/ListItemButton';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { BookmarkItem as BookmarkItemType } from '../../utils/bookmark-service';
import { getFaviconUrl } from '../../utils/favicon-service';
import bookmarkService from '../../utils/bookmark-service';

interface BookmarkItemProps {
  bookmark: BookmarkItemType;
  onEdit?: (bookmark: BookmarkItemType) => void;
  onDelete?: (bookmark: BookmarkItemType) => void;
  onOpen?: (bookmark: BookmarkItemType) => void;
  onOpenFolder?: (bookmark: BookmarkItemType) => void;
}

const BookmarkItem: React.FC<BookmarkItemProps> = ({
  bookmark,
  onEdit,
  onDelete,
  onOpen,
  onOpenFolder
}) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [iconUrl, setIconUrl] = useState<string>('');
  const [iconError, setIconError] = useState<boolean>(false);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const isMenuOpen = Boolean(menuAnchorEl);

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
      <ListItemButton onClick={handleItemClick}>
        <ListItemIcon>
          {bookmark.isFolder ? (
            <FolderIcon color="primary" />
          ) : (
            iconUrl && !iconError ? (
              <img 
                src={iconUrl} 
                alt={bookmark.title}
                style={{ width: '24px', height: '24px' }}
                onError={handleIconError}
              />
            ) : (
              <InsertLinkIcon color="secondary" />
            )
          )}
        </ListItemIcon>
        <ListItemText 
          primary={bookmark.title} 
          secondary={
            bookmark.isFolder 
              ? (itemCount !== null ? `${itemCount} 项` : '') 
              : bookmark.url
          }
          primaryTypographyProps={{ 
            noWrap: true,
            title: bookmark.title
          }}
          secondaryTypographyProps={{ 
            noWrap: true,
            title: bookmark.isFolder ? '' : bookmark.url
          }}
        />
      </ListItemButton>

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
          <>
            <MenuItem onClick={handleOpenAllInNewTabs}>
              <ListItemIcon>
                <OpenInNewIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>新标签页打开所有</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleExportFolder}>
              <ListItemIcon>
                <FileDownloadIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>导出文件夹</ListItemText>
            </MenuItem>
          </>
        )}
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>删除</ListItemText>
        </MenuItem>
      </Menu>
    </ListItem>
  );
};

export default BookmarkItem; 