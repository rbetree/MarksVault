import React, { useCallback, useState } from 'react';
import { browser } from 'wxt/browser';
import Box from '@mui/material/Box';
import LoadingIndicator from '../shared/LoadingIndicator';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import BookmarkItem from './BookmarkItem';
import { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';

// 样式化组件
// 拖拽数据类型，与BookmarkItem保持一致
const DRAG_TYPE = 'application/marksvault-bookmark';

interface BookmarkListProps {
  bookmarks: BookmarkItemType[];
  parentFolder?: BookmarkItemType;
  isLoading?: boolean;
  onAddBookmark?: (bookmark: { parentId?: string; title: string; url: string }) => Promise<void>;
  onAddFolder?: (folder: { parentId?: string; title: string }) => Promise<void>;
  onEditBookmark?: (id: string, changes: { title?: string; url?: string }) => Promise<void>;
  onUpdateToCurrentUrl?: (bookmarkId: string) => void;
  onDeleteBookmark?: (id: string) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onNavigateToFolder?: (folderId: string) => void;
  onNavigateBack?: () => void;
  onMoveBookmark?: (bookmarkId: string, destinationFolderId: string, index?: number) => Promise<boolean>;
  searchText: string;
  isSearching: boolean;
  resolveBookmarkPath?: (bookmarkId: string) => Promise<string>;
}

const BookmarkList: React.FC<BookmarkListProps> = ({
  bookmarks,
  parentFolder,
  isLoading = false,
  onAddBookmark,
  onAddFolder,
  onEditBookmark,
  onDeleteBookmark,
  onDeleteFolder,
  onNavigateToFolder,
  onMoveBookmark,
  searchText,
  isSearching,
  resolveBookmarkPath,
  onUpdateToCurrentUrl,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isFolder, setIsFolder] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [currentBookmark, setCurrentBookmark] = useState<BookmarkItemType | null>(null);
  const [contextMenuAnchorPosition, setContextMenuAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const isContextMenuOpen = Boolean(contextMenuAnchorPosition);

  const closeContextMenu = () => {
    setContextMenuAnchorPosition(null);
  };

  const openCreateDialog = (asFolder: boolean) => {
    closeContextMenu();
    setIsFolder(asFolder);
    setFormTitle('');
    setFormUrl('');
    setAddDialogOpen(true);
  };

  const handleBackgroundContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuAnchorPosition({
      top: event.clientY,
      left: event.clientX,
    });
  };

  // 关闭添加对话框
  const handleAddDialogClose = () => {
    setAddDialogOpen(false);
  };

  // 提交添加表单
  const handleAddSubmit = async () => {
    if (isFolder) {
      if (onAddFolder && formTitle.trim()) {
        await onAddFolder({
          parentId: parentFolder?.id,
          title: formTitle.trim()
        });
      }
    } else {
      if (onAddBookmark && formTitle.trim() && formUrl.trim()) {
        await onAddBookmark({
          parentId: parentFolder?.id,
          title: formTitle.trim(),
          url: formUrl.trim()
        });
      }
    }
    setAddDialogOpen(false);
  };

  // 处理书签点击
  const handleBookmarkOpen = useCallback((bookmark: BookmarkItemType) => {
    if (bookmark.url) {
      browser.tabs.create({ url: bookmark.url });
    }
  }, []);

  // 处理文件夹点击
  const handleFolderOpen = useCallback((bookmark: BookmarkItemType) => {
    if (onNavigateToFolder) {
      onNavigateToFolder(bookmark.id);
    }
  }, [onNavigateToFolder]);

  // 处理编辑
  const handleEdit = useCallback((bookmark: BookmarkItemType) => {
    setCurrentBookmark(bookmark);
    setIsFolder(bookmark.isFolder);
    setFormTitle(bookmark.title);
    setFormUrl(bookmark.url || '');
    setEditDialogOpen(true);
  }, []);

  // 关闭编辑对话框
  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setCurrentBookmark(null);
  };

  // 提交编辑表单
  const handleEditSubmit = async () => {
    if (currentBookmark && onEditBookmark) {
      const changes: { title?: string; url?: string } = {};

      if (formTitle.trim() !== currentBookmark.title) {
        changes.title = formTitle.trim();
      }

      if (!currentBookmark.isFolder && formUrl.trim() !== currentBookmark.url) {
        changes.url = formUrl.trim();
      }

      if (Object.keys(changes).length > 0) {
        await onEditBookmark(currentBookmark.id, changes);
      }
    }
    setEditDialogOpen(false);
    setCurrentBookmark(null);
  };

  // 处理删除
  const handleDelete = useCallback((bookmark: BookmarkItemType) => {
    setCurrentBookmark(bookmark);
    setConfirmDeleteOpen(true);
  }, []);

  // 关闭确认删除对话框
  const handleConfirmDeleteClose = () => {
    setConfirmDeleteOpen(false);
    setCurrentBookmark(null);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (currentBookmark) {
      if (currentBookmark.isFolder && onDeleteFolder) {
        await onDeleteFolder(currentBookmark.id);
      } else if (!currentBookmark.isFolder && onDeleteBookmark) {
        await onDeleteBookmark(currentBookmark.id);
      }
    }
    setConfirmDeleteOpen(false);
    setCurrentBookmark(null);
  };

  // 处理列表区域拖拽悬停
  const handleListDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }
  };

  // 处理列表区域放置，将项目移动到当前文件夹末尾
  const handleListDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    // 确保是直接放在列表区域而不是某个特定书签上
    if (event.target === event.currentTarget) {
      try {
        const dragData = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));

        // 确定目标文件夹，如果是根目录则使用书签栏
        if (onMoveBookmark) {
          const targetParentId = parentFolder?.id;

          // 只有当有目标父ID时才移动
          if (targetParentId) {
            // 移动到文件夹末尾（不指定索引）
            await onMoveBookmark(dragData.id, targetParentId);
          }
        }
      } catch (error) {
        console.error('列表拖放处理错误:', error);
      }
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 书签列表 - 改为双栏垂直分栏布局 */}
      <Box
        sx={{
          flexGrow: 1,
          // overflowY: 'auto',  // Let PageLayout handle scroll
          // overflowX: 'hidden',
          columnCount: 2,
          columnGap: '8px',
          width: '100%',
          boxSizing: 'border-box',
          contain: 'layout', // 限制布局计算范围
          '& > *': {
            breakInside: 'avoid',
            marginBottom: '4px'
          },
          backgroundColor: 'transparent'
        }}
        onDragOver={handleListDragOver}
        onDrop={handleListDrop}
        onContextMenu={handleBackgroundContextMenu}
      >
        {isLoading ? (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', columnSpan: 'all' }}>
            <LoadingIndicator message="" />
          </Box>
        ) : bookmarks.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', columnSpan: 'all' }}>
            <Typography color="text.secondary">
              {searchText ? '没有找到匹配的书签' : '没有书签'}
            </Typography>
          </Box>
        ) : (
          bookmarks.map((bookmark, index) => (
            <BookmarkItem
              key={bookmark.id}
              bookmark={bookmark}
              index={index}
              isSearching={isSearching}
              resolveBookmarkPath={resolveBookmarkPath}
              onCreateBookmark={() => openCreateDialog(false)}
              onCreateFolder={() => openCreateDialog(true)}
              onUpdateToCurrentUrl={onUpdateToCurrentUrl}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onOpen={handleBookmarkOpen}
              onOpenFolder={handleFolderOpen}
              onMoveBookmark={onMoveBookmark}
            />
          ))
        )}
      </Box>

      {/* 空白区域右键菜单：新建书签/文件夹 */}
      <Menu
        open={isContextMenuOpen}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenuAnchorPosition || undefined}
      >
        <MenuItem
          onClick={() => openCreateDialog(false)}
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
          onClick={() => openCreateDialog(true)}
          sx={{ minHeight: '32px', py: 0.5, px: 1.5 }}
        >
          <ListItemIcon sx={{ minWidth: '28px' }}>
            <CreateNewFolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { fontSize: '13px' } }}>
            新建文件夹
          </ListItemText>
        </MenuItem>
      </Menu>


      {/* 添加对话框 */}
      <Dialog open={addDialogOpen} onClose={handleAddDialogClose}>
        <DialogTitle>
          {isFolder ? '添加文件夹' : '添加书签'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isFolder}
                  onChange={(e) => setIsFolder(e.target.checked)}
                />
              }
              label="创建文件夹"
            />
          </Box>
          <TextField
            autoFocus
            margin="dense"
            label="标题"
            type="text"
            fullWidth
            variant="outlined"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
          {!isFolder && (
            <TextField
              margin="dense"
              label="URL"
              type="url"
              fullWidth
              variant="outlined"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddDialogClose}>取消</Button>
          <Button
            onClick={handleAddSubmit}
            disabled={
              !formTitle.trim() || (!isFolder && !formUrl.trim())
            }
          >
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onClose={handleEditDialogClose}>
        <DialogTitle>
          {currentBookmark?.isFolder ? '编辑文件夹' : '编辑书签'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="标题"
            type="text"
            fullWidth
            variant="outlined"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
          {currentBookmark && !currentBookmark.isFolder && (
            <TextField
              margin="dense"
              label="URL"
              type="url"
              fullWidth
              variant="outlined"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose}>取消</Button>
          <Button
            onClick={handleEditSubmit}
            disabled={
              !formTitle.trim() || (currentBookmark ? (!currentBookmark.isFolder && !formUrl.trim()) : false)
            }
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 确认删除对话框 */}
      <Dialog open={confirmDeleteOpen} onClose={handleConfirmDeleteClose}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {currentBookmark?.isFolder
              ? `确定要删除文件夹 "${currentBookmark.title}" 及其包含的所有书签吗？`
              : `确定要删除书签 "${currentBookmark?.title}" 吗？`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDeleteClose}>取消</Button>
          <Button onClick={handleConfirmDelete} color="error">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookmarkList; 
