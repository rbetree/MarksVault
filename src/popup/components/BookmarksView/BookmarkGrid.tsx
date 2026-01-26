import React, { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import Box from '@mui/material/Box';
import LoadingIndicator from '../shared/LoadingIndicator';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SortIcon from '@mui/icons-material/Sort';
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
import { styled } from '@mui/material/styles';
import BookmarkGridItem from './BookmarkGridItem';
import { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';
import ViewToggleButton from './ViewToggleButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { globalFabStyles } from '../../styles/TaskStyles';

// 拖拽数据类型，与BookmarkItem保持一致
const DRAG_TYPE = 'application/marksvault-bookmark';

// 样式化组件
const GridContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  padding: theme.spacing(0.5),
  width: '100%',
  height: '100%',
  gap: '4px',
  justifyItems: 'center',
  alignContent: 'flex-start',
  overflowY: 'auto',
  backgroundColor: 'transparent',
}));

const SearchArea = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 0.5, 0, 0.5),
  backgroundColor: 'transparent',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  width: '100%',
  justifyContent: 'space-between',
}));

const LeftColumn = styled(Box)(({ theme }) => ({
  width: '50%',
  paddingRight: theme.spacing(0.5),
}));

const RightColumn = styled(Box)(({ theme }) => ({
  width: '50%',
  paddingLeft: theme.spacing(0.5),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  width: '100%',
  textAlign: 'center',
  padding: theme.spacing(3),
  color: theme.palette.text.secondary,
}));

interface BookmarkGridProps {
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
  searchText: string;
  isSearching: boolean;
  resolveBookmarkPath?: (bookmarkId: string) => Promise<string>;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
}

const BookmarkGrid: React.FC<BookmarkGridProps> = ({
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
  onSortChange,
  searchText,
  isSearching,
  resolveBookmarkPath,
  onSearch,
  onClearSearch
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isFolder, setIsFolder] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [currentBookmark, setCurrentBookmark] = useState<BookmarkItemType | null>(null);
  const [sortMenuAnchorEl, setSortMenuAnchorEl] = useState<null | HTMLElement>(null);
  const isSortMenuOpen = Boolean(sortMenuAnchorEl);

  // 处理搜索：本地受控 inputValue + IME 合成阶段仅更新 inputValue，不触发搜索
  const isComposingRef = useRef(false);
  const [inputValue, setInputValue] = useState(searchText);

  // 父组件可能会清空/外部更新 searchText，需要同步到输入框（但避免打断合成）
  useEffect(() => {
    if (!isComposingRef.current) {
      setInputValue(searchText);
    }
  }, [searchText]);

  const handleCompositionStart = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = true;
    console.debug('[BookmarkGrid] compositionstart', {
      value: e.currentTarget.value,
    });
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;

    // MUI InputBase 的 composition 事件 currentTarget 可能不是 <input>，用 target 更可靠
    const value = ((e.target as HTMLInputElement | null)?.value ?? '') as string;

    console.debug('[BookmarkGrid] compositionend', { value });
    setInputValue(value);
    onSearch(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = (e.target.value ?? '') as string;
    const nativeIsComposing = (e.nativeEvent as any)?.isComposing;

    // 记录：验证是否“卡在 composing=true 导致永远不触发 onSearch”
    console.debug('[BookmarkGrid] change', {
      value,
      refIsComposing: isComposingRef.current,
      nativeIsComposing,
    });

    setInputValue(value);

    // 合成阶段不触发搜索，但要允许输入回显
    if (isComposingRef.current || nativeIsComposing) return;
    onSearch(value);
  };

  const handleSearchBlur = () => {
    // 兜底：如果某些场景 compositionend 没有触发，blur 时也要解除 composing 状态
    console.debug('[BookmarkGrid] blur');
    isComposingRef.current = false;
  };

  const clearSearch = () => {
    console.debug('[BookmarkGrid] clearSearch');
    setInputValue('');
    onClearSearch();
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

  // 获取排序方法的显示名称
  const getSortMethodName = (method: 'default' | 'name' | 'dateAdded'): string => {
    switch (method) {
      case 'name': return '按名称';
      case 'dateAdded': return '按日期';
      default: return '默认';
    }
  };

  // 处理网格区域拖拽悬停
  const handleGridDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes(DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }
  };

  // 处理网格区域放置，将项目移动到当前文件夹末尾
  const handleGridDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    // 确保是直接放在网格区域而不是某个特定书签上
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
        console.error('网格拖放处理错误:', error);
      }
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 搜索区域 */}
      <SearchArea>
        {/* 左侧：导航区域（文件夹层级） */}
        <LeftColumn>
          <Paper
            sx={{
              p: '1px 4px',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '32px',
              borderRadius: 1,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            {isSearching ? (
              <Typography
                variant="body2"
                noWrap
                sx={{
                  ml: 0.5,
                  fontWeight: 400,
                  flex: 1,
                  fontSize: '0.9rem',
                  color: 'text.primary',
                  pl: 0.5
                }}
              >
                搜索结果
              </Typography>
            ) : parentFolder ? (
              <>
                <IconButton onClick={onNavigateBack} size="small" sx={{ p: 0.5 }}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    ml: 0.5,
                    fontWeight: 400,
                    flex: 1,
                    fontSize: '0.9rem',
                    color: 'text.primary'
                  }}
                >
                  {parentFolder.title}
                </Typography>
              </>
            ) : (
              <Typography
                variant="body2"
                noWrap
                sx={{
                  ml: 0.5,
                  fontWeight: 400,
                  flex: 1,
                  fontSize: '0.9rem',
                  color: 'text.primary',
                  pl: 0.5
                }}
              >
                书签栏
              </Typography>
            )}
          </Paper>
        </LeftColumn>

        {/* 右侧：搜索栏 */}
        <RightColumn>
          <Paper
            sx={{
              p: '1px 4px',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '32px',
              borderRadius: 1,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <InputBase
              sx={{
                pl: 1.5,
                flex: 1,
                fontSize: '0.9rem',
                fontWeight: 400,
                fontFamily: 'inherit'
              }}
              placeholder="搜索书签..."
              value={inputValue}
              onChange={handleSearchChange}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onBlur={handleSearchBlur}
            />
            {inputValue && (
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
              <ViewToggleButton
                viewType={viewType}
                onChange={onViewTypeChange}
              />
            </Box>
          </Paper>
        </RightColumn>
      </SearchArea>


      {/* 书签网格 */}
      <GridContainer
        onDragOver={handleGridDragOver}
        onDrop={handleGridDrop}
      >
        {isLoading ? (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <LoadingIndicator message="" />
          </Box>
        ) : bookmarks.length === 0 ? (
          <EmptyState>
            <Typography variant="body1">
              {searchText ? '没有找到匹配的书签' : '没有书签'}
            </Typography>
          </EmptyState>
        ) : (
          bookmarks.map((bookmark, index) => (
            <BookmarkGridItem
              key={bookmark.id}
              bookmark={bookmark}
              index={index}
              isSearching={isSearching}
              resolveBookmarkPath={resolveBookmarkPath}
              onOpen={handleBookmarkOpen}
              onOpenFolder={handleFolderOpen}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMoveBookmark={onMoveBookmark}
            />
          ))
        )}
      </GridContainer>

      {/* 浮动添加按钮 */}
      <Fab
        color="primary"
        size="medium"
        onClick={handleAddClick}
        sx={globalFabStyles}
      >
        <AddIcon />
      </Fab>

      {/* 排序菜单 */}
      <Menu
        anchorEl={sortMenuAnchorEl}
        open={isSortMenuOpen}
        onClose={handleSortClose}
      >
        <MenuItem
          onClick={() => handleSortSelect('default')}
          selected={sortMethod === 'default'}
          sx={{ minHeight: '32px', display: 'flex', alignItems: 'center', py: 0.5, px: 1.5, fontSize: '0.85rem' }}
        >
          默认排序
        </MenuItem>
        <MenuItem
          onClick={() => handleSortSelect('name')}
          selected={sortMethod === 'name'}
          sx={{ minHeight: '32px', display: 'flex', alignItems: 'center', py: 0.5, px: 1.5, fontSize: '0.85rem' }}
        >
          按名称排序
        </MenuItem>
        <MenuItem
          onClick={() => handleSortSelect('dateAdded')}
          selected={sortMethod === 'dateAdded'}
          sx={{ minHeight: '32px', display: 'flex', alignItems: 'center', py: 0.5, px: 1.5, fontSize: '0.85rem' }}
        >
          按添加日期排序
        </MenuItem>
      </Menu>

      {/* 添加对话框 */}
      <Dialog open={addDialogOpen} onClose={handleAddDialogClose}>
        <DialogTitle>{isFolder ? '创建文件夹' : '添加书签'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            请输入{isFolder ? '文件夹' : '书签'}的详细信息。
          </DialogContentText>

          <FormControlLabel
            control={
              <Switch
                checked={isFolder}
                onChange={(e) => setIsFolder(e.target.checked)}
                color="primary"
              />
            }
            label="这是一个文件夹"
            sx={{ my: 2 }}
          />

          <TextField
            autoFocus
            margin="dense"
            id="title"
            label="名称"
            type="text"
            fullWidth
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          {!isFolder && (
            <TextField
              margin="dense"
              id="url"
              label="URL"
              type="url"
              fullWidth
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddDialogClose} color="primary">
            取消
          </Button>
          <Button onClick={handleAddSubmit} color="primary" disabled={formTitle.trim() === '' || (!isFolder && formUrl.trim() === '')}>
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onClose={handleEditDialogClose}>
        <DialogTitle>{currentBookmark?.isFolder ? '编辑文件夹' : '编辑书签'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="edit-title"
            label="名称"
            type="text"
            fullWidth
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          {currentBookmark && !currentBookmark.isFolder && (
            <TextField
              margin="dense"
              id="edit-url"
              label="URL"
              type="url"
              fullWidth
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose} color="primary">
            取消
          </Button>
          <Button
            onClick={handleEditSubmit}
            color="primary"
            disabled={formTitle.trim() === '' || (!!currentBookmark && !currentBookmark.isFolder && formUrl.trim() === '')}
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
              ? `确定要删除文件夹 "${currentBookmark?.title}" 及其所有内容吗？`
              : `确定要删除书签 "${currentBookmark?.title}" 吗？`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDeleteClose} color="primary">
            取消
          </Button>
          <Button onClick={handleConfirmDelete} color="error">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookmarkGrid; 
