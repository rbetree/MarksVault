import React, { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react';
import Box from '@mui/material/Box';
import BookmarkGrid from './BookmarkGrid';
import BookmarkList from './BookmarkList';
import LoadingIndicator from '../shared/LoadingIndicator';
import ViewToggleButton from './ViewToggleButton';
import { ToastRef } from '../shared/Toast';
import bookmarkService, { BookmarkItem, BookmarkResult } from '../../../utils/bookmark-service';
import storageService, { UserSettings } from '../../../utils/storage-service';

function sortBookmarks(bookmarks: BookmarkItem[], method: 'default' | 'name' | 'dateAdded'): BookmarkItem[] {
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
}

interface BookmarksViewProps {
  toastRef: React.RefObject<ToastRef>;
}

const BookmarksView: React.FC<BookmarksViewProps> = ({ toastRef }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<BookmarkItem[]>([]);
  const [viewType, setViewType] = useState<'list' | 'grid'>('grid'); // 默认使用网格视图
  const [bookmarkBarId, setBookmarkBarId] = useState<string | null>(null); // 添加书签栏ID状态变量
  const [sortMethod, setSortMethod] = useState<'default' | 'name' | 'dateAdded'>('default');
  const bookmarksMap = useRef<Map<string, BookmarkItem>>(new Map());

  // 当前文件夹的一层 children（原始顺序）；展示层通过 sortMethod 做派生排序
  const [currentFolderItems, setCurrentFolderItems] = useState<BookmarkItem[]>([]);
  const currentBookmarks = useMemo(
    () => sortBookmarks(currentFolderItems, sortMethod),
    [currentFolderItems, sortMethod]
  );

  // 搜索：debounce + 竞态控制（last-write-wins）+ 低优先级更新（startTransition）
  const searchDebounceTimerRef = useRef<number | null>(null);
  const searchRequestSeqRef = useRef(0);
  const [, startTransition] = useTransition();

  // 生命周期与空闲任务控制（两阶段启动：首屏轻量 + 空闲期索引）
  const isUnmountedRef = useRef(false);
  const indexIdleHandleRef = useRef<number | null>(null);

  // 添加搜索相关状态
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarkItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 两阶段启动：
  // - 阶段1（首屏）：仅获取根节点一层 children，确定“书签栏 folderId”，再按需 getChildren(folderId) 渲染
  // - 阶段2（空闲期）：再拉全量 getTree 并构建 bookmarksMap（用于搜索 enrich / 拖拽校验等）
  useEffect(() => {
    isUnmountedRef.current = false;
    void loadUserSettings();

    const initQuickStart = async () => {
      setIsLoading(true);
      try {
        const rootsResult = await bookmarkService.getFolderChildren('0');
        if (!rootsResult.success || !Array.isArray(rootsResult.data) || rootsResult.data.length === 0) {
          toastRef.current?.showToast(rootsResult.error || '获取书签根目录失败', 'error');
          setIsLoading(false);
          return;
        }

        // 根节点 children 通常为："1"(书签栏) / "2"(其他书签) / "3"(移动设备书签)
        const roots = rootsResult.data as BookmarkItem[];
        const bookmarkBar = roots.find(r => r.id === '1') ?? roots[0];
        if (!isUnmountedRef.current) {
          setBookmarkBarId(bookmarkBar.id);
          // currentFolderId 仍用 null 表示“根视图”，实际展示为 bookmarkBarId 的 children
        }
      } catch (error) {
        console.error('初始化书签根目录错误:', error);
        toastRef.current?.showToast('初始化书签根目录时发生错误', 'error');
        setIsLoading(false);
      }
    };

    void initQuickStart();

    // 空闲期构建全量索引：不阻塞首屏
    const w = window as any;
    const runIndexBuild = () => {
      void buildBookmarksIndexInBackground();
    };
    if (typeof w.requestIdleCallback === 'function') {
      indexIdleHandleRef.current = w.requestIdleCallback(runIndexBuild, { timeout: 2000 });
    } else {
      indexIdleHandleRef.current = window.setTimeout(runIndexBuild, 500);
    }

    return () => {
      isUnmountedRef.current = true;
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
        searchDebounceTimerRef.current = null;
      }
      // 失效所有进行中的搜索请求
      searchRequestSeqRef.current += 1;

      const w = window as any;
      if (indexIdleHandleRef.current !== null) {
        if (typeof w.cancelIdleCallback === 'function') {
          w.cancelIdleCallback(indexIdleHandleRef.current);
        } else {
          clearTimeout(indexIdleHandleRef.current);
        }
        indexIdleHandleRef.current = null;
      }
    };
  }, []);

  // 文件夹变化（或首次拿到 bookmarkBarId）时：按需加载当前目录一层 children
  useEffect(() => {
    void refreshCurrentFolderChildren();
  }, [currentFolderId, bookmarkBarId]);

  // 排序方式变化时：如果处于搜索态，需要同步对 searchResults 重排（不必等下一次搜索）
  useEffect(() => {
    if (!isSearching) return;

    startTransition(() => {
      setSearchResults(prev => sortBookmarks(prev, sortMethod));
    });
  }, [isSearching, sortMethod, startTransition]);

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
  const handleViewTypeChange = useCallback((type: 'list' | 'grid') => {
    setViewType(type);
    saveViewTypeSetting(type);
  }, []);

  // 处理排序方法变更
  const handleSortChange = useCallback((method: 'default' | 'name' | 'dateAdded') => {
    setSortMethod(method);
  }, []);


  const performSearch = useCallback(async (query: string, requestSeq: number) => {
    try {
      const result = await bookmarkService.searchBookmarks(query);

      // last-write-wins：只接受最新一次请求的结果
      if (requestSeq !== searchRequestSeqRef.current) {
        return;
      }

      if (result.success && result.data) {
        // 回填文件夹的 children（用于展示 children.length），避免 item 级别额外 API 调用
        const enriched: BookmarkItem[] = result.data.map((item: BookmarkItem) => {
          if (!item.isFolder) return item;
          const fullNode = bookmarksMap.current.get(item.id);
          return fullNode?.children
            ? { ...item, children: fullNode.children }
            : item;
        });

        const sorted = sortBookmarks(enriched, sortMethod);
        startTransition(() => {
          setSearchResults(sorted);
        });
      } else {
        startTransition(() => {
          setSearchResults([]);
        });
        if (result.error) {
          toastRef.current?.showToast('搜索书签失败: ' + result.error, 'error');
        }
      }
    } catch (error) {
      if (requestSeq !== searchRequestSeqRef.current) {
        return;
      }
      console.error('搜索书签错误:', error);
      startTransition(() => {
        setSearchResults([]);
      });
      toastRef.current?.showToast('搜索书签时发生错误', 'error');
    }
  }, [sortMethod, startTransition, toastRef]);

  // 处理搜索（仅负责：更新输入值 + debounce 调度）
  const handleSearch = useCallback((query: string) => {
    // 防御：IME / 事件目标异常时，避免 query 变成 undefined 导致崩溃
    const safeQuery = typeof query === 'string' ? query : '';

    setSearchText(safeQuery);

    // 取消上一次的 debounce
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }

    if (!safeQuery.trim()) {
      // 失效所有进行中的搜索请求
      searchRequestSeqRef.current += 1;
      setIsSearching(false);
      startTransition(() => {
        setSearchResults([]);
      });
      return;
    }

    setIsSearching(true);

    const requestSeq = ++searchRequestSeqRef.current;
    searchDebounceTimerRef.current = window.setTimeout(() => {
      performSearch(safeQuery, requestSeq);
    }, 250);
  }, [isSearching, performSearch, startTransition]);

  // 清除搜索
  const clearSearch = useCallback(() => {
    setSearchText('');
    setIsSearching(false);

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }

    // 失效所有进行中的搜索请求
    searchRequestSeqRef.current += 1;

    startTransition(() => {
      setSearchResults([]);
    });
  }, [startTransition]);

  // 加载书签树
  const loadBookmarks = async () => {
    setIsLoading(true);
    try {
      const result = await bookmarkService.getAllBookmarks();
      if (result.success && result.data) {
        setBookmarks(result.data);
        // 构建书签映射，便于快速查找
        buildBookmarkMap(result.data);
        // 重新加载后需要刷新当前目录展示（否则不会自动更新）
        await refreshCurrentFolderChildren({ silent: true });
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

  // 将“展示需要的派生数据”尽量从索引层补齐（例如 folder children 用于展示 children.length）
  const enrichItemsFromMap = useCallback((items: BookmarkItem[]): BookmarkItem[] => {
    return items.map(item => {
      if (!item.isFolder) return item;
      const fullNode = bookmarksMap.current.get(item.id);
      return fullNode?.children ? { ...item, children: fullNode.children } : item;
    });
  }, []);

  // 按需加载当前目录一层 children（优先使用已构建的 bookmarksMap，否则走轻量 getChildren）
  const refreshCurrentFolderChildren = useCallback(async (options?: { silent?: boolean }) => {
    const folderId = currentFolderId ?? bookmarkBarId;
    if (!folderId) return;

    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      const cachedFolder = bookmarksMap.current.get(folderId);
      if (cachedFolder?.children) {
        if (!isUnmountedRef.current) {
          setCurrentFolderItems(enrichItemsFromMap(cachedFolder.children));
        }
        return;
      }

      const result = await bookmarkService.getFolderChildren(folderId);
      if (isUnmountedRef.current) return;

      if (result.success && Array.isArray(result.data)) {
        setCurrentFolderItems(enrichItemsFromMap(result.data as BookmarkItem[]));
      } else {
        toastRef.current?.showToast(result.error || '获取书签失败', 'error');
        setCurrentFolderItems([]);
      }
    } catch (error) {
      if (isUnmountedRef.current) return;
      console.error('加载目录书签错误:', error);
      toastRef.current?.showToast('加载目录书签时发生错误', 'error');
      setCurrentFolderItems([]);
    } finally {
      if (!options?.silent && !isUnmountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [bookmarkBarId, currentFolderId, enrichItemsFromMap, toastRef]);

  // 阶段2：空闲期构建全量索引（不影响首屏交互）
  const buildBookmarksIndexInBackground = useCallback(async () => {
    // 已有索引则不重复构建
    if (bookmarksMap.current.size > 0) return;

    try {
      const result = await bookmarkService.getAllBookmarks();
      if (isUnmountedRef.current) return;

      if (result.success && result.data) {
        setBookmarks(result.data);
        buildBookmarkMap(result.data);

        // 尽可能用索引补齐当前目录 items 的 children 信息（用于展示 children.length）
        setCurrentFolderItems(prev => enrichItemsFromMap(prev));
      }
    } catch (error) {
      // 背景索引失败不打扰用户，只记录日志；显式 reload 时仍会走 loadBookmarks()
      console.warn('后台构建书签索引失败:', error);
    }
  }, [enrichItemsFromMap]);

  // 导航到指定文件夹
  const navigateToFolder = useCallback(async (folderId: string) => {
    // 导航到新文件夹时清除搜索状态
    clearSearch();

    const folderFromList = (isSearching ? searchResults : currentBookmarks).find(b => b.id === folderId);
    let folder = folderFromList ?? bookmarksMap.current.get(folderId);

    // 极端兜底：列表与索引都未命中时，直接查一次 Chrome API 获取节点信息
    if (!folder) {
      const result = await bookmarkService.getBookmarkById(folderId);
      if (result.success && result.data) {
        folder = result.data as BookmarkItem;
      }
    }

    if (folder) {
      setFolderStack(prev => [...prev, folder]);
      setCurrentFolderId(folderId);
    }
  }, [clearSearch, currentBookmarks, isSearching, searchResults]);

  // 导航返回上级文件夹
  const navigateBack = useCallback(() => {
    // 导航返回时清除搜索状态
    clearSearch();

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
  }, [clearSearch, folderStack.length]);

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
  const handleAddBookmark = useCallback(async (bookmark: { parentId?: string; title: string; url: string }) => {
    // 如果没有指定parentId且当前在根级别，使用书签栏ID
    if (!bookmark.parentId && !currentFolderId && bookmarkBarId) {
      bookmark.parentId = bookmarkBarId;
    }
    const result = await bookmarkService.createBookmark(bookmark);
    handleResult(result, '书签已添加');
  }, [bookmarkBarId, currentFolderId]);

  // 添加文件夹
  const handleAddFolder = useCallback(async (folder: { parentId?: string; title: string }) => {
    // 如果没有指定parentId且当前在根级别，使用书签栏ID
    if (!folder.parentId && !currentFolderId && bookmarkBarId) {
      folder.parentId = bookmarkBarId;
    }
    const result = await bookmarkService.createFolder(folder);
    handleResult(result, '文件夹已创建');
  }, [bookmarkBarId, currentFolderId]);

  // 编辑书签
  const handleEditBookmark = useCallback(async (id: string, changes: { title?: string; url?: string }) => {
    const result = await bookmarkService.updateBookmark(id, changes);
    handleResult(result, '书签已更新');
  }, []);

  // 删除书签
  const handleDeleteBookmark = useCallback(async (id: string) => {
    const result = await bookmarkService.removeBookmark(id);
    handleResult(result, '书签已删除');
  }, []);

  // 删除文件夹
  const handleDeleteFolder = useCallback(async (id: string) => {
    const result = await bookmarkService.removeBookmarkTree(id);
    handleResult(result, '文件夹已删除');
  }, []);

  // 添加书签移动处理方法
  const handleMoveBookmark = useCallback(async (bookmarkId: string, destinationFolderId: string, index?: number) => {
    try {
      // 获取当前书签信息以确认是否是文件夹
      let bookmarkItem = bookmarksMap.current.get(bookmarkId);

      // 两阶段启动下，首屏可能尚未构建全量索引：必要时补一次节点查询
      if (!bookmarkItem) {
        const result = await bookmarkService.getBookmarkById(bookmarkId);
        if (result.success && result.data) {
          bookmarkItem = result.data as BookmarkItem;
        }
      }

      // 检查是否是尝试将文件夹拖入其子文件夹（这是不允许的）
      if (bookmarkItem?.isFolder) {
        if (await isSubfolder(bookmarkId, destinationFolderId)) {
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
  }, [toastRef]);

  // 检查是否是子文件夹的辅助函数
  const isSubfolder = async (folderId: string, possibleSubfolderId: string): Promise<boolean> => {
    // 如果尝试移动到自己，返回true（不允许）
    if (folderId === possibleSubfolderId) {
      return true;
    }

    // 优先走已构建的 bookmarksMap；若索引未就绪则退化为按需查 parentId 链
    let currentId: string | null = possibleSubfolderId;
    for (let depth = 0; depth < 128 && currentId; depth++) {
      const cached = bookmarksMap.current.get(currentId);
      const parentIdFromCache = cached?.parentId;
      if (parentIdFromCache) {
        if (parentIdFromCache === folderId) return true;
        currentId = parentIdFromCache;
        continue;
      }

      const result = await bookmarkService.getBookmarkById(currentId);
      if (!result.success || !result.data) return false;
      const node = result.data as BookmarkItem;
      if (!node.parentId) return false;
      if (node.parentId === folderId) return true;
      currentId = node.parentId;
    }
    return false;
  };

  const displayedBookmarks = isSearching ? searchResults : currentBookmarks;
  const parentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : undefined;

  const commonProps = useMemo(() => ({
    bookmarks: displayedBookmarks,
    parentFolder,
    isLoading,
    onAddBookmark: handleAddBookmark,
    onAddFolder: handleAddFolder,
    onEditBookmark: handleEditBookmark,
    onDeleteBookmark: handleDeleteBookmark,
    onDeleteFolder: handleDeleteFolder,
    onNavigateToFolder: navigateToFolder,
    onNavigateBack: navigateBack,
    onMoveBookmark: handleMoveBookmark,
    viewType,
    onViewTypeChange: handleViewTypeChange,
    sortMethod,
    onSortChange: handleSortChange,
    searchText,
    isSearching,
    onSearch: handleSearch,
    onClearSearch: clearSearch
  }), [
    displayedBookmarks,
    parentFolder,
    isLoading,
    handleAddBookmark,
    handleAddFolder,
    handleEditBookmark,
    handleDeleteBookmark,
    handleDeleteFolder,
    navigateToFolder,
    navigateBack,
    handleMoveBookmark,
    viewType,
    handleViewTypeChange,
    sortMethod,
    handleSortChange,
    searchText,
    isSearching,
    handleSearch,
    clearSearch
  ]);

  // 渲染书签视图
  const renderBookmarkView = () => {
    return viewType === 'grid'
      ? <BookmarkGrid {...commonProps} />
      : <BookmarkList {...commonProps} />;
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 书签内容区域 */}
      {renderBookmarkView()}
    </Box>
  );
};

export default BookmarksView; 
