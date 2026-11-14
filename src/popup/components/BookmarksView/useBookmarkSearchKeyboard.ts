import React, { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { BookmarkItem } from '../../../utils/bookmark-service';

interface UseBookmarkSearchKeyboardOptions {
  clearSearch: () => void;
  navigateToFolder: (folderId: string) => void | Promise<void>;
  isSearchingRef: React.MutableRefObject<boolean>;
  searchResultsRef: React.MutableRefObject<BookmarkItem[]>;
  selectedIndexRef: React.MutableRefObject<number>;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
  selectedIndex: number;
  itemListRef: React.MutableRefObject<HTMLDivElement | null>;
}

const useBookmarkSearchKeyboard = ({
  clearSearch,
  navigateToFolder,
  isSearchingRef,
  searchResultsRef,
  selectedIndexRef,
  setSelectedIndex,
  searchInputRef,
  selectedIndex,
  itemListRef,
}: UseBookmarkSearchKeyboardOptions) => {
  // 搜索键盘导航：↑/↓ 移动选中、Enter 打开选中项、Esc 清空退出；Ctrl/Cmd+F 聚焦搜索框
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd+F 聚焦搜索框
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // 仅在搜索态且非 IME 组合输入时启用导航
      if (!isSearchingRef.current || event.isComposing) return;
      const results = searchResultsRef.current;
      if (results.length === 0) return;

      // 避免与对话框/菜单/输入控件内部快捷键冲突
      const target = event.target as HTMLElement;
      const inEditable = target.closest('input, textarea, [contenteditable="true"]');
      // MUI Menu 的 role 是 'menu'（而非 'dialog'），需一并纳入，否则搜索结果上的右键菜单按 Esc 会误触发 clearSearch
      const inDialog = target.closest('[role="dialog"], [role="menu"]');

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          if (inDialog || inEditable) return;
          event.preventDefault();
          const next = event.key === 'ArrowDown'
            ? Math.min(selectedIndexRef.current + 1, results.length - 1)
            : Math.max(selectedIndexRef.current - 1, 0);
          setSelectedIndex(next);
          selectedIndexRef.current = next;
          break;
        }
        case 'Enter': {
          if (inEditable || inDialog) return;
          event.preventDefault();
          const item = results[selectedIndexRef.current >= 0 ? selectedIndexRef.current : 0];
          if (!item) return;
          if (item.isFolder) {
            navigateToFolder(item.id);
          } else if (item.url) {
            browser.tabs.create({ url: item.url });
          }
          break;
        }
        case 'Escape': {
          // 焦点在输入框/对话框/菜单内时不拦截，交由控件自身处理
          if (inDialog || inEditable) return;
          event.preventDefault();
          clearSearch();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [clearSearch, navigateToFolder]);

  // 选中项变化时滚动到可视区域
  useEffect(() => {
    if (selectedIndex < 0) return;
    const container = itemListRef.current;
    if (!container) return;
    const selectedEl = container.querySelector(`[data-search-index="${selectedIndex}"]`);
    if (selectedEl) {
      (selectedEl as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);
};

export { useBookmarkSearchKeyboard };
