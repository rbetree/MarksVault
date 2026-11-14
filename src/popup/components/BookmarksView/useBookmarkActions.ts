import React, { useCallback } from 'react';
import { browser } from 'wxt/browser';
import bookmarkService, { BookmarkItem, BookmarkResult } from '../../../utils/bookmark-service';
import { ToastRef } from '../shared/Toast';

interface UseBookmarkActionsOptions {
  toastRef: React.RefObject<ToastRef>;
  bookmarksMap: React.MutableRefObject<Map<string, BookmarkItem>>;
  currentFolderId: string | null;
  bookmarkBarId: string | null;
}

const useBookmarkActions = ({
  toastRef,
  bookmarksMap,
  currentFolderId,
  bookmarkBarId,
}: UseBookmarkActionsOptions) => {
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

  // 复制链接到剪贴板（popup 环境优先使用 Clipboard API，失败时回退 execCommand）
  const handleCopyLink = useCallback(async (url: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) throw new Error('execCommand copy failed');
      } catch (error) {
        console.error('复制链接失败:', error);
        toastRef.current?.showToast('复制链接失败', 'error');
        return;
      }
    }
    toastRef.current?.showToast('链接已复制', 'success');
  }, [toastRef]);

  return {
    handleAddBookmark,
    handleAddFolder,
    handleEditBookmark,
    handleUpdateToCurrentUrl,
    handleDeleteBookmark,
    handleDeleteFolder,
    handleMoveBookmark,
    handleCopyLink,
  };
};

export { useBookmarkActions };
