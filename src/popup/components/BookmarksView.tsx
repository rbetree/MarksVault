import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import BookmarkGrid from './BookmarkGrid';
import BookmarkList from './BookmarkList';
import LoadingIndicator from './LoadingIndicator';
import ViewToggleButton from './ViewToggleButton';
import { ToastRef } from './Toast';
import bookmarkService, { BookmarkItem, BookmarkResult } from '../../utils/bookmark-service';
import storageService, { UserSettings } from '../../utils/storage-service';

interface BookmarksViewProps {
  toastRef: React.RefObject<ToastRef>;
}

const BookmarksView: React.FC<BookmarksViewProps> = ({ toastRef }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<BookmarkItem[]>([]);
  const [currentBookmarks, setCurrentBookmarks] = useState<BookmarkItem[]>([]);
  const [viewType, setViewType] = useState<'list' | 'grid'>('grid'); // 默认使用网格视图
  const [bookmarkBarId, setBookmarkBarId] = useState<string | null>(null); // 添加书签栏ID状态变量
  const [sortMethod, setSortMethod] = useState<'default' | 'name' | 'dateAdded'>('default');
  const bookmarksMap = useRef<Map<string, BookmarkItem>>(new Map());

  // 加载所有书签树和用户设置
  useEffect(() => {
    loadBookmarks();
    loadUserSettings();
  }, []);

  // 当文件夹变化时更新当前显示的书签
  useEffect(() => {
    updateCurrentBookmarks();
  }, [currentFolderId, bookmarks, sortMethod]);

  // 加载用户设置
  const loadUserSettings = async () => {
    try {
      const result = await storageService.getSettings();
      if (result.success && result.data) {
        const settings = result.data as UserSettings;
        setViewType(settings.viewType);
        // 可以在这里也加载排序设置，如果需要保存
      }
    } catch (error) {
      console.error('加载用户设置错误:', error);
    }
  };

  // 保存视图类型设置
  const saveViewTypeSetting = async (type: 'list' | 'grid') => {
    try {
      await storageService.updateSettings({ viewType: type });
    } catch (error) {
      console.error('保存视图类型设置错误:', error);
    }
  };

  // 处理视图类型切换
  const handleViewTypeChange = (type: 'list' | 'grid') => {
    setViewType(type);
    saveViewTypeSetting(type);
  };

  // 处理排序方法变更
  const handleSortChange = (method: 'default' | 'name' | 'dateAdded') => {
    setSortMethod(method);
  };

  // 排序书签列表
  const sortBookmarks = (bookmarks: BookmarkItem[], method: 'default' | 'name' | 'dateAdded'): BookmarkItem[] => {
    if (method === 'default') return bookmarks;
    
    return [...bookmarks].sort((a, b) => {
      // 确保文件夹始终排在前面
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      
      // 然后根据排序方法排序
      if (method === 'name') {
        return a.title.localeCompare(b.title);
      } else if (method === 'dateAdded') {
        return (b.dateAdded || 0) - (a.dateAdded || 0);
      }
      return 0;
    });
  };

  // 加载书签树
  const loadBookmarks = async () => {
    setIsLoading(true);
    try {
      const result = await bookmarkService.getAllBookmarks();
      if (result.success && result.data) {
        setBookmarks(result.data);
        // 构建书签映射，便于快速查找
        buildBookmarkMap(result.data);
      } else {
        toastRef.current?.showToast('获取书签失败', 'error');
      }
    } catch (error) {
      console.error('加载书签错误:', error);
      toastRef.current?.showToast('加载书签时发生错误', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 构建书签ID映射
  const buildBookmarkMap = (items: BookmarkItem[]) => {
    const map = new Map<string, BookmarkItem>();
    
    const processItem = (item: BookmarkItem) => {
      map.set(item.id, item);
      if (item.children) {
        item.children.forEach(processItem);
      }
    };
    
    items.forEach(processItem);
    bookmarksMap.current = map;
  };

  // 更新当前显示的书签列表
  const updateCurrentBookmarks = () => {
    if (!bookmarks.length) return;
    
    let items: BookmarkItem[] = [];
    
    if (!currentFolderId) {
      // 根级书签，通常是书签栏文件夹
      const bookmarkBar = bookmarks[0].children?.find(b => b.title === "书签栏") 
        || bookmarks[0].children?.[0];
      
      if (bookmarkBar && bookmarkBar.children) {
        // 存储书签栏ID以便后续使用
        setBookmarkBarId(bookmarkBar.id);
        items = bookmarkBar.children;
      }
    } else {
      const folder = bookmarksMap.current.get(currentFolderId);
      if (folder && folder.children) {
        items = folder.children;
      }
    }
    
    // 应用排序
    setCurrentBookmarks(sortBookmarks(items, sortMethod));
  };

  // 导航到指定文件夹
  const navigateToFolder = (folderId: string) => {
    const folder = bookmarksMap.current.get(folderId);
    if (folder) {
      setFolderStack(prev => [...prev, folder]);
      setCurrentFolderId(folderId);
    }
  };

  // 导航返回上级文件夹
  const navigateBack = () => {
    if (folderStack.length > 0) {
      const newStack = [...folderStack];
      newStack.pop(); // 移除当前文件夹
      
      setFolderStack(newStack);
      
      if (newStack.length > 0) {
        // 设置为上一级文件夹
        setCurrentFolderId(newStack[newStack.length - 1].id);
      } else {
        // 回到根级
        setCurrentFolderId(null);
      }
    }
  };

  // 处理结果并显示提示
  const handleResult = (result: BookmarkResult, successMessage: string) => {
    if (result.success) {
      toastRef.current?.showToast(successMessage, 'success');
      // 重新加载书签以反映更改
      loadBookmarks();
      return true;
    } else {
      toastRef.current?.showToast(result.error || '操作失败', 'error');
      return false;
    }
  };

  // 添加书签
  const handleAddBookmark = async (bookmark: { parentId?: string; title: string; url: string }) => {
    // 如果没有指定parentId且当前在根级别，使用书签栏ID
    if (!bookmark.parentId && !currentFolderId && bookmarkBarId) {
      bookmark.parentId = bookmarkBarId;
    }
    const result = await bookmarkService.createBookmark(bookmark);
    handleResult(result, '书签已添加');
  };

  // 添加文件夹
  const handleAddFolder = async (folder: { parentId?: string; title: string }) => {
    // 如果没有指定parentId且当前在根级别，使用书签栏ID
    if (!folder.parentId && !currentFolderId && bookmarkBarId) {
      folder.parentId = bookmarkBarId;
    }
    const result = await bookmarkService.createFolder(folder);
    handleResult(result, '文件夹已创建');
  };

  // 编辑书签
  const handleEditBookmark = async (id: string, changes: { title?: string; url?: string }) => {
    const result = await bookmarkService.updateBookmark(id, changes);
    handleResult(result, '书签已更新');
  };

  // 删除书签
  const handleDeleteBookmark = async (id: string) => {
    const result = await bookmarkService.removeBookmark(id);
    handleResult(result, '书签已删除');
  };

  // 删除文件夹
  const handleDeleteFolder = async (id: string) => {
    const result = await bookmarkService.removeBookmarkTree(id);
    handleResult(result, '文件夹已删除');
  };

  // 添加书签移动处理方法
  const handleMoveBookmark = async (bookmarkId: string, destinationFolderId: string, index?: number) => {
    try {
      // 获取当前书签信息以确认是否是文件夹
      const bookmarkItem = bookmarksMap.current.get(bookmarkId);
      
      // 检查是否是尝试将文件夹拖入其子文件夹（这是不允许的）
      if (bookmarkItem?.isFolder) {
        if (isSubfolder(bookmarkId, destinationFolderId)) {
          toastRef.current?.showToast('不能将文件夹移动到其子文件夹中', 'error');
          return false;
        }
      }
      
      const destination: { parentId: string; index?: number } = {
        parentId: destinationFolderId
      };
      
      // 如果提供了索引，也传入索引
      if (index !== undefined) {
        destination.index = index;
      }
      
      const result = await bookmarkService.moveBookmark(bookmarkId, destination);
      return handleResult(result, '书签已移动');
    } catch (error) {
      console.error('移动书签错误:', error);
      toastRef.current?.showToast('移动书签时发生错误', 'error');
      return false;
    }
  };
  
  // 检查是否是子文件夹的辅助函数
  const isSubfolder = (folderId: string, possibleSubfolderId: string): boolean => {
    // 如果尝试移动到自己，返回true（不允许）
    if (folderId === possibleSubfolderId) {
      return true;
    }
    
    let folder = bookmarksMap.current.get(possibleSubfolderId);
    while (folder && folder.parentId) {
      if (folder.parentId === folderId) {
        return true;
      }
      folder = bookmarksMap.current.get(folder.parentId);
    }
    return false;
  };

  // 渲染书签视图
  const renderBookmarkView = () => {
    if (isLoading) {
      return <LoadingIndicator message="加载书签中..." />;
    }

    const commonProps = {
      bookmarks: currentBookmarks,
      parentFolder: folderStack.length > 0 ? folderStack[folderStack.length - 1] : undefined,
      isLoading: isLoading,
      onAddBookmark: handleAddBookmark,
      onAddFolder: handleAddFolder,
      onEditBookmark: handleEditBookmark,
      onDeleteBookmark: handleDeleteBookmark,
      onDeleteFolder: handleDeleteFolder,
      onNavigateToFolder: navigateToFolder,
      onNavigateBack: navigateBack,
      onMoveBookmark: handleMoveBookmark,
      viewType: viewType,
      onViewTypeChange: handleViewTypeChange,
      sortMethod: sortMethod,
      onSortChange: handleSortChange
    };

    return viewType === 'grid' ? 
      <BookmarkGrid {...commonProps} /> : 
      <BookmarkList {...commonProps} />;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 书签内容区域 */}
      {renderBookmarkView()}
    </Box>
  );
};

export default BookmarksView; 