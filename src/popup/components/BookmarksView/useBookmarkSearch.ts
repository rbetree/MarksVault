import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import bookmarkService, { BookmarkItem } from '../../../utils/bookmark-service';
import { ToastRef } from '../shared/Toast';

interface UseBookmarkSearchOptions {
  toastRef: React.RefObject<ToastRef>;
  enrichItemsFromMap: (items: BookmarkItem[]) => BookmarkItem[];
}

const useBookmarkSearch = ({ toastRef, enrichItemsFromMap }: UseBookmarkSearchOptions) => {
  // 添加搜索相关状态
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarkItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1); // 搜索键盘导航选中项索引（-1 表示无选中）
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedIndexRef = useRef(-1); // 供键盘事件读取最新选中索引，避免闭包过期
  const searchResultsRef = useRef<BookmarkItem[]>([]); // 供键盘事件读取最新搜索结果
  const isSearchingRef = useRef(false);

  // 搜索：debounce + 竞态控制（last-write-wins）+ 低优先级更新（startTransition）
  const searchDebounceTimerRef = useRef<number | null>(null);
  const searchRequestSeqRef = useRef(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    searchResultsRef.current = searchResults;
    if (selectedIndex >= searchResults.length) {
      setSelectedIndex(-1);
      selectedIndexRef.current = -1;
    }
  }, [searchResults, selectedIndex]);

  useEffect(() => {
    isSearchingRef.current = isSearching;
  }, [isSearching]);

  const updateSearchResults = useCallback((updater: React.SetStateAction<BookmarkItem[]>) => {
    startTransition(() => {
      setSearchResults(updater);
    });
  }, [startTransition]);

  const performSearch = useCallback(async (query: string, requestSeq: number) => {
    try {
      const result = await bookmarkService.searchBookmarks(query);

      // last-write-wins：只接受最新一次请求的结果
      if (requestSeq !== searchRequestSeqRef.current) {
        return;
      }

      if (result.success && result.data) {
        // 回填文件夹的 children（用于展示 children.length），避免 item 级别额外 API 调用
        const enriched = enrichItemsFromMap(result.data as BookmarkItem[]);

        updateSearchResults(enriched);
      } else {
        updateSearchResults([]);
        if (result.error) {
          toastRef.current?.showToast('搜索书签失败: ' + result.error, 'error');
        }
      }
    } catch (error) {
      if (requestSeq !== searchRequestSeqRef.current) {
        return;
      }
      console.error('搜索书签错误:', error);
      updateSearchResults([]);
      toastRef.current?.showToast('搜索书签时发生错误', 'error');
    }
  }, [enrichItemsFromMap, toastRef, updateSearchResults]);

  const cancelPendingSearch = useCallback(() => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }
    // 失效所有进行中的搜索请求
    searchRequestSeqRef.current += 1;
  }, []);

  // 处理搜索（仅负责：更新输入值 + debounce 调度）
  const handleSearch = useCallback((query: string) => {
    // 防御：IME / 事件目标异常时，避免 query 变成 undefined 导致崩溃
    const safeQuery = typeof query === 'string' ? query : '';

    setSearchText(safeQuery);
    setSelectedIndex(-1);
    selectedIndexRef.current = -1;

    // 取消上一次的 debounce
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }

    if (!safeQuery.trim()) {
      // 失效所有进行中的搜索请求
      searchRequestSeqRef.current += 1;
      setIsSearching(false);
      updateSearchResults([]);
      return;
    }

    setIsSearching(true);

    const requestSeq = ++searchRequestSeqRef.current;
    searchDebounceTimerRef.current = window.setTimeout(() => {
      performSearch(safeQuery, requestSeq);
    }, 250);
  }, [performSearch, updateSearchResults]);

  // 清除搜索
  const clearSearch = useCallback(() => {
    setSearchText('');
    setIsSearching(false);
    setSelectedIndex(-1);
    selectedIndexRef.current = -1;

    cancelPendingSearch();

    updateSearchResults([]);
  }, [cancelPendingSearch, updateSearchResults]);

  return {
    searchText,
    searchResults,
    isSearching,
    selectedIndex,
    setSelectedIndex,
    searchInputRef,
    selectedIndexRef,
    searchResultsRef,
    isSearchingRef,
    handleSearch,
    clearSearch,
    cancelPendingSearch,
    updateSearchResults,
  };
};

export { useBookmarkSearch };
