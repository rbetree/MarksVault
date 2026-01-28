import React, { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react';
import { browser, type Browser } from 'wxt/browser';
import BookmarkGrid from './BookmarkGrid';
import BookmarkList from './BookmarkList';
import PageLayout from '../shared/PageLayout';
import { BookmarksHeader } from './BookmarksHeader';
import { ToastRef } from '../shared/Toast';
import bookmarkService, { BookmarkItem, BookmarkResult } from '../../../utils/bookmark-service';
import storageService, { UserSettings } from '../../../utils/storage-service';

interface BookmarksViewProps {
  toastRef: React.RefObject<ToastRef>;
}

interface BookmarksViewStateCache {
  lastFolderId: string | null;
}

const BOOKMARKS_VIEW_STATE_KEY = 'bookmarksViewState';

const BookmarksView: React.FC<BookmarksViewProps> = ({ toastRef }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<BookmarkItem[]>([]);
  const [viewType, setViewType] = useState<'list' | 'grid'>('grid'); // 默认使用网格视图
  const [bookmarkBarId, setBookmarkBarId] = useState<string | null>(null); // 添加书签栏ID状态变量
  const bookmarksMap = useRef<Map<string, BookmarkItem>>(new Map());
  const fullIndexBuiltRef = useRef(false);
  const isBuildingFullIndexRef = useRef(false);

  // 事件回调需要拿到最新状态，避免闭包过期
  const currentFolderIdRef = useRef<string | null>(null);
  const bookmarkBarIdRef = useRef<string | null>(null);
  const folderStackRef = useRef<BookmarkItem[]>([]);
  const currentFolderItemsRef = useRef<BookmarkItem[]>([]);
  const isSearchingRef = useRef(false);
  const refreshCurrentFolderChildrenRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => { });
  const pathCacheRef = useRef<Map<string, string>>(new Map());

  // 当前文件夹的一层 children（原始顺序）
  const [currentFolderItems, setCurrentFolderItems] = useState<BookmarkItem[]>([]);
  const currentBookmarks = currentFolderItems;

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

  useEffect(() => {
    isSearchingRef.current = isSearching;
  }, [isSearching]);

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
        // 先把根节点信息写入索引（此时仍是“部分索引”，不会阻止后续空闲期构建全量索引）
        roots.forEach(root => {
          upsertBookmarkInMap(root);
        });
        const bookmarkBar = roots.find(r => r.id === '1') ?? roots[0];
        if (!isUnmountedRef.current) {
          setBookmarkBarId(bookmarkBar.id);
          // currentFolderId 仍用 null 表示“根视图”，实际展示为 bookmarkBarId 的 children
          void restoreLastFolder(bookmarkBar.id);
        }
      } catch (error) {
        console.error('初始化书签根目录错误:', error);
        toastRef.current?.showToast('初始化书签根目录时发生错误', 'error');
        setIsLoading(false);
      }
    };

    void initQuickStart();

    // 记录 popup 最后一次停留的目录（用于下次启动恢复）
    const saveViewState = () => {
      persistViewState(currentFolderIdRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveViewState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

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
      saveViewState();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

        startTransition(() => {
          setSearchResults(enriched);
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
  }, [startTransition, toastRef]);

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
        fullIndexBuiltRef.current = true;
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

  // 写入/合并单个节点到 bookmarksMap（尽量保留已缓存的 children）
  const upsertBookmarkInMap = useCallback((item: BookmarkItem): BookmarkItem => {
    const existing = bookmarksMap.current.get(item.id);

    const merged: BookmarkItem = {
      ...existing,
      ...item,
      parentId: item.parentId ?? existing?.parentId,
      url: item.url !== undefined ? item.url : existing?.url,
      children: item.children !== undefined ? item.children : existing?.children,
    };

    bookmarksMap.current.set(item.id, merged);
    return merged;
  }, []);

  // 将某个文件夹的 children 写入索引（同时 upsert children 本身）
  const setFolderChildrenInMap = useCallback((folderId: string, children: BookmarkItem[]) => {
    const normalizedChildren = children.map(child => upsertBookmarkInMap(child));
    const existingFolder = bookmarksMap.current.get(folderId);
    upsertBookmarkInMap({
      id: folderId,
      parentId: existingFolder?.parentId,
      title: existingFolder?.title ?? '',
      url: undefined,
      isFolder: true,
      children: normalizedChildren,
      dateAdded: existingFolder?.dateAdded,
      dateGroupModified: existingFolder?.dateGroupModified,
      index: existingFolder?.index,
    });
  }, [upsertBookmarkInMap]);

  // 搜索结果 hover 时需要展示书签路径：按需计算并缓存（避免对每条结果做全量计算）
  const resolveBookmarkPath = useCallback(async (bookmarkId: string): Promise<string> => {
    const cached = pathCacheRef.current.get(bookmarkId);
    if (cached) return cached;

    const titles: string[] = [];
    let currentId: string | undefined = bookmarkId;

    for (let depth = 0; depth < 64 && currentId; depth++) {
      let node = bookmarksMap.current.get(currentId);
      if (!node) {
        const result = await bookmarkService.getBookmarkById(currentId);
        if (!result.success || !result.data) break;
        node = result.data as BookmarkItem;
        upsertBookmarkInMap(node);
      }

      if (node.title) titles.push(node.title);
      currentId = node.parentId;
      if (!currentId || currentId === '0') break;
    }

    const path = titles.reverse().join(' / ');
    pathCacheRef.current.set(bookmarkId, path);
    return path;
  }, [upsertBookmarkInMap]);

  // 在列表中按 index 插入（若已存在同 id，则先去重）
  const insertAtIndexDedup = useCallback((list: BookmarkItem[], item: BookmarkItem, index?: number): BookmarkItem[] => {
    const without = list.filter(x => x.id !== item.id);
    const safeIndex = typeof index === 'number' && index >= 0
      ? Math.min(index, without.length)
      : without.length;
    return [...without.slice(0, safeIndex), item, ...without.slice(safeIndex)];
  }, []);

  // 在列表中移动某个元素到目标 index（若不存在则原样返回）
  const moveInList = useCallback((list: BookmarkItem[], itemId: string, newIndex: number): BookmarkItem[] => {
    const fromIndex = list.findIndex(x => x.id === itemId);
    if (fromIndex < 0) return list;
    const item = list[fromIndex];
    const without = [...list.slice(0, fromIndex), ...list.slice(fromIndex + 1)];
    const safeIndex = Math.max(0, Math.min(newIndex, without.length));
    return [...without.slice(0, safeIndex), item, ...without.slice(safeIndex)];
  }, []);

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

  // 阶段2：空闲期构建全量索引（不影响首屏交互）
  const buildBookmarksIndexInBackground = useCallback(async () => {
    // 注意：首屏可能已经构建了“部分索引”，不能用 map.size 来判断是否完成全量索引
    if (fullIndexBuiltRef.current || isBuildingFullIndexRef.current) return;
    isBuildingFullIndexRef.current = true;

    try {
      const result = await bookmarkService.getAllBookmarks();
      if (isUnmountedRef.current) return;

      if (result.success && result.data) {
        setBookmarks(result.data);
        buildBookmarkMap(result.data);
        fullIndexBuiltRef.current = true;

        // 尽可能用索引补齐当前目录 items 的 children 信息（用于展示 children.length）
        setCurrentFolderItems(prev => enrichItemsFromMap(prev));
      }
    } catch (error) {
      // 背景索引失败不打扰用户，只记录日志；显式 reload 时仍会走 loadBookmarks()
      console.warn('后台构建书签索引失败:', error);
    } finally {
      isBuildingFullIndexRef.current = false;
    }
  }, [enrichItemsFromMap]);

  // 监听 chrome.bookmarks 事件：增量更新索引与当前视图，避免每次操作后全量 reload
  useEffect(() => {
    // 使用 WXT 的 browser 统一 API，避免依赖全局 chrome（Firefox 下可能不存在）
    if (!browser.bookmarks) return;
    type BookmarksOnChangedListener = Parameters<typeof browser.bookmarks.onChanged.addListener>[0];
    type BookmarkChangeInfo = Parameters<BookmarksOnChangedListener>[1];

    type BookmarksOnRemovedListener = Parameters<typeof browser.bookmarks.onRemoved.addListener>[0];
    type BookmarkRemoveInfo = Parameters<BookmarksOnRemovedListener>[1];

    type BookmarksOnMovedListener = Parameters<typeof browser.bookmarks.onMoved.addListener>[0];
    type BookmarkMoveInfo = Parameters<BookmarksOnMovedListener>[1];

    const getEffectiveCurrentFolderId = () => currentFolderIdRef.current ?? bookmarkBarIdRef.current;

    const handleCreated = (_id: string, node: Browser.bookmarks.BookmarkTreeNode) => {
      pathCacheRef.current.clear();
      const item: BookmarkItem = {
        id: node.id,
        parentId: node.parentId,
        title: node.title,
        url: node.url,
        dateAdded: node.dateAdded,
        dateGroupModified: node.dateGroupModified,
        index: node.index,
        isFolder: !node.url,
        // 新建文件夹默认 children 为空数组，避免 UI 端 folderItemCount 为空
        children: node.url ? undefined : [],
      };

      upsertBookmarkInMap(item);

      // 父节点 children 已缓存时，直接增量插入
      if (item.parentId) {
        const parent = bookmarksMap.current.get(item.parentId);
        if (parent?.children) {
          const nextChildren = insertAtIndexDedup(parent.children, item, node.index);
          setFolderChildrenInMap(item.parentId, nextChildren);
        }
      }

      // 如果新建发生在当前视图目录下，直接更新当前列表
      const currentFolderId = getEffectiveCurrentFolderId();
      if (currentFolderId && item.parentId === currentFolderId) {
        const nextItems = insertAtIndexDedup(currentFolderItemsRef.current, item, node.index);
        setCurrentFolderItems(nextItems);
        setFolderChildrenInMap(currentFolderId, nextItems);
      }
    };

    const handleChanged = (id: string, changeInfo: BookmarkChangeInfo) => {
      pathCacheRef.current.clear();
      const existing = bookmarksMap.current.get(id);

      const updated: BookmarkItem = {
        id,
        parentId: existing?.parentId,
        title: changeInfo.title ?? existing?.title ?? '',
        url: changeInfo.url !== undefined ? changeInfo.url : existing?.url,
        dateAdded: existing?.dateAdded,
        dateGroupModified: existing?.dateGroupModified,
        index: existing?.index,
        isFolder: existing?.isFolder ?? false,
        children: existing?.children,
      };

      // changeInfo.url 只有在 url 变化时才会出现；否则不能据此推断 isFolder
      if (changeInfo.url !== undefined) {
        updated.isFolder = !changeInfo.url;
      }

      upsertBookmarkInMap(updated);

      const updateList = (list: BookmarkItem[]): BookmarkItem[] => {
        let changed = false;
        const next = list.map(item => {
          if (item.id !== id) return item;
          changed = true;
          return {
            ...item,
            title: updated.title,
            url: updated.url,
            isFolder: updated.isFolder,
          };
        });
        return changed ? next : list;
      };

      const currentFolderId = getEffectiveCurrentFolderId();
      if (currentFolderId) {
        const nextItems = updateList(currentFolderItemsRef.current);
        if (nextItems !== currentFolderItemsRef.current) {
          setCurrentFolderItems(nextItems);
          setFolderChildrenInMap(currentFolderId, nextItems);
        }
      }

      if (isSearchingRef.current) {
        startTransition(() => {
          setSearchResults(prev => updateList(prev));
        });
      }

      // breadcrumb / folderStack 中的标题也要同步
      setFolderStack(prev => prev.map(f => (f.id === id ? { ...f, title: updated.title } : f)));
    };

    const handleRemoved = (id: string, removeInfo: BookmarkRemoveInfo) => {
      pathCacheRef.current.clear();
      // removeInfo.node 对于文件夹包含完整子树，可用于清理索引
      const removedIds: string[] = [];
      const stack: Browser.bookmarks.BookmarkTreeNode[] = [removeInfo.node];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur) break;
        removedIds.push(cur.id);
        if (cur.children) {
          for (const child of cur.children) {
            stack.push(child);
          }
        }
      }
      const removedSet = new Set(removedIds);
      removedSet.forEach(rid => bookmarksMap.current.delete(rid));

      // 父节点 children 已缓存时，直接增量删除
      if (removeInfo.parentId) {
        const parent = bookmarksMap.current.get(removeInfo.parentId);
        if (parent?.children) {
          const nextChildren = parent.children.filter(ch => ch.id !== id);
          setFolderChildrenInMap(removeInfo.parentId, nextChildren);
        }
      }

      // 当前视图目录下的 item 被删
      const currentFolderId = getEffectiveCurrentFolderId();
      if (currentFolderId && removeInfo.parentId === currentFolderId) {
        const nextItems = currentFolderItemsRef.current.filter(item => item.id !== id);
        if (nextItems.length !== currentFolderItemsRef.current.length) {
          setCurrentFolderItems(nextItems);
          setFolderChildrenInMap(currentFolderId, nextItems);
        }
      }

      // 搜索结果中如果包含被删节点，也要剔除
      if (isSearchingRef.current) {
        startTransition(() => {
          setSearchResults(prev => prev.filter(item => !removedSet.has(item.id)));
        });
      }

      // 如果当前处于被删目录（或其子目录），需要回退到可用目录
      const currentId = currentFolderIdRef.current;
      if (currentId && removedSet.has(currentId)) {
        clearSearch();
        const newStack = folderStackRef.current.filter(f => !removedSet.has(f.id));
        setFolderStack(newStack);
        setCurrentFolderId(newStack.length > 0 ? newStack[newStack.length - 1].id : null);
      } else if (folderStackRef.current.some(f => removedSet.has(f.id))) {
        // breadcrumb 中某一级目录被删，裁剪 stack
        clearSearch();
        const newStack = folderStackRef.current.filter(f => !removedSet.has(f.id));
        setFolderStack(newStack);
      }
    };

    const handleMoved = (id: string, moveInfo: BookmarkMoveInfo) => {
      pathCacheRef.current.clear();
      void (async () => {
        const oldParentId = moveInfo.oldParentId;
        const newParentId = moveInfo.parentId;
        const newIndex = moveInfo.index;

        let moved = bookmarksMap.current.get(id);
        if (!moved) {
          const result = await bookmarkService.getBookmarkById(id);
          if (!result.success || !result.data) {
            // 数据不足时，至少刷新当前目录，避免 UI 卡死
            const currentFolderId = getEffectiveCurrentFolderId();
            if (currentFolderId && (currentFolderId === oldParentId || currentFolderId === newParentId)) {
              await refreshCurrentFolderChildrenRef.current({ silent: true });
            }
            return;
          }
          moved = result.data as BookmarkItem;
        }

        const updated: BookmarkItem = { ...moved, parentId: newParentId, index: newIndex };
        upsertBookmarkInMap(updated);

        // oldParent/newParent children 已缓存时，直接增量更新
        const oldParent = bookmarksMap.current.get(oldParentId);
        if (oldParent?.children) {
          const nextChildren = oldParentId === newParentId
            ? moveInList(oldParent.children, id, newIndex)
            : oldParent.children.filter(ch => ch.id !== id);
          setFolderChildrenInMap(oldParentId, nextChildren);
        }

        if (oldParentId !== newParentId) {
          const newParent = bookmarksMap.current.get(newParentId);
          if (newParent?.children) {
            const nextChildren = insertAtIndexDedup(newParent.children, updated, newIndex);
            setFolderChildrenInMap(newParentId, nextChildren);
          }
        }

        // 当前视图目录下的移动/排序
        const currentFolderId = getEffectiveCurrentFolderId();
        if (!currentFolderId) return;

        if (oldParentId === newParentId && currentFolderId === newParentId) {
          const nextItems = moveInList(currentFolderItemsRef.current, id, newIndex);
          if (nextItems !== currentFolderItemsRef.current) {
            setCurrentFolderItems(nextItems);
            setFolderChildrenInMap(currentFolderId, nextItems);
          }
          return;
        }

        if (currentFolderId === oldParentId) {
          const nextItems = currentFolderItemsRef.current.filter(ch => ch.id !== id);
          if (nextItems.length !== currentFolderItemsRef.current.length) {
            setCurrentFolderItems(nextItems);
            setFolderChildrenInMap(currentFolderId, nextItems);
          }
        }

        if (currentFolderId === newParentId) {
          const nextItems = insertAtIndexDedup(currentFolderItemsRef.current, updated, newIndex);
          setCurrentFolderItems(nextItems);
          setFolderChildrenInMap(currentFolderId, nextItems);
        }
      })();
    };

    browser.bookmarks.onCreated.addListener(handleCreated);
    browser.bookmarks.onChanged.addListener(handleChanged);
    browser.bookmarks.onRemoved.addListener(handleRemoved);
    browser.bookmarks.onMoved.addListener(handleMoved);

    return () => {
      browser.bookmarks.onCreated.removeListener(handleCreated);
      browser.bookmarks.onChanged.removeListener(handleChanged);
      browser.bookmarks.onRemoved.removeListener(handleRemoved);
      browser.bookmarks.onMoved.removeListener(handleMoved);
    };
  }, [
    clearSearch,
    insertAtIndexDedup,
    moveInList,
    setFolderChildrenInMap,
    startTransition,
    upsertBookmarkInMap,
  ]);

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
      upsertBookmarkInMap(folder);
      setFolderStack(prev => [...prev, folder]);
      setCurrentFolderId(folderId);
      persistViewState(folderId);
    }
  }, [clearSearch, currentBookmarks, isSearching, persistViewState, searchResults, upsertBookmarkInMap]);

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

  // 处理结果并显示提示
  const handleResult = (result: BookmarkResult, successMessage: string) => {
    if (result.success) {
      toastRef.current?.showToast(successMessage, 'success');
      // 由 chrome.bookmarks 事件驱动增量更新（避免全量 reload）
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

  // 将指定书签的 URL（以及可选的标题）更新为“当前标签页”
  const handleUpdateToCurrentUrl = useCallback(async (bookmarkId: string) => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs?.[0];
      const url = tab?.url;

      if (!url) {
        toastRef.current?.showToast('无法获取当前标签页网址', 'warning');
        return;
      }

      const changes: { title?: string; url?: string } = { url };
      if (typeof tab.title === 'string' && tab.title.trim()) {
        changes.title = tab.title;
      }

      const result = await bookmarkService.updateBookmark(bookmarkId, changes);
      handleResult(result, '书签已更新');
    } catch (error) {
      console.error('更新为当前网址错误:', error);
      toastRef.current?.showToast('更新书签时发生错误', 'error');
    }
  }, [toastRef]);

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
    onUpdateToCurrentUrl: handleUpdateToCurrentUrl,
    onDeleteBookmark: handleDeleteBookmark,
    onDeleteFolder: handleDeleteFolder,
    onNavigateToFolder: navigateToFolder,
    onNavigateBack: navigateBack,
    onMoveBookmark: handleMoveBookmark,
    viewType,
    onViewTypeChange: handleViewTypeChange,
    searchText,
    isSearching,
    resolveBookmarkPath,
    onSearch: handleSearch,
    onClearSearch: clearSearch
  }), [
    displayedBookmarks,
    parentFolder,
    isLoading,
    handleAddBookmark,
    handleAddFolder,
    handleEditBookmark,
    handleUpdateToCurrentUrl,
    handleDeleteBookmark,
    handleDeleteFolder,
    navigateToFolder,
    navigateBack,
    handleMoveBookmark,
    viewType,
    handleViewTypeChange,
    searchText,
    isSearching,
    resolveBookmarkPath,
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
    <PageLayout
      title={
        <BookmarksHeader
          parentFolder={parentFolder}
          isSearching={isSearching}
          onNavigateBack={navigateBack}
          searchText={searchText}
          onSearch={handleSearch}
          onClearSearch={clearSearch}
          viewType={viewType}
          onViewTypeChange={handleViewTypeChange}
        />
      }
    >
      {renderBookmarkView()}
    </PageLayout>
  );
};

export default BookmarksView; 
