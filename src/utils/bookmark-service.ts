// 书签项类型定义
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

class BookmarkService {
  /**
   * 获取所有书签
   * @returns Promise<BookmarkResult>
   */
  async getAllBookmarks(): Promise<BookmarkResult> {
    try {
      // 使用Chrome书签API获取书签树
      const bookmarkTree = await chrome.bookmarks.getTree();
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
   * 转换Chrome书签树到应用所需格式
   */
  private transformBookmarkTree(bookmarkNodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkItem[] {
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
   * 创建新书签
   * @param bookmark 书签信息
   * @returns Promise<BookmarkResult>
   */
  async createBookmark(bookmark: { parentId?: string; title: string; url: string }): Promise<BookmarkResult> {
    try {
      const newBookmark = await chrome.bookmarks.create(bookmark);
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
      const newFolder = await chrome.bookmarks.create(folder);
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
      const updatedBookmark = await chrome.bookmarks.update(id, changes);
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
      await chrome.bookmarks.remove(id);
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
      await chrome.bookmarks.removeTree(id);
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
      const movedBookmark = await chrome.bookmarks.move(id, destination);
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
      if (!query.trim()) {
        return {
          success: true,
          data: []
        };
      }

      const results = await chrome.bookmarks.search(query);
      return {
        success: true,
        data: results.map(node => ({
          id: node.id,
          parentId: node.parentId,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
          index: node.index,
          isFolder: !node.url
        }))
      };
    } catch (error) {
      console.error('搜索书签失败:', error);
      return {
        success: false,
        error: '搜索书签失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
}

// 导出书签服务单例
export default new BookmarkService(); 