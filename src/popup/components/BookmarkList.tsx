import React, { useState } from 'react';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SortIcon from '@mui/icons-material/Sort';
import BookmarkItem from './BookmarkItem';
import { BookmarkItem as BookmarkItemType } from '../../utils/bookmark-service';
import Fab from '@mui/material/Fab';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ViewToggleButton from './ViewToggleButton';
import { styled } from '@mui/material/styles';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

// 样式化组件
const NavigationArea = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.75, 1),
  display: 'flex',
  alignItems: 'center',
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  margin: theme.spacing(0.5, 0.5, 0),
}));

const SearchArea = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 0.5, 0, 0.5),
  backgroundColor: theme.palette.background.paper,
}));

// 拖拽数据类型，与BookmarkItem保持一致
const DRAG_TYPE = 'application/marksvault-bookmark';

interface BookmarkListProps {
  bookmarks: BookmarkItemType[];
  parentFolder?: BookmarkItemType;
  isLoading?: boolean;
  onAddBookmark?: (bookmark: { parentId?: string; title: string; url: string }) => Promise<void>;
  onAddFolder?: (folder: { parentId?: string; title: string }) => Promise<void>;
  onEditBookmark?: (id: string, changes: { title?: string; url?: string }) => Promise<void>;
  onDeleteBookmark?: (id: string) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onNavigateToFolder?: (folderId: string) => void;
  onNavigateBack?: () => void;
  onMoveBookmark?: (bookmarkId: string, destinationFolderId: string, index?: number) => Promise<boolean>;
  viewType: 'list' | 'grid';
  onViewTypeChange: (viewType: 'list' | 'grid') => void;
  sortMethod: 'default' | 'name' | 'dateAdded';
  onSortChange: (method: 'default' | 'name' | 'dateAdded') => void;
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
  onNavigateBack,
  onMoveBookmark,
  viewType,
  onViewTypeChange,
  sortMethod,
  onSortChange
}) => {
  const [searchText, setSearchText] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isFolder, setIsFolder] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [currentBookmark, setCurrentBookmark] = useState<BookmarkItemType | null>(null);
  const [sortMenuAnchorEl, setSortMenuAnchorEl] = useState<null | HTMLElement>(null);
  const isSortMenuOpen = Boolean(sortMenuAnchorEl);

  // 过滤书签
  const filteredBookmarks = searchText
    ? bookmarks.filter(
        bookmark => 
          bookmark.title.toLowerCase().includes(searchText.toLowerCase()) ||
          (bookmark.url && bookmark.url.toLowerCase().includes(searchText.toLowerCase()))
      )
    : bookmarks;

  // 处理搜索
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const clearSearch = () => {
    setSearchText('');
  };

  // 处理排序
  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortMenuAnchorEl(event.currentTarget);
  };

  const handleSortClose = () => {
    setSortMenuAnchorEl(null);
  };

  const handleSortSelect = (method: 'default' | 'name' | 'dateAdded') => {
    onSortChange(method);
    handleSortClose();
  };

  // 获取排序方法的显示名称
  const getSortMethodName = (method: 'default' | 'name' | 'dateAdded'): string => {
    switch (method) {
      case 'name': return '按名称';
      case 'dateAdded': return '按日期';
      default: return '默认';
    }
  };

  // 打开添加对话框
  const handleAddClick = () => {
    setIsFolder(false);
    setFormTitle('');
    setFormUrl('');
    setAddDialogOpen(true);
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
  const handleBookmarkOpen = (bookmark: BookmarkItemType) => {
    if (bookmark.url) {
      chrome.tabs.create({ url: bookmark.url });
    }
  };

  // 处理文件夹点击
  const handleFolderOpen = (bookmark: BookmarkItemType) => {
    if (onNavigateToFolder) {
      onNavigateToFolder(bookmark.id);
    }
  };

  // 处理编辑
  const handleEdit = (bookmark: BookmarkItemType) => {
    setCurrentBookmark(bookmark);
    setIsFolder(bookmark.isFolder);
    setFormTitle(bookmark.title);
    setFormUrl(bookmark.url || '');
    setEditDialogOpen(true);
  };

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
  const handleDelete = (bookmark: BookmarkItemType) => {
    setCurrentBookmark(bookmark);
    setConfirmDeleteOpen(true);
  };

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
      {/* 搜索区域 - 现在总是在顶部 */}
      <SearchArea>
        {/* 搜索框 */}
        <Paper
          sx={{
            p: '1px 4px',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            boxShadow: 'none',
            border: '1px solid',
            borderColor: 'divider',
            height: '40px',
          }}
        >
          <IconButton sx={{ p: 0.5 }} aria-label="搜索">
            <SearchIcon fontSize="small" />
          </IconButton>
          <InputBase
            sx={{ ml: 0.5, flex: 1, fontSize: '0.9rem' }}
            placeholder="搜索书签..."
            value={searchText}
            onChange={handleSearchChange}
          />
          {searchText && (
            <IconButton sx={{ p: 0.5 }} aria-label="清除" onClick={clearSearch}>
              <ClearIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
            <IconButton 
              sx={{ p: 0.5 }} 
              aria-label="排序" 
              onClick={handleSortClick}
              title={`排序: ${getSortMethodName(sortMethod)}`}
            >
              <SortIcon fontSize="small" color={sortMethod !== 'default' ? 'primary' : 'inherit'} />
            </IconButton>
            <IconButton 
              sx={{ p: 0.5 }} 
              aria-label="添加书签" 
              onClick={handleAddClick}
            >
              <AddIcon fontSize="small" />
            </IconButton>
            <ViewToggleButton 
              viewType={viewType} 
              onChange={onViewTypeChange} 
            />
          </Box>
        </Paper>
        
        {/* 导航区域 - 移到搜索框下方 */}
        {parentFolder && (
          <NavigationArea>
            <IconButton onClick={onNavigateBack} size="small" sx={{ p: 0.5 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" noWrap sx={{ ml: 0.5, fontWeight: 500 }}>
              {parentFolder.title}
            </Typography>
          </NavigationArea>
        )}
      </SearchArea>

      <Divider />

      {/* 书签列表 - 添加拖拽支持 */}
      <Box 
        sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}
        onDragOver={handleListDragOver}
        onDrop={handleListDrop}
      >
        {filteredBookmarks.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {searchText ? '没有找到匹配的书签' : '没有书签'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredBookmarks.map((bookmark) => (
              <React.Fragment key={bookmark.id}>
                <BookmarkItem
                  bookmark={bookmark}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onOpen={handleBookmarkOpen}
                  onOpenFolder={handleFolderOpen}
                  onMoveBookmark={onMoveBookmark}
                />
                <Divider variant="inset" component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* 排序菜单 */}
      <Menu
        anchorEl={sortMenuAnchorEl}
        open={isSortMenuOpen}
        onClose={handleSortClose}
      >
        <MenuItem 
          onClick={() => handleSortSelect('default')}
          selected={sortMethod === 'default'}
        >
          默认排序
        </MenuItem>
        <MenuItem 
          onClick={() => handleSortSelect('name')}
          selected={sortMethod === 'name'}
        >
          按名称排序
        </MenuItem>
        <MenuItem 
          onClick={() => handleSortSelect('dateAdded')}
          selected={sortMethod === 'dateAdded'}
        >
          按添加日期排序
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