import { useCallback, useState } from 'react';
import storageService, { UserSettings } from '../../../utils/storage-service';
import type { BookmarkSortOrder } from '../../../utils/bookmark-search-utils';

const useBookmarkViewSettings = () => {
  const [viewType, setViewType] = useState<'list' | 'grid'>('grid'); // 默认使用网格视图
  const [sortOrder, setSortOrder] = useState<BookmarkSortOrder>('default'); // 书签目录排序方式，默认浏览器顺序

  // 加载用户设置
  const loadUserSettings = useCallback(async () => {
    try {
      const result = await storageService.getSettings();
      if (result.success && result.data) {
        const settings = result.data as UserSettings;
        setViewType(settings.viewType);
        setSortOrder(settings.sortOrder ?? 'default');
      }
    } catch (error) {
      console.error('加载用户设置错误:', error);
    }
  }, []);

  // 保存视图类型设置
  const saveViewTypeSetting = useCallback(async (type: 'list' | 'grid') => {
    try {
      await storageService.updateSettings({ viewType: type });
    } catch (error) {
      console.error('保存视图类型设置错误:', error);
    }
  }, []);

  // 处理视图类型切换
  const handleViewTypeChange = useCallback((type: 'list' | 'grid') => {
    setViewType(type);
    saveViewTypeSetting(type);
  }, [saveViewTypeSetting]);

  // 保存排序设置
  const saveSortOrderSetting = useCallback(async (order: BookmarkSortOrder) => {
    try {
      await storageService.updateSettings({ sortOrder: order });
    } catch (error) {
      console.error('保存排序设置错误:', error);
    }
  }, []);

  // 处理排序方式切换
  const handleSortOrderChange = useCallback((order: BookmarkSortOrder) => {
    setSortOrder(order);
    saveSortOrderSetting(order);
  }, [saveSortOrderSetting]);

  return {
    viewType,
    sortOrder,
    loadUserSettings,
    handleViewTypeChange,
    handleSortOrderChange,
  };
};

export { useBookmarkViewSettings };
