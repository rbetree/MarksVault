import { BookmarkBackup } from '../types/backup';
import { BookmarkItem, findBookmarkBar } from '../utils/bookmark-service';
import bookmarkService from '../utils/bookmark-service';
import storageService from '../utils/storage-service';
import { browser } from 'wxt/browser';

/**
 * 创建书签备份数据
 * @returns 序列化的书签备份数据
 */
export async function createBookmarkBackupData(): Promise<BookmarkBackup> {
  // 获取所有书签
  const bookmarksResult = await bookmarkService.getAllBookmarks();
  if (!bookmarksResult.success) {
    throw new Error(`获取书签失败: ${bookmarksResult.error}`);
  }

  const bookmarks = bookmarksResult.data as BookmarkItem[];

  // 计算元数据
  let totalBookmarks = 0;
  let totalFolders = 0;

  const countItems = (items: BookmarkItem[]) => {
    items.forEach((item: BookmarkItem) => {
      if (item.isFolder) {
        totalFolders++;
        if (item.children && item.children.length > 0) {
          countItems(item.children);
        }
      } else {
        totalBookmarks++;
      }
    });
  };

  countItems(bookmarks);

  // 创建源信息
  const source = `MarksVault Extension (${navigator.platform})`;

  // 创建备份对象
  const backup: BookmarkBackup = {
    version: '1.0',
    timestamp: Date.now(),
    source,
    bookmarks,
    metadata: {
      totalBookmarks,
      totalFolders
    }
  };

  return backup;
}

export function selectBookmarksToRestore(backupBookmarks: BookmarkItem[]): BookmarkItem[] {
  let bookmarksToRestore: BookmarkItem[] = [];

  // 尝试方法1: 查找标题为"书签栏"的项
  const bookmarkBarInBackup = findBookmarkBar(
    backupBookmarks.flatMap((root: BookmarkItem) => root.children || [])
  );

  if (bookmarkBarInBackup && bookmarkBarInBackup.children) {
    console.log('方法1: 从备份中找到书签栏:', bookmarkBarInBackup.title);
    bookmarksToRestore = bookmarkBarInBackup.children;
  } else {
    // 尝试方法2: 使用备份根节点的第一个子节点的子节点
    console.log('方法1失败，尝试方法2');
    if (backupBookmarks[0] && backupBookmarks[0].children) {
      // 通常第一个子节点会是书签栏
      const firstChild = backupBookmarks[0].children[0];
      if (firstChild && firstChild.children) {
        console.log('方法2: 使用第一个子节点的子节点');
        bookmarksToRestore = firstChild.children;
      } else if (backupBookmarks[0].children) {
        // 如果第一个子节点没有子节点，使用所有子节点
        console.log('方法2: 使用所有子节点');
        bookmarksToRestore = backupBookmarks[0].children;
      }
    }
  }

  // 方法3: 最后尝试用直接的书签数据
  if (bookmarksToRestore.length === 0) {
    console.log('方法3: 直接使用根书签数据');
    // 如果前两种方法都找不到，直接使用根书签数据
    if (backupBookmarks[0] && backupBookmarks[0].children) {
      bookmarksToRestore = backupBookmarks[0].children;
    } else {
      bookmarksToRestore = backupBookmarks;
    }
  }

  return bookmarksToRestore;
}

/**
 * 前置校验备份数据（必须在任何删除操作之前执行）
 * 防止恶意/损坏的备份文件导致递归栈溢出，或超大库在清空后执行超时
 */
export function validateBackupTreeForRestore(items: BookmarkItem[]): void {
  const MAX_RESTORE_DEPTH = 100; // 最大嵌套层级
  const MAX_RESTORE_NODE_COUNT = 5000; // 最大节点总数

  let maxDepth = 0;
  let totalNodes = 0;
  const validateBackupTree = (nodes: BookmarkItem[], depth: number): void => {
    for (const item of nodes) {
      totalNodes++;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
      if (item.children && item.children.length > 0) {
        validateBackupTree(item.children, depth + 1);
      }
    }
  };

  validateBackupTree(items, 0);

  if (maxDepth > MAX_RESTORE_DEPTH) {
    throw new Error(
      `备份文件异常：嵌套层级过深（超过 ${MAX_RESTORE_DEPTH} 层，实际 ${maxDepth} 层），已取消恢复`
    );
  }
  if (totalNodes > MAX_RESTORE_NODE_COUNT) {
    throw new Error(
      `备份文件过大（超过 ${MAX_RESTORE_NODE_COUNT} 个节点，实际 ${totalNodes} 个），已取消恢复`
    );
  }

  console.log(`备份数据校验通过：${totalNodes} 个节点，最大深度 ${maxDepth}`);
}

/**
 * 删除前暂存现有书签树（序列化后持久化到 storage.local）
 * 暂存失败则拒绝执行恢复，确保任何删除操作发生前数据已有保底。
 * 该数据仅作保底保留，供未来回滚入口使用；本任务不提供 UI 回滚入口。
 */
export async function stashCurrentBookmarkBar(bookmarkBar: BookmarkItem): Promise<void> {
  const pendingBackupJson = JSON.stringify(bookmarkBar);
  const stashResult = await storageService.setStorageData('pending_restore_backup', pendingBackupJson);
  if (!stashResult.success) {
    throw new Error(`暂存现有书签失败，已取消恢复: ${stashResult.error || '未知错误'}`);
  }
  console.log(`已暂存现有书签到 pending_restore_backup，共 ${bookmarkBar.children?.length || 0} 个一级书签项`);
}

async function createBookmarks(
  items: BookmarkItem[],
  parentId: string
): Promise<void> {
  for (const item of items) {
    try {
      if (item.isFolder) {
        // 创建文件夹
        const folderResult = await bookmarkService.createFolder({
          parentId,
          title: item.title
        });

        if (!folderResult.success || !folderResult.data?.id) {
          throw new Error(`创建文件夹失败: ${item.title} (${folderResult.error || '未知错误'})`);
        }

        // 递归创建子书签
        if (item.children && item.children.length > 0) {
          await createBookmarks(item.children, folderResult.data.id);
        }
      } else if (item.url) {
        // 创建书签
        const bookmarkResult = await bookmarkService.createBookmark({
          parentId,
          title: item.title,
          url: item.url
        });

        if (!bookmarkResult.success) {
          throw new Error(`创建书签失败: ${item.title} (${bookmarkResult.error || '未知错误'})`);
        }
      }
    } catch (itemError) {
      throw new Error(
        `处理书签项 ${item.title} 时失败: ${itemError instanceof Error ? itemError.message : String(itemError)}`
      );
    }
  }
}

export async function replaceBookmarkBarContents(
  bookmarkBar: BookmarkItem,
  bookmarksToRestore: BookmarkItem[]
): Promise<void> {
  // 先移除现有书签
  try {
    for (const child of bookmarkBar.children || []) {
      const removeResult = await bookmarkService.removeBookmarkTree(child.id);
      if (!removeResult.success) {
        throw new Error(`删除现有书签失败: ${child.title || child.id} (${removeResult.error || '未知错误'})`);
      }
    }
    console.log('成功清除现有书签');

    // 恢复书签
    await createBookmarks(bookmarksToRestore, bookmarkBar.id);
    console.log('成功恢复书签');
  } catch (restoreError) {
    console.error('恢复过程中发生错误:', restoreError);
    throw restoreError;
  }

  // 恢复全部成功，清理暂存备份（清理失败仅记录日志，不影响恢复结果）
  try {
    await browser.storage.local.remove('pending_restore_backup');
    console.log('已清理恢复暂存备份 pending_restore_backup');
  } catch (cleanupError) {
    console.error('清理恢复暂存备份失败:', cleanupError);
  }
}
