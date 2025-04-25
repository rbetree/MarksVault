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
import { styled } from '@mui/material/styles';
import { BookmarkItem as BookmarkItemType } from '../../utils/bookmark-service';
import { getFaviconUrl } from '../../utils/favicon-service';

// 样式化组件
const GridItemContainer = styled(Box)(({ theme }) => ({
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
  transition: 'all 0.2s ease-in-out',
  position: 'relative',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    transform: 'translateY(-2px)',
  },
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

const MenuButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '2px',
  right: '2px',
  opacity: 0,
  transition: 'opacity 0.2s',
  padding: '2px',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  [`${GridItemContainer}:hover &`]: {
    opacity: 1,
  },
}));

interface BookmarkGridItemProps {
  bookmark: BookmarkItemType;
  onEdit?: (bookmark: BookmarkItemType) => void;
  onDelete?: (bookmark: BookmarkItemType) => void;
  onOpen?: (bookmark: BookmarkItemType) => void;
  onOpenFolder?: (bookmark: BookmarkItemType) => void;
}

const BookmarkGridItem: React.FC<BookmarkGridItemProps> = ({
  bookmark,
  onEdit,
  onDelete,
  onOpen,
  onOpenFolder
}) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [iconUrl, setIconUrl] = useState<string>('');
  const isMenuOpen = Boolean(menuAnchorEl);

  // 加载网站图标
  useEffect(() => {
    if (!bookmark.isFolder && bookmark.url) {
      setIconUrl(getFaviconUrl(bookmark.url));
    }
  }, [bookmark.url, bookmark.isFolder]);

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

  return (
    <GridItemContainer onClick={handleItemClick}>
      <IconContainer>
        {bookmark.isFolder ? (
          <FolderIcon color="primary" sx={{ fontSize: 28 }} />
        ) : (
          <img
            src={iconUrl}
            alt={bookmark.title}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              // 如果图标加载失败，显示默认图标
              e.currentTarget.src = 'assets/icons/default_favicon.png';
            }}
          />
        )}
      </IconContainer>
      
      <ItemTitle title={bookmark.title}>
        {bookmark.title}
      </ItemTitle>

      <MenuButton
        size="small"
        onClick={handleMenuClick}
        aria-label="更多操作"
      >
        <MoreHorizIcon fontSize="small" />
      </MenuButton>

      <Menu
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
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
        
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>删除</ListItemText>
        </MenuItem>
      </Menu>
    </GridItemContainer>
  );
};

export default BookmarkGridItem; 