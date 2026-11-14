import React, { useCallback, useEffect, useRef, useState } from 'react';
import bookmarkService, { BookmarkItem } from '../../../utils/bookmark-service';
import storageService from '../../../utils/storage-service';
import { ToastRef } from '../shared/Toast';

interface BookmarksViewStateCache {
  lastFolderId: string | null;
}

const BOOKMARKS_VIEW_STATE_KEY = 'bookmarksViewState';

interface UseBookmarkFolderNavigationOptions {
  toastRef: React.RefObject<ToastRef>;
  bookmarksMap: React.MutableRefObject<Map<string, BookmarkItem>>;
  isUnmountedRef: React.MutableRefObject<boolean>;
  upsertBookmarkInMap: (item: BookmarkItem) => BookmarkItem;
  enrichItemsFromMap: (items: BookmarkItem[]) => BookmarkItem[];
  setFolderChildrenInMap: (folderId: string, children: BookmarkItem[]) => void;
  clearSearch: () => void;
  isSearching: boolean;
  searchResults: BookmarkItem[];
}

const useBookmarkFolderNavigation = ({
  toastRef,
  bookmarksMap,
  isUnmountedRef,
  upsertBookmarkInMap,
  enrichItemsFromMap,
  setFolderChildrenInMap,
  clearSearch,
  isSearching,
  searchResults,
}: UseBookmarkFolderNavigationOptions) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<BookmarkItem[]>([]);
  const [bookmarkBarId, setBookmarkBarId] = useState<string | null>(null); // 添加书签栏ID状态变量
  const [currentFolderItems, setCurrentFolderItems] = useState<BookmarkItem[]>([]);

  // 事件回调需要拿到最新状态，避免闭包过期
  const currentFolderIdRef = useRef<string | null>(null);
  const bookmarkBarIdRef = useRef<string | null>(null);
  const folderStackRef = useRef<BookmarkItem[]>([]);
  const currentFolderItemsRef = useRef<BookmarkItem[]>([]);
  const refreshCurrentFolderChildrenRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => { });

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId;
  }, [currentFolderId]);

  useEffect(() => {
    bookmarkBarIdRef.current = bookmarkBarId;
  }, [bookmarkBarId]);

  useEffect(() => {
    folderStackRef.current = folderStack;
  }, [folderStack]);

  useEffect(() => {
    currentFolderItemsRef.current = currentFolderItems;
  }, [currentFolderItems]);

  // 恢复上次打开目录（用于两阶段启动的“优先上次 folderId”）
  const restoreLastFolder = useCallback(async (rootFolderId: string) => {
    try {
      const result = await storageService.getStorageData(BOOKMARKS_VIEW_STATE_KEY);
      if (!result.success || !result.data) return;

      const cache = result.data as Partial<BookmarksViewStateCache>;
      const lastFolderId = typeof cache.lastFolderId === 'string' ? cache.lastFolderId : null;
      if (!lastFolderId) return;

      // 兼容：如果存的是书签栏根目录，直接回到根视图
      if (lastFolderId === rootFolderId) {
        setFolderStack([]);
        setCurrentFolderId(null);
        return;
      }

      const targetResult = await bookmarkService.getBookmarkById(lastFolderId);
      if (!targetResult.success || !targetResult.data) return;

      const target = targetResult.data as BookmarkItem;
      if (!target.isFolder) return;

      // 构造 folderStack：从 rootFolderId 的子目录开始到目标目录（不包含 rootFolderId 自身）
      const chain: BookmarkItem[] = [];
      chain.push(target);
      upsertBookmarkInMap(target);

      let cursor: BookmarkItem = target;
      for (let depth = 0; depth < 64; depth++) {
        const parentId = cursor.parentId;
        if (!parentId || parentId === rootFolderId) break;

        const parentResult = await bookmarkService.getBookmarkById(parentId);
        if (!parentResult.success || !parentResult.data) break;

        const parent = parentResult.data as BookmarkItem;
        if (!parent.isFolder) break;
        chain.push(parent);
        upsertBookmarkInMap(parent);
        cursor = parent;
      }

      const stack = chain.reverse();
      setFolderStack(stack);
      setCurrentFolderId(lastFolderId);
    } catch (error) {
      console.warn('恢复上次打开目录失败:', error);
    }
  }, [upsertBookmarkInMap]);

  // 持久化 popup 最后一次停留目录（避免仅在 unload/hidden 时写入导致丢失）
  const persistViewState = useCallback((folderId: string | null) => {
    const lastFolderId = folderId ?? bookmarkBarIdRef.current ?? null;
    // 启动/关闭竞态：bookmarkBarId 还未写入时，避免把 lastFolderId 覆盖为 null
    if (!lastFolderId) return;
    const data: BookmarksViewStateCache = { lastFolderId };
    void storageService.setStorageData(BOOKMARKS_VIEW_STATE_KEY, data);
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
          const enriched = enrichItemsFromMap(cachedFolder.children);
          setCurrentFolderItems(enriched);
          setFolderChildrenInMap(folderId, enriched);
        }
        return;
      }

      const result = await bookmarkService.getFolderChildren(folderId);
      if (isUnmountedRef.current) return;

      if (result.success && Array.isArray(result.data)) {
        const enriched = enrichItemsFromMap(result.data as BookmarkItem[]);
        setCurrentFolderItems(enriched);
        setFolderChildrenInMap(folderId, enriched);
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
  }, [bookmarkBarId, currentFolderId, enrichItemsFromMap, setFolderChildrenInMap, toastRef]);
  refreshCurrentFolderChildrenRef.current = refreshCurrentFolderChildren;

  // 文件夹变化（或首次拿到 bookmarkBarId）时：按需加载当前目录一层 children
  useEffect(() => {
    void refreshCurrentFolderChildren();
  }, [currentFolderId, bookmarkBarId]);

  // 导航到指定文件夹
  const navigateToFolder = useCallback(async (folderId: string) => {
    // 导航到新文件夹时清除搜索状态
    clearSearch();

    const folderFromList = (isSearching ? searchResults : currentFolderItems).find(b => b.id === folderId);
    let folder = folderFromList ?? bookmarksMap.current.get(folderId);

    // 极端兜底：列表与索引都未命中时，直接查一次 Chrome API 获取节点信息
    if (!folder) {
      const result = await bookmarkService.getBookmarkById(folderId);
      if (result.success && result.data) {
        folder = result.data as BookmarkItem;
      }
    }

    if (folder) {
      upsertBookmarkInMap(folder);
      setFolderStack(prev => [...prev, folder]);
      setCurrentFolderId(folderId);
      persistViewState(folderId);
    }
  }, [clearSearch, currentFolderItems, isSearching, persistViewState, searchResults, upsertBookmarkInMap]);

  // 导航返回上级文件夹
  const navigateBack = useCallback(() => {
    // 导航返回时清除搜索状态
    clearSearch();

    if (folderStack.length > 0) {
      const newStack = [...folderStack];
      newStack.pop(); // 移除当前文件夹

      setFolderStack(newStack);

      const newFolderId = newStack.length > 0 ? newStack[newStack.length - 1].id : null;
      setCurrentFolderId(newFolderId);
      persistViewState(newFolderId);
    }
  }, [clearSearch, folderStack, persistViewState]);

  // 面包屑跳转：跳到指定历史层级（folderId 为 null 表示回到书签栏根目录）
  const navigateToCrumb = useCallback((folderId: string | null) => {
    clearSearch();

    if (folderId === null) {
      setFolderStack([]);
      setCurrentFolderId(null);
      persistViewState(null);
      return;
    }

    const index = folderStack.findIndex(folder => folder.id === folderId);
    if (index < 0) return;
    setFolderStack(folderStack.slice(0, index + 1));
    setCurrentFolderId(folderId);
    persistViewState(folderId);
  }, [clearSearch, folderStack, persistViewState]);

  return {
    isLoading,
    currentFolderId,
    currentFolderItems,
    folderStack,
    bookmarkBarId,
    currentFolderIdRef,
    bookmarkBarIdRef,
    folderStackRef,
    currentFolderItemsRef,
    refreshCurrentFolderChildrenRef,
    setCurrentFolderId,
    setCurrentFolderItems,
    setFolderStack,
    setBookmarkBarId,
    setIsLoading,
    restoreLastFolder,
    persistViewState,
    refreshCurrentFolderChildren,
    navigateToFolder,
    navigateBack,
    navigateToCrumb,
  };
};

export { useBookmarkFolderNavigation };
