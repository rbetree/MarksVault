// 书签项类型定义
import { browser, type Browser } from 'wxt/browser';
import { getBookmarkFuzzyScoreByNormalizedQuery, normalizeSearchText } from './bookmark-search-utils';

export interface BookmarkItem {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkItem[];
  dateAdded?: number;
  dateGroupModified?: number;
  index?: number;
  isFolder: boolean;
}

// 书签操作结果类型
export interface BookmarkResult {
  success: boolean;
  data?: any;
  error?: string;
}

const BOOKMARK_BAR_TITLES = new Set([
  '书签栏',
  '書籤列',
  'bookmarks bar',
  'bookmark bar',
  'bookmarks toolbar',
  'bookmark toolbar',
]);

/**
 * 判断节点是否可能为“书签栏”
 * 兼容 Chrome/Edge 固定 ID 与 Firefox toolbar 前缀。
 */
export const isBookmarkBarNode = (item: Pick<BookmarkItem, 'id' | 'title'>): boolean => {
  const normalizedId = item.id.toLowerCase();
  if (normalizedId === '1' || normalizedId.startsWith('toolbar')) {
    return true;
  }

  const normalizedTitle = item.title.trim().toLowerCase();
  return BOOKMARK_BAR_TITLES.has(normalizedTitle);
};

/**
 * 在根节点列表中找到最可能的“书签栏”节点。
 */
export const findBookmarkBar = (roots: BookmarkItem[]): BookmarkItem | undefined => {
  if (!Array.isArray(roots) || roots.length === 0) {
    return undefined;
  }

  return roots.find(root => isBookmarkBarNode(root))
    ?? roots.find(root => root.isFolder)
    ?? roots[0];
};

class BookmarkService {
  // 搜索索引缓存：避免每次输入都全量拉取书签树。
  private readonly SEARCH_INDEX_TTL = 20 * 1000; // 20 秒
  private readonly MAX_SEARCH_RESULTS = 200;
  private searchIndexCache: { items: BookmarkItem[]; timestamp: number } | null = null;

  private invalidateSearchIndexCache(): void {
    this.searchIndexCache = null;
  }

  private toBookmarkItem(node: Browser.bookmarks.BookmarkTreeNode): BookmarkItem {
    return {
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      url: node.url,
      dateAdded: node.dateAdded,
      dateGroupModified: node.dateGroupModified,
      index: node.index,
      isFolder: !node.url
    };
  }

  private flattenBookmarkTreeToList(nodes: Browser.bookmarks.BookmarkTreeNode[]): BookmarkItem[] {
    const list: BookmarkItem[] = [];

    const walk = (currentNodes: Browser.bookmarks.BookmarkTreeNode[]) => {
      for (const node of currentNodes) {
        list.push(this.toBookmarkItem(node));
        if (node.children && node.children.length > 0) {
          walk(node.children);
        }
      }
    };

    walk(nodes);
    return list;
  }

  private async getSearchIndexItems(): Promise<BookmarkItem[]> {
    const now = Date.now();
    if (this.searchIndexCache && now - this.searchIndexCache.timestamp < this.SEARCH_INDEX_TTL) {
      return this.searchIndexCache.items;
    }

    const tree = await browser.bookmarks.getTree();
    const items = this.flattenBookmarkTreeToList(tree);
    this.searchIndexCache = {
      items,
      timestamp: now
    };

    return items;
  }

  /**
   * 获取所有书签
   * @returns Promise<BookmarkResult>
   */
  async getAllBookmarks(): Promise<BookmarkResult> {
    try {
      // 使用Chrome书签API获取书签树
      const bookmarkTree = await browser.bookmarks.getTree();
      return {
        success: true,
        data: this.transformBookmarkTree(bookmarkTree)
      };
    } catch (error) {
      console.error('获取书签失败:', error);
      return {
        success: false,
        error: '获取书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取指定文件夹的一层子节点（轻量 API：不拉整棵树）
   * @param folderId 文件夹ID（根节点通常为 "0"）
   */
  async getFolderChildren(folderId: string): Promise<BookmarkResult> {
    try {
      const children = await browser.bookmarks.getChildren(folderId);
      return {
        success: true,
        data: this.transformBookmarkTree(children)
      };
    } catch (error) {
      console.error('获取文件夹子项失败:', error);
      return {
        success: false,
        error: '获取文件夹子项失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取单个书签/文件夹节点信息（不包含其 children）
   * @param id 书签或文件夹ID
   */
  async getBookmarkById(id: string): Promise<BookmarkResult> {
    try {
      const nodes = await browser.bookmarks.get(id);
      if (!nodes || nodes.length === 0) {
        return {
          success: false,
          error: '未找到书签节点'
        };
      }

      const transformed = this.transformBookmarkTree(nodes);
      return {
        success: true,
        data: transformed[0]
      };
    } catch (error) {
      console.error('获取书签节点失败:', error);
      return {
        success: false,
        error: '获取书签节点失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 转换Chrome书签树到应用所需格式
   */
  private transformBookmarkTree(bookmarkNodes: Browser.bookmarks.BookmarkTreeNode[]): BookmarkItem[] {
    return bookmarkNodes.map(node => {
      const item: BookmarkItem = {
        id: node.id,
        parentId: node.parentId,
        title: node.title,
        url: node.url,
        dateAdded: node.dateAdded,
        dateGroupModified: node.dateGroupModified,
        index: node.index,
        isFolder: !node.url
      };

      if (node.children && node.children.length > 0) {
        item.children = this.transformBookmarkTree(node.children);
      }

      return item;
    });
  }

  /**
   * 获取文件夹中包含的项目数量
   * @param folderId 文件夹ID
   * @returns Promise<BookmarkResult> 包含项目计数的结果
   */
  async getFolderItemCount(folderId: string): Promise<BookmarkResult> {
    try {
      const subTree = await browser.bookmarks.getSubTree(folderId);
      if (subTree.length === 0 || !subTree[0].children) {
        return {
          success: true,
          data: 0
        };
      }
      
      return {
        success: true,
        data: subTree[0].children.length
      };
    } catch (error) {
      console.error('获取文件夹项目计数失败:', error);
      return {
        success: false,
        error: '获取文件夹项目计数失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取文件夹中的所有书签（包括子文件夹中的）
   * @param folderId 文件夹ID
   * @returns Promise<BookmarkResult>
   */
  async getBookmarksInFolder(folderId: string): Promise<BookmarkResult> {
    try {
      const subTree = await browser.bookmarks.getSubTree(folderId);
      if (subTree.length === 0 || !subTree[0].children) {
        return {
          success: true,
          data: []
        };
      }
      
      // 收集所有非文件夹的书签
      const bookmarks: BookmarkItem[] = [];
      
      const collectBookmarks = (items: Browser.bookmarks.BookmarkTreeNode[]) => {
        items.forEach(item => {
          if (item.url) {
            bookmarks.push({
              id: item.id,
              parentId: item.parentId,
              title: item.title,
              url: item.url,
              dateAdded: item.dateAdded,
              index: item.index,
              isFolder: false
            });
          } else if (item.children) {
            collectBookmarks(item.children);
          }
        });
      };
      
      collectBookmarks(subTree[0].children);
      
      return {
        success: true,
        data: bookmarks
      };
    } catch (error) {
      console.error('获取文件夹中的书签失败:', error);
      return {
        success: false,
        error: '获取文件夹中的书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 创建新书签
   * @param bookmark 书签信息
   * @returns Promise<BookmarkResult>
   */
  async createBookmark(bookmark: { parentId?: string; title: string; url: string }): Promise<BookmarkResult> {
    try {
      const newBookmark = await browser.bookmarks.create(bookmark);
      this.invalidateSearchIndexCache();
      return {
        success: true,
        data: {
          id: newBookmark.id,
          parentId: newBookmark.parentId,
          title: newBookmark.title,
          url: newBookmark.url,
          dateAdded: newBookmark.dateAdded,
          index: newBookmark.index,
          isFolder: false
        }
      };
    } catch (error) {
      console.error('创建书签失败:', error);
      return {
        success: false,
        error: '创建书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 创建文件夹
   * @param folder 文件夹信息
   * @returns Promise<BookmarkResult>
   */
  async createFolder(folder: { parentId?: string; title: string }): Promise<BookmarkResult> {
    try {
      const newFolder = await browser.bookmarks.create(folder);
      this.invalidateSearchIndexCache();
      return {
        success: true,
        data: {
          id: newFolder.id,
          parentId: newFolder.parentId,
          title: newFolder.title,
          dateAdded: newFolder.dateAdded,
          index: newFolder.index,
          isFolder: true
        }
      };
    } catch (error) {
      console.error('创建文件夹失败:', error);
      return {
        success: false,
        error: '创建文件夹失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 更新书签
   * @param id 书签ID
   * @param changes 变更内容
   * @returns Promise<BookmarkResult>
   */
  async updateBookmark(id: string, changes: { title?: string; url?: string }): Promise<BookmarkResult> {
    try {
      const updatedBookmark = await browser.bookmarks.update(id, changes);
      this.invalidateSearchIndexCache();
      return {
        success: true,
        data: {
          id: updatedBookmark.id,
          parentId: updatedBookmark.parentId,
          title: updatedBookmark.title,
          url: updatedBookmark.url,
          isFolder: !updatedBookmark.url
        }
      };
    } catch (error) {
      console.error('更新书签失败:', error);
      return {
        success: false,
        error: '更新书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 删除书签
   * @param id 书签ID
   * @returns Promise<BookmarkResult>
   */
  async removeBookmark(id: string): Promise<BookmarkResult> {
    try {
      await browser.bookmarks.remove(id);
      this.invalidateSearchIndexCache();
      return {
        success: true
      };
    } catch (error) {
      console.error('删除书签失败:', error);
      return {
        success: false,
        error: '删除书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 递归删除书签(文件夹)
   * @param id 书签ID
   * @returns Promise<BookmarkResult>
   */
  async removeBookmarkTree(id: string): Promise<BookmarkResult> {
    try {
      await browser.bookmarks.removeTree(id);
      this.invalidateSearchIndexCache();
      return {
        success: true
      };
    } catch (error) {
      console.error('删除书签树失败:', error);
      return {
        success: false,
        error: '删除书签树失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 移动书签
   * @param id 书签ID
   * @param destination 目标位置信息
   * @returns Promise<BookmarkResult>
   */
  async moveBookmark(id: string, destination: { parentId?: string; index?: number }): Promise<BookmarkResult> {
    try {
      const movedBookmark = await browser.bookmarks.move(id, destination);
      this.invalidateSearchIndexCache();
      return {
        success: true,
        data: {
          id: movedBookmark.id,
          parentId: movedBookmark.parentId,
          title: movedBookmark.title,
          url: movedBookmark.url,
          index: movedBookmark.index,
          isFolder: !movedBookmark.url
        }
      };
    } catch (error) {
      console.error('移动书签失败:', error);
      return {
        success: false,
        error: '移动书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 搜索书签
   * @param query 查询参数
   * @returns Promise<BookmarkResult>
   */
  async searchBookmarks(query: string): Promise<BookmarkResult> {
    try {
      const normalizedQuery = normalizeSearchText(query);
      if (!normalizedQuery) {
        return {
          success: true,
          data: []
        };
      }

      const [nativeResults, searchPool] = await Promise.all([
        browser.bookmarks.search(normalizedQuery),
        this.getSearchIndexItems()
      ]);

      const candidateMap = new Map<string, { item: BookmarkItem; score: number }>();

      const addOrUpdateCandidate = (item: BookmarkItem, score: number) => {
        const existing = candidateMap.get(item.id);
        if (!existing || score > existing.score) {
          candidateMap.set(item.id, { item, score });
        }
      };

      // 原生搜索命中结果始终保留，并给予更高优先级。
      for (const node of nativeResults) {
        const item = this.toBookmarkItem(node);
        const score = 1000 + getBookmarkFuzzyScoreByNormalizedQuery(normalizedQuery, item.title, item.url);
        addOrUpdateCandidate(item, score);
      }

      // 全量索引做模糊召回，补齐原生搜索无法命中的结果。
      for (const item of searchPool) {
        const score = getBookmarkFuzzyScoreByNormalizedQuery(normalizedQuery, item.title, item.url);
        if (score <= 0) {
          continue;
        }
        addOrUpdateCandidate(item, score);
      }

      const sortedCandidates = [...candidateMap.values()].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.item.isFolder !== b.item.isFolder) return a.item.isFolder ? -1 : 1;
        const aTitleLength = a.item.title.length;
        const bTitleLength = b.item.title.length;
        if (aTitleLength !== bTitleLength) return aTitleLength - bTitleLength;
        return (b.item.dateAdded ?? 0) - (a.item.dateAdded ?? 0);
      });

      return {
        success: true,
        data: sortedCandidates.slice(0, this.MAX_SEARCH_RESULTS).map(candidate => candidate.item)
      };
    } catch (error) {
      console.error('搜索书签失败:', error);
      return {
        success: false,
        error: '搜索书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取书签根文件夹
   * @returns Promise<BookmarkResult> 包含根文件夹的书签项
   */
  async getBookmarkRoots(): Promise<BookmarkResult> {
    try {
      const bookmarkTree = await browser.bookmarks.getTree();
      
      if (bookmarkTree.length === 0 || !bookmarkTree[0].children) {
        return {
          success: false,
          error: '无法获取书签根文件夹'
        };
      }
      
      // Chrome浏览器中，根文件夹的children通常包含：
      // - id为"0"的是"其他书签"
      // - id为"1"的是"书签栏"
      // - id为"2"的是"移动设备书签"
      return {
        success: true,
        data: this.transformBookmarkTree(bookmarkTree[0].children)
      };
    } catch (error) {
      console.error('获取书签根失败:', error);
      return {
        success: false,
        error: '获取书签根失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取所有书签文件夹
   * @returns Promise<BookmarkResult> 包含所有文件夹的列表和路径信息
   */
  async getAllBookmarkFolders(): Promise<BookmarkResult> {
    try {
      // 获取完整书签树
      const bookmarksResult = await this.getAllBookmarks();
      if (!bookmarksResult.success) {
        return {
          success: false,
          error: `获取书签文件夹失败: ${bookmarksResult.error}`
        };
      }

      const bookmarks = bookmarksResult.data as BookmarkItem[];
      
      // 收集所有文件夹及其路径
      const folders: Array<{
        id: string;
        title: string;
        fullPath: string;
        depth: number;
      }> = [];

      // 遍历书签树，构建文件夹路径
      const traverseBookmarks = (items: BookmarkItem[], parentPath: string = '', depth: number = 0) => {
        for (const item of items) {
          if (item.isFolder) {
            const currentPath = parentPath ? `${parentPath} / ${item.title}` : item.title;
            folders.push({
              id: item.id,
              title: item.title,
              fullPath: currentPath, 
              depth: depth
            });
            
            if (item.children && item.children.length > 0) {
              traverseBookmarks(item.children, currentPath, depth + 1);
            }
          }
        }
      };

      traverseBookmarks(bookmarks);
      
      return {
        success: true,
        data: folders
      };
    } catch (error) {
      console.error('获取书签文件夹失败:', error);
      return {
        success: false,
        error: '获取书签文件夹失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
}

// 导出书签服务单例
export default new BookmarkService(); 
