import React, { useCallback, useRef } from 'react';
import bookmarkService, { BookmarkItem } from '../../../utils/bookmark-service';
import { buildBookmarkMap } from './bookmarkIndexUtils';

interface UseBookmarkIndexOptions {
  isUnmountedRef: React.MutableRefObject<boolean>;
}

const useBookmarkIndex = ({ isUnmountedRef }: UseBookmarkIndexOptions) => {
  const bookmarksMap = useRef<Map<string, BookmarkItem>>(new Map());
  const fullIndexBuiltRef = useRef(false);
  const isBuildingFullIndexRef = useRef(false);
  const pathCacheRef = useRef<Map<string, string>>(new Map());
  // 根节点 ID 用于截断路径拼接（Chrome 为 0，Firefox 通常为 root 开头）
  const bookmarkRootNodeIdRef = useRef<string | null>(null);

  const setBookmarkRootNodeId = useCallback((nodeId: string | null) => {
    bookmarkRootNodeIdRef.current = nodeId;
  }, []);

  // 索引变更后需要清空路径缓存，避免 hover 展示旧路径
  const clearPathCache = useCallback(() => {
    pathCacheRef.current.clear();
  }, []);

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
      if (!currentId || currentId === '0' || currentId === bookmarkRootNodeIdRef.current) break;
    }

    const path = titles.reverse().join(' / ');
    pathCacheRef.current.set(bookmarkId, path);
    return path;
  }, [upsertBookmarkInMap]);

  // 阶段2：空闲期构建全量索引（不影响首屏交互）
  const buildFullIndexInBackground = useCallback(async (onIndexBuilt?: () => void) => {
    // 注意：首屏可能已经构建了“部分索引”，不能用 map.size 来判断是否完成全量索引
    if (fullIndexBuiltRef.current || isBuildingFullIndexRef.current) return;
    isBuildingFullIndexRef.current = true;

    try {
      const result = await bookmarkService.getAllBookmarks();
      if (isUnmountedRef.current) return;

      if (result.success && result.data) {
        bookmarksMap.current = buildBookmarkMap(result.data as BookmarkItem[]);
        fullIndexBuiltRef.current = true;
        onIndexBuilt?.();
      }
    } catch (error) {
      // 背景索引失败不打扰用户，只记录日志
      console.warn('后台构建书签索引失败:', error);
    } finally {
      isBuildingFullIndexRef.current = false;
    }
  }, [isUnmountedRef]);

  return {
    bookmarksMap,
    enrichItemsFromMap,
    upsertBookmarkInMap,
    setFolderChildrenInMap,
    resolveBookmarkPath,
    clearPathCache,
    setBookmarkRootNodeId,
    buildFullIndexInBackground,
  };
};

export { useBookmarkIndex };
