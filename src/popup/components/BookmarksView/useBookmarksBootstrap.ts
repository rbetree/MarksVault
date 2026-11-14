import React, { useEffect, useRef } from 'react';
import bookmarkService, { BookmarkItem, findBookmarkBar } from '../../../utils/bookmark-service';
import { ToastRef } from '../shared/Toast';

interface UseBookmarksBootstrapOptions {
  toastRef: React.RefObject<ToastRef>;
  isUnmountedRef: React.MutableRefObject<boolean>;
  loadUserSettings: () => Promise<void>;
  upsertBookmarkInMap: (item: BookmarkItem) => BookmarkItem;
  setBookmarkRootNodeId: (nodeId: string | null) => void;
  setBookmarkBarId: React.Dispatch<React.SetStateAction<string | null>>;
  restoreLastFolder: (rootFolderId: string) => Promise<void>;
  persistViewState: (folderId: string | null) => void;
  currentFolderIdRef: React.MutableRefObject<string | null>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentFolderItems: React.Dispatch<React.SetStateAction<BookmarkItem[]>>;
  enrichItemsFromMap: (items: BookmarkItem[]) => BookmarkItem[];
  buildFullIndexInBackground: (onIndexBuilt?: () => void) => Promise<void>;
  cancelPendingSearch: () => void;
}

const useBookmarksBootstrap = ({
  toastRef,
  isUnmountedRef,
  loadUserSettings,
  upsertBookmarkInMap,
  setBookmarkRootNodeId,
  setBookmarkBarId,
  restoreLastFolder,
  persistViewState,
  currentFolderIdRef,
  setIsLoading,
  setCurrentFolderItems,
  enrichItemsFromMap,
  buildFullIndexInBackground,
  cancelPendingSearch,
}: UseBookmarksBootstrapOptions) => {
  // 生命周期与空闲任务控制（两阶段启动：首屏轻量 + 空闲期索引）
  const indexIdleHandleRef = useRef<number | null>(null);

  // 两阶段启动：
  // - 阶段1（首屏）：仅获取根节点一层 children，确定“书签栏 folderId”，再按需 getChildren(folderId) 渲染
  // - 阶段2（空闲期）：再拉全量 getTree 并构建 bookmarksMap（用于搜索 enrich / 拖拽校验等）
  useEffect(() => {
    isUnmountedRef.current = false;
    void loadUserSettings();

    const initQuickStart = async () => {
      setIsLoading(true);
      try {
        // 优先走轻量 getChildren("0")（Chrome/Edge），失败时回退到 getTree 根解析（Firefox 兼容）。
        let rootsResult = await bookmarkService.getFolderChildren('0');
        let rootNodeId: string | null = '0';
        if (!rootsResult.success || !Array.isArray(rootsResult.data) || rootsResult.data.length === 0) {
          rootsResult = await bookmarkService.getBookmarkRoots();
          rootNodeId = null;
        }

        if (!rootsResult.success || !Array.isArray(rootsResult.data) || rootsResult.data.length === 0) {
          toastRef.current?.showToast(rootsResult.error || '获取书签根目录失败', 'error');
          setIsLoading(false);
          return;
        }

        const roots = rootsResult.data as BookmarkItem[];
        if (!rootNodeId) {
          rootNodeId = roots.find(root => typeof root.parentId === 'string')?.parentId || null;
        }
        // 先把根节点信息写入索引（此时仍是“部分索引”，不会阻止后续空闲期构建全量索引）
        roots.forEach(root => {
          upsertBookmarkInMap(root);
        });
        const bookmarkBar = findBookmarkBar(roots);
        if (!bookmarkBar) {
          toastRef.current?.showToast('找不到书签栏目录', 'error');
          setIsLoading(false);
          return;
        }

        if (!isUnmountedRef.current) {
          setBookmarkRootNodeId(rootNodeId);
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
      void buildFullIndexInBackground(() => {
        // 尽可能用索引补齐当前目录 items 的 children 信息（用于展示 children.length）
        setCurrentFolderItems(prev => enrichItemsFromMap(prev));
      });
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
      cancelPendingSearch();

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
};

export { useBookmarksBootstrap };
