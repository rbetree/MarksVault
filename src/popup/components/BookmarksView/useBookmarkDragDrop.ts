import { useState, useCallback } from 'react';
import { BookmarkItem as BookmarkItemType } from '../../../utils/bookmark-service';

// 拖拽数据类型
export const DRAG_TYPE = 'application/marksvault-bookmark';

// 交互模式类型
export type InteractionMode = 'sort' | 'move' | 'none';
// 拖放位置类型
export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'none';
// 布局类型
export type LayoutType = 'list' | 'grid';

interface DragData {
  id: string;
  title: string;
  url?: string;
  isFolder: boolean;
  parentId?: string;
  index?: number;
}

interface UseBookmarkDragDropProps {
  bookmark: BookmarkItemType;
  layoutType: LayoutType;
  index: number; // Visual index
  onMoveBookmark?: (bookmarkId: string, destinationFolderId: string, index?: number) => Promise<boolean>;
}

export const useBookmarkDragDrop = ({
  bookmark,
  layoutType,
  index,
  onMoveBookmark
}: UseBookmarkDragDropProps) => {
  const [isOver, setIsOver] = useState<boolean>(false);
  const [dropPosition, setDropPosition] = useState<DropPosition>('none');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none');

  // 定义拖拽区域边缘触发宽度（像素）
  const EDGE_THRESHOLD = 20; // 对于 Grid 左右
  const VERTICAL_THRESHOLD = 0.3; // 对于 List 上下，使用高度百分比

  // 拖拽开始
  const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragData: DragData = {
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      isFolder: bookmark.isFolder,
      parentId: bookmark.parentId,
      index: bookmark.index
    };

    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'move';

    // 稍微延迟以避免截图包含元素自身（可选）
  }, [bookmark]);

  // 计算拖拽位置和模式
  const calculatePositionAndMode = useCallback((event: React.DragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    let newPosition: DropPosition = 'center';
    let newMode: InteractionMode = bookmark.isFolder ? 'move' : 'sort';

    if (layoutType === 'list') {
      // 列表视图：基于 Y 轴判断 Top/Bottom
      // 只有当不是一定要移入文件夹时，才检测排序位置

      // 文件夹中间区域检测（移入逻辑）- 给定 40% 的高度作为移入区
      const isMoveIntoFolder = bookmark.isFolder && mouseY > height * 0.3 && mouseY < height * 0.7;

      if (isMoveIntoFolder) {
        newPosition = 'center';
        newMode = 'move';
      } else {
        newMode = 'sort';

        // 排序逻辑：
        // 策略：首项（index 0）允许 Top/Bottom，其他项只允许 Bottom
        // 这样可以避免两个相邻项同时显示指示器（上一项的 Bottom 和下一项的 Top）

        if (index === 0) {
          // 首项：上半部分为 Top，下半部分为 Bottom
          if (mouseY < height / 2) {
            newPosition = 'top';
          } else {
            newPosition = 'bottom';
          }
        } else {
          // 非首项：总是 Bottom（除非在文件夹中间区域，已在上面处理）
          // 即使鼠标在顶部，也视为插入到该项之后（Bottom）
          // 这在交互上可能略有妥协，但能完美解决闪烁
          newPosition = 'bottom';
        }
      }
    } else {
      // 网格视图：基于 X 轴判断 Left/Right

      const isMoveIntoFolder = bookmark.isFolder && mouseX > width * 0.3 && mouseX < width * 0.7;

      if (isMoveIntoFolder) {
        newPosition = 'center';
        newMode = 'move';
      } else {
        newMode = 'sort';

        // 网格策略：首项允许 Left/Right，其他项只允许 Right
        if (index === 0) {
          if (mouseX < width / 2) {
            newPosition = 'left';
          } else {
            newPosition = 'right';
          }
        } else {
          newPosition = 'right';
        }
      }
    }

    return { newPosition, newMode };
  }, [bookmark.isFolder, index, layoutType]);

  // 拖拽悬停
  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const { newPosition, newMode } = calculatePositionAndMode(event);

    // 避免不必要的 heavy re-renders，虽然 React 会处理，但提前判断更好
    if (newPosition !== dropPosition || newMode !== interactionMode) {
      setDropPosition(newPosition);
      setInteractionMode(newMode);
    }

    // 确保 IsOver 为 true
    if (!isOver) setIsOver(true);

  }, [calculatePositionAndMode, dropPosition, interactionMode, isOver]);

  // 拖拽进入
  const handleDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;

    event.preventDefault();
    setIsOver(true);

    // 立即计算一次位置
    const { newPosition, newMode } = calculatePositionAndMode(event);
    setDropPosition(newPosition);
    setInteractionMode(newMode);

  }, [calculatePositionAndMode]);

  // 拖拽离开
  const handleDragLeave = useCallback(() => {
    setIsOver(false);
    setDropPosition('none');
    setInteractionMode('none');
  }, []);

  // 放置
  const handleDrop = useCallback(async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsOver(false);
    setDropPosition('none');
    setInteractionMode('none');

    try {
      const dataString = event.dataTransfer.getData(DRAG_TYPE);
      if (!dataString) return;

      const dragData: DragData = JSON.parse(dataString);

      // 不允许拖拽到自己身上
      if (dragData.id === bookmark.id) return;

      if (onMoveBookmark) {
        // 移入文件夹
        if (interactionMode === 'move' && bookmark.isFolder) {
          await onMoveBookmark(dragData.id, bookmark.id);
        }
        // 排序
        else if (interactionMode === 'sort' && bookmark.parentId) {
          let targetIndex = bookmark.index ?? 0;

          // 根据位置调整索引
          // List: Top -> 当前索引; Bottom -> 当前索引 + 1
          // Grid: Left -> 当前索引; Right -> 当前索引 + 1
          if (dropPosition === 'bottom' || dropPosition === 'right') {
            targetIndex += 1;
          }

          await onMoveBookmark(dragData.id, bookmark.parentId, targetIndex);
        }
      }
    } catch (error) {
      console.error('Drop handling failed:', error);
    }
  }, [bookmark, interactionMode, dropPosition, onMoveBookmark]);

  return {
    isOver,
    dropPosition,
    interactionMode,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop
  };
};
