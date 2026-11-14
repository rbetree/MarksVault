import React, { useMemo, useRef } from 'react';
import BookmarkGrid from './BookmarkGrid';
import BookmarkList from './BookmarkList';
import PageLayout from '../shared/PageLayout';
import { BookmarksHeader } from './BookmarksHeader';
import { ToastRef } from '../shared/Toast';
import { getDuplicateUrlCounts, sortBookmarkItems } from '../../../utils/bookmark-search-utils';
import { useBookmarkIndex } from './useBookmarkIndex';
import { useBookmarkViewSettings } from './useBookmarkViewSettings';
import { useBookmarkSearch } from './useBookmarkSearch';
import { useBookmarkFolderNavigation } from './useBookmarkFolderNavigation';
import { useBookmarksBootstrap } from './useBookmarksBootstrap';
import { useBookmarkSearchKeyboard } from './useBookmarkSearchKeyboard';
import { useBookmarkActions } from './useBookmarkActions';
import { useBookmarkChangeEvents } from './useBookmarkChangeEvents';

interface BookmarksViewProps {
  toastRef: React.RefObject<ToastRef>;
}

const BookmarksView: React.FC<BookmarksViewProps> = ({ toastRef }) => {
  const isUnmountedRef = useRef(false);
  const itemListRef = useRef<HTMLDivElement | null>(null);

  const index = useBookmarkIndex({ isUnmountedRef });
  const {
    viewType,
    sortOrder,
    loadUserSettings,
    handleViewTypeChange,
    handleSortOrderChange,
  } = useBookmarkViewSettings();
  const search = useBookmarkSearch({
    toastRef,
    enrichItemsFromMap: index.enrichItemsFromMap,
  });
  const navigation = useBookmarkFolderNavigation({
    toastRef,
    bookmarksMap: index.bookmarksMap,
    isUnmountedRef,
    upsertBookmarkInMap: index.upsertBookmarkInMap,
    enrichItemsFromMap: index.enrichItemsFromMap,
    setFolderChildrenInMap: index.setFolderChildrenInMap,
    clearSearch: search.clearSearch,
    isSearching: search.isSearching,
    searchResults: search.searchResults,
  });

  useBookmarksBootstrap({
    toastRef,
    isUnmountedRef,
    loadUserSettings,
    upsertBookmarkInMap: index.upsertBookmarkInMap,
    setBookmarkRootNodeId: index.setBookmarkRootNodeId,
    setBookmarkBarId: navigation.setBookmarkBarId,
    restoreLastFolder: navigation.restoreLastFolder,
    persistViewState: navigation.persistViewState,
    currentFolderIdRef: navigation.currentFolderIdRef,
    setIsLoading: navigation.setIsLoading,
    setCurrentFolderItems: navigation.setCurrentFolderItems,
    enrichItemsFromMap: index.enrichItemsFromMap,
    buildFullIndexInBackground: index.buildFullIndexInBackground,
    cancelPendingSearch: search.cancelPendingSearch,
  });

  useBookmarkSearchKeyboard({
    clearSearch: search.clearSearch,
    navigateToFolder: navigation.navigateToFolder,
    isSearchingRef: search.isSearchingRef,
    searchResultsRef: search.searchResultsRef,
    selectedIndexRef: search.selectedIndexRef,
    setSelectedIndex: search.setSelectedIndex,
    searchInputRef: search.searchInputRef,
    selectedIndex: search.selectedIndex,
    itemListRef,
  });

  const actions = useBookmarkActions({
    toastRef,
    bookmarksMap: index.bookmarksMap,
    currentFolderId: navigation.currentFolderId,
    bookmarkBarId: navigation.bookmarkBarId,
  });

  useBookmarkChangeEvents({
    bookmarksMap: index.bookmarksMap,
    currentFolderIdRef: navigation.currentFolderIdRef,
    bookmarkBarIdRef: navigation.bookmarkBarIdRef,
    folderStackRef: navigation.folderStackRef,
    currentFolderItemsRef: navigation.currentFolderItemsRef,
    isSearchingRef: search.isSearchingRef,
    refreshCurrentFolderChildrenRef: navigation.refreshCurrentFolderChildrenRef,
    clearPathCache: index.clearPathCache,
    upsertBookmarkInMap: index.upsertBookmarkInMap,
    setFolderChildrenInMap: index.setFolderChildrenInMap,
    setCurrentFolderItems: navigation.setCurrentFolderItems,
    setFolderStack: navigation.setFolderStack,
    setCurrentFolderId: navigation.setCurrentFolderId,
    updateSearchResults: search.updateSearchResults,
    clearSearch: search.clearSearch,
  });

  const currentBookmarks = navigation.currentFolderItems;

  const displayedBookmarks = useMemo(() => {
    return search.isSearching ? search.searchResults : sortBookmarkItems(currentBookmarks, sortOrder);
  }, [search.isSearching, search.searchResults, currentBookmarks, sortOrder]);

  // 重复书签检测：规范化 URL -> 出现次数（仅含 >=2 次的键），供列表/网格项显示重复角标
  const duplicateUrlCounts = useMemo(
    () => getDuplicateUrlCounts(displayedBookmarks),
    [displayedBookmarks]
  );
  const parentFolder = navigation.folderStack.length > 0 ? navigation.folderStack[navigation.folderStack.length - 1] : undefined;

  const commonProps = useMemo(() => ({
    bookmarks: displayedBookmarks,
    parentFolder,
    isLoading: navigation.isLoading,
    onAddBookmark: actions.handleAddBookmark,
    onAddFolder: actions.handleAddFolder,
    onEditBookmark: actions.handleEditBookmark,
    onUpdateToCurrentUrl: actions.handleUpdateToCurrentUrl,
    onDeleteBookmark: actions.handleDeleteBookmark,
    onDeleteFolder: actions.handleDeleteFolder,
    onNavigateToFolder: navigation.navigateToFolder,
    onNavigateBack: navigation.navigateBack,
    // 非默认排序或搜索态时禁用拖拽：排序视图下拖拽 index 与展示顺序错位，搜索态下 targetIndex 取真实目录 index 与视觉搜索排名错位
    onMoveBookmark: sortOrder === 'default' && !search.isSearching ? actions.handleMoveBookmark : undefined,
    viewType,
    onViewTypeChange: handleViewTypeChange,
    searchText: search.searchText,
    isSearching: search.isSearching,
    selectedIndex: search.selectedIndex,
    onCopyLink: actions.handleCopyLink,
    resolveBookmarkPath: index.resolveBookmarkPath,
    duplicateUrlCounts,
    onSearch: search.handleSearch,
    onClearSearch: search.clearSearch
  }), [
    displayedBookmarks,
    duplicateUrlCounts,
    parentFolder,
    navigation.isLoading,
    actions.handleAddBookmark,
    actions.handleAddFolder,
    actions.handleEditBookmark,
    actions.handleUpdateToCurrentUrl,
    actions.handleDeleteBookmark,
    actions.handleDeleteFolder,
    navigation.navigateToFolder,
    navigation.navigateBack,
    actions.handleMoveBookmark,
    sortOrder,
    viewType,
    handleViewTypeChange,
    search.searchText,
    search.isSearching,
    search.selectedIndex,
    actions.handleCopyLink,
    index.resolveBookmarkPath,
    search.handleSearch,
    search.clearSearch
  ]);

  // 渲染书签视图
  const renderBookmarkView = () => {
    return viewType === 'grid'
      ? <BookmarkGrid {...commonProps} itemListRef={itemListRef} />
      : <BookmarkList {...commonProps} itemListRef={itemListRef} />;
  };

  return (
    <PageLayout
      title={
        <BookmarksHeader
          folderStack={navigation.folderStack}
          isSearching={search.isSearching}
          searchResultCount={search.searchResults.length}
          onNavigateBack={navigation.navigateBack}
          onNavigateToCrumb={navigation.navigateToCrumb}
          searchText={search.searchText}
          onSearch={search.handleSearch}
          onClearSearch={search.clearSearch}
          searchInputRef={search.searchInputRef}
          viewType={viewType}
          onViewTypeChange={handleViewTypeChange}
          sortOrder={sortOrder}
          onSortOrderChange={handleSortOrderChange}
        />
      }
    >
      {renderBookmarkView()}
    </PageLayout>
  );
};

export default BookmarksView;
