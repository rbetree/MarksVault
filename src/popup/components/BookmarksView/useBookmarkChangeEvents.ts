import React, { useEffect } from 'react';
import { browser, type Browser } from 'wxt/browser';
import bookmarkService, { BookmarkItem } from '../../../utils/bookmark-service';
import { insertAtIndexDedup, moveInList } from './bookmarkIndexUtils';

interface UseBookmarkChangeEventsOptions {
  bookmarksMap: React.MutableRefObject<Map<string, BookmarkItem>>;
  currentFolderIdRef: React.MutableRefObject<string | null>;
  bookmarkBarIdRef: React.MutableRefObject<string | null>;
  folderStackRef: React.MutableRefObject<BookmarkItem[]>;
  currentFolderItemsRef: React.MutableRefObject<BookmarkItem[]>;
  isSearchingRef: React.MutableRefObject<boolean>;
  refreshCurrentFolderChildrenRef: React.MutableRefObject<(options?: { silent?: boolean }) => Promise<void>>;
  clearPathCache: () => void;
  upsertBookmarkInMap: (item: BookmarkItem) => BookmarkItem;
  setFolderChildrenInMap: (folderId: string, children: BookmarkItem[]) => void;
  setCurrentFolderItems: React.Dispatch<React.SetStateAction<BookmarkItem[]>>;
  setFolderStack: React.Dispatch<React.SetStateAction<BookmarkItem[]>>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  updateSearchResults: (updater: React.SetStateAction<BookmarkItem[]>) => void;
  clearSearch: () => void;
}

const useBookmarkChangeEvents = ({
  bookmarksMap,
  currentFolderIdRef,
  bookmarkBarIdRef,
  folderStackRef,
  currentFolderItemsRef,
  isSearchingRef,
  refreshCurrentFolderChildrenRef,
  clearPathCache,
  upsertBookmarkInMap,
  setFolderChildrenInMap,
  setCurrentFolderItems,
  setFolderStack,
  setCurrentFolderId,
  updateSearchResults,
  clearSearch,
}: UseBookmarkChangeEventsOptions) => {
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
      clearPathCache();
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
      clearPathCache();
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
        updateSearchResults(prev => updateList(prev));
      }

      // breadcrumb / folderStack 中的标题也要同步
      setFolderStack(prev => prev.map(f => (f.id === id ? { ...f, title: updated.title } : f)));
    };

    const handleRemoved = (id: string, removeInfo: BookmarkRemoveInfo) => {
      clearPathCache();
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
        updateSearchResults(prev => prev.filter(item => !removedSet.has(item.id)));
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
      clearPathCache();
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
    bookmarksMap,
    bookmarkBarIdRef,
    currentFolderIdRef,
    currentFolderItemsRef,
    clearPathCache,
    clearSearch,
    folderStackRef,
    isSearchingRef,
    refreshCurrentFolderChildrenRef,
    setCurrentFolderId,
    setCurrentFolderItems,
    setFolderChildrenInMap,
    setFolderStack,
    updateSearchResults,
    upsertBookmarkInMap,
  ]);
};

export { useBookmarkChangeEvents };
