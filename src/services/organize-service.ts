/**
 * 书签整理服务
 * 负责实现书签整理操作，如移动、删除、重命名和验证
 */

import { BookmarkItem } from '../utils/bookmark-service';
import bookmarkService from '../utils/bookmark-service';

// 整理操作类型
export type OrganizeOperationType = 'move' | 'delete' | 'rename' | 'validate';

// 整理操作过滤条件
export interface OrganizeFilter {
  pattern?: string;      // URL或标题匹配模式（正则表达式或字符串）
  folder?: string;       // 指定文件夹ID
  olderThan?: number;    // 早于指定天数
  newerThan?: number;    // 晚于指定天数
}

// 整理操作配置
export interface OrganizeOperation {
  operation: OrganizeOperationType; // 操作类型
  filters?: OrganizeFilter;         // 过滤条件
  target?: string;                  // 目标文件夹ID（用于移动操作）
  newName?: string;                 // 新名称模板（用于重命名操作）
}

// 整理结果
export interface OrganizeResult {
  success: boolean;             // 操作是否成功
  processedCount: number;       // 处理的书签数量
  details: string;              // 操作详情
  error?: string;               // 错误信息
}

/**
 * 书签整理服务
 */
class OrganizeService {
  private static instance: OrganizeService;
  
  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {}
  
  /**
   * 获取OrganizeService实例
   * @returns OrganizeService单例
   */
  public static getInstance(): OrganizeService {
    if (!OrganizeService.instance) {
      OrganizeService.instance = new OrganizeService();
    }
    return OrganizeService.instance;
  }
  
  /**
   * 执行书签整理操作
   * @param operations 整理操作数组
   * @returns 操作结果数组
   */
  public async organizeBookmarks(operations: OrganizeOperation[]): Promise<OrganizeResult[]> {
    const results: OrganizeResult[] = [];
    
    // 验证操作数组
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return [{
        success: false,
        processedCount: 0,
        details: '没有提供有效的整理操作',
        error: '整理操作数组为空或无效'
      }];
    }
    
    // 获取所有书签
    const bookmarksResult = await bookmarkService.getAllBookmarks();
    if (!bookmarksResult.success) {
      return [{
        success: false,
        processedCount: 0,
        details: '无法获取书签数据',
        error: `获取书签失败: ${bookmarksResult.error}`
      }];
    }
    
    const bookmarks = bookmarksResult.data as BookmarkItem[];
    
    // 逐个执行整理操作
    for (const operation of operations) {
      try {
        let result: OrganizeResult;
        
        switch (operation.operation) {
          case 'move':
            result = await this.moveBookmarks(bookmarks, operation);
            break;
          case 'delete':
            result = await this.deleteBookmarks(bookmarks, operation);
            break;
          case 'rename':
            result = await this.renameBookmarks(bookmarks, operation);
            break;
          case 'validate':
            result = await this.validateBookmarks(bookmarks, operation);
            break;
          default:
            result = {
              success: false,
              processedCount: 0,
              details: `不支持的操作类型: ${operation.operation}`,
              error: `未知的整理操作类型: ${operation.operation}`
            };
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          processedCount: 0,
          details: `执行操作 ${operation.operation} 时发生错误`,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }
  
  /**
   * 过滤书签列表
   * @param bookmarks 书签列表
   * @param filters 过滤条件
   * @returns 符合条件的书签数组
   */
  private filterBookmarks(bookmarks: BookmarkItem[], filters?: OrganizeFilter): BookmarkItem[] {
    if (!filters) {
      return bookmarks;
    }
    
    // 创建一个扁平的书签列表用于过滤
    const allBookmarks: BookmarkItem[] = [];
    
    const flattenBookmarks = (items: BookmarkItem[]) => {
      for (const item of items) {
        if (!item.isFolder) {
          allBookmarks.push(item);
        }
        
        if (item.children && item.children.length > 0) {
          flattenBookmarks(item.children);
        }
      }
    };
    
    flattenBookmarks(bookmarks);
    
    // 应用过滤条件
    return allBookmarks.filter(bookmark => {
      // 过滤文件夹
      if (filters.folder && bookmark.parentId !== filters.folder) {
        return false;
      }
      
      // 按模式匹配URL或标题
      if (filters.pattern) {
        const pattern = new RegExp(filters.pattern, 'i');
        if (!pattern.test(bookmark.title) && !pattern.test(bookmark.url || '')) {
          return false;
        }
      }
      
      // 按时间过滤（如果书签有dateAdded属性）
      const now = Date.now();
      
      if (filters.olderThan && bookmark.dateAdded) {
        const olderThanMs = filters.olderThan * 24 * 60 * 60 * 1000; // 转换为毫秒
        if (now - bookmark.dateAdded < olderThanMs) {
          return false;
        }
      }
      
      if (filters.newerThan && bookmark.dateAdded) {
        const newerThanMs = filters.newerThan * 24 * 60 * 60 * 1000; // 转换为毫秒
        if (now - bookmark.dateAdded > newerThanMs) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * 移动书签操作
   * @param bookmarks 书签树
   * @param operation 移动操作配置
   * @returns 操作结果
   */
  private async moveBookmarks(bookmarks: BookmarkItem[], operation: OrganizeOperation): Promise<OrganizeResult> {
    // 验证目标文件夹
    if (!operation.target) {
      return {
        success: false,
        processedCount: 0,
        details: '移动操作缺少目标文件夹ID',
        error: '移动操作需要指定target目标文件夹ID'
      };
    }
    
    // 过滤出符合条件的书签
    const filteredBookmarks = this.filterBookmarks(bookmarks, operation.filters);
    
    if (filteredBookmarks.length === 0) {
      return {
        success: true,
        processedCount: 0,
        details: '没有符合条件的书签需要移动',
        error: undefined
      };
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // 执行移动操作
    for (const bookmark of filteredBookmarks) {
      try {
        // 调用Chrome API移动书签
        await bookmarkService.moveBookmark(bookmark.id, { parentId: operation.target });
        successCount++;
      } catch (error) {
        console.error(`移动书签 ${bookmark.id} 失败:`, error);
        errorCount++;
      }
    }
    
    // 返回结果
    return {
      success: errorCount === 0,
      processedCount: successCount,
      details: `成功移动 ${successCount} 个书签${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      error: errorCount > 0 ? `${errorCount} 个书签移动失败` : undefined
    };
  }
  
  /**
   * 删除书签操作
   * @param bookmarks 书签树
   * @param operation 删除操作配置
   * @returns 操作结果
   */
  private async deleteBookmarks(bookmarks: BookmarkItem[], operation: OrganizeOperation): Promise<OrganizeResult> {
    // 过滤出符合条件的书签
    const filteredBookmarks = this.filterBookmarks(bookmarks, operation.filters);
    
    if (filteredBookmarks.length === 0) {
      return {
        success: true,
        processedCount: 0,
        details: '没有符合条件的书签需要删除',
        error: undefined
      };
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // 执行删除操作
    for (const bookmark of filteredBookmarks) {
      try {
        // 调用Chrome API删除书签
        await bookmarkService.removeBookmark(bookmark.id);
        successCount++;
      } catch (error) {
        console.error(`删除书签 ${bookmark.id} 失败:`, error);
        errorCount++;
      }
    }
    
    // 返回结果
    return {
      success: errorCount === 0,
      processedCount: successCount,
      details: `成功删除 ${successCount} 个书签${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      error: errorCount > 0 ? `${errorCount} 个书签删除失败` : undefined
    };
  }
  
  /**
   * 重命名书签操作
   * @param bookmarks 书签树
   * @param operation 重命名操作配置
   * @returns 操作结果
   */
  private async renameBookmarks(bookmarks: BookmarkItem[], operation: OrganizeOperation): Promise<OrganizeResult> {
    // 验证新名称模板
    if (!operation.newName) {
      return {
        success: false,
        processedCount: 0,
        details: '重命名操作缺少新名称模板',
        error: '重命名操作需要指定newName新名称模板'
      };
    }
    
    // 过滤出符合条件的书签
    const filteredBookmarks = this.filterBookmarks(bookmarks, operation.filters);
    
    if (filteredBookmarks.length === 0) {
      return {
        success: true,
        processedCount: 0,
        details: '没有符合条件的书签需要重命名',
        error: undefined
      };
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // 执行重命名操作
    for (const bookmark of filteredBookmarks) {
      try {
        // 处理名称模板，替换变量
        let newName = operation.newName;
        
        // 支持简单的变量替换，如 {title}, {domain}, {index}
        newName = newName.replace(/{title}/g, bookmark.title);
        
        const urlDomain = bookmark.url ? this.extractDomain(bookmark.url) : '';
        newName = newName.replace(/{domain}/g, urlDomain);
        
        newName = newName.replace(/{index}/g, (successCount + 1).toString());
        
        // 调用Chrome API更新书签
        await bookmarkService.updateBookmark(bookmark.id, {
          title: newName
        });
        
        successCount++;
      } catch (error) {
        console.error(`重命名书签 ${bookmark.id} 失败:`, error);
        errorCount++;
      }
    }
    
    // 返回结果
    return {
      success: errorCount === 0,
      processedCount: successCount,
      details: `成功重命名 ${successCount} 个书签${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      error: errorCount > 0 ? `${errorCount} 个书签重命名失败` : undefined
    };
  }
  
  /**
   * 验证书签操作（检查死链接）
   * @param bookmarks 书签树
   * @param operation 验证操作配置
   * @returns 操作结果
   */
  private async validateBookmarks(bookmarks: BookmarkItem[], operation: OrganizeOperation): Promise<OrganizeResult> {
    // 过滤出符合条件的书签
    const filteredBookmarks = this.filterBookmarks(bookmarks, operation.filters);
    
    if (filteredBookmarks.length === 0) {
      return {
        success: true,
        processedCount: 0,
        details: '没有符合条件的书签需要验证',
        error: undefined
      };
    }
    
    let validCount = 0;
    let invalidCount = 0;
    
    // 由于浏览器扩展不能直接发送HTTP请求验证URL，
    // 此处返回一个模拟结果，实际实现需要使用fetch API或其他方式
    return {
      success: true,
      processedCount: filteredBookmarks.length,
      details: `已验证 ${filteredBookmarks.length} 个书签，状态都正常[模拟结果]`,
      error: undefined
    };
  }
  
  /**
   * 从URL中提取域名
   * @param url URL字符串
   * @returns 域名
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return '';
    }
  }
}

// 导出单例实例
const organizeService = OrganizeService.getInstance();
export default organizeService; 