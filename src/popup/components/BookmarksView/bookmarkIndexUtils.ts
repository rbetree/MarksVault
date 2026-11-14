import { BookmarkItem } from '../../../utils/bookmark-service';

// 构建书签ID映射
export const buildBookmarkMap = (items: BookmarkItem[]): Map<string, BookmarkItem> => {
  const map = new Map<string, BookmarkItem>();

  const processItem = (item: BookmarkItem) => {
    map.set(item.id, item);
    if (item.children) {
      item.children.forEach(processItem);
    }
  };

  items.forEach(processItem);
  return map;
};

// 在列表中按 index 插入（若已存在同 id，则先去重）
export const insertAtIndexDedup = (list: BookmarkItem[], item: BookmarkItem, index?: number): BookmarkItem[] => {
  const without = list.filter(x => x.id !== item.id);
  const safeIndex = typeof index === 'number' && index >= 0
    ? Math.min(index, without.length)
    : without.length;
  return [...without.slice(0, safeIndex), item, ...without.slice(safeIndex)];
};

// 在列表中移动某个元素到目标 index（若不存在则原样返回）
export const moveInList = (list: BookmarkItem[], itemId: string, newIndex: number): BookmarkItem[] => {
  const fromIndex = list.findIndex(x => x.id === itemId);
  if (fromIndex < 0) return list;
  const item = list[fromIndex];
  const without = [...list.slice(0, fromIndex), ...list.slice(fromIndex + 1)];
  const safeIndex = Math.max(0, Math.min(newIndex, without.length));
  return [...without.slice(0, safeIndex), item, ...without.slice(safeIndex)];
};
