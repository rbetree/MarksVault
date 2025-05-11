/**
 * 书签整理服务
 * 负责实现书签整理操作，如移动、删除、重命名和验证
 */

import { BookmarkItem } from '../utils/bookmark-service';
import bookmarkService from '../utils/bookmark-service';

// 整理操作类型
export type OrganizeOperationType = 'move' | 'delete' | 'rename' | 'validate' | 'tag' | 'organize';

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
    
    try {
      // 获取完整的书签树
      const bookmarksResult = await bookmarkService.getAllBookmarks();
      
      if (!bookmarksResult.success) {
        throw new Error(`获取书签失败: ${bookmarksResult.error}`);
      }
      
      const bookmarks = bookmarksResult.data;
      
      // 对每个操作执行相应的处理
      for (const operation of operations) {
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
          case 'tag':
            result = await this.tagBookmarks(bookmarks, operation);
            break;
          case 'organize':
            result = await this.organizeByDomain(bookmarks, operation);
            break;
          default:
            result = {
              success: false,
              processedCount: 0,
              details: `不支持的操作类型: ${operation.operation}`,
              error: `不支持的操作类型: ${operation.operation}`
            };
        }
        
        results.push(result);
      }
      
      return results;
    } catch (error) {
      console.error('整理书签时出错:', error);
      return [{
        success: false,
        processedCount: 0,
        details: `整理书签失败: ${error instanceof Error ? error.message : String(error)}`,
        error: `整理书签失败: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
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
        try {
          // 将通配符模式转换为正则表达式
          // 1. 转义特殊正则字符
          let regexPattern = filters.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          // 2. 将 * 通配符替换为正则表达式的 .*
          regexPattern = regexPattern.replace(/\\\*/g, '.*');
          
          // 3. 创建正则表达式对象
          const pattern = new RegExp(regexPattern, 'i');
          
          // 4. 测试书签标题和URL
          if (!pattern.test(bookmark.title) && !pattern.test(bookmark.url || '')) {
            return false;
          }
        } catch (error) {
          console.error('过滤模式正则表达式错误:', error);
          // 如果正则表达式无效，尝试使用简单的字符串包含匹配
          const lowerPattern = filters.pattern.toLowerCase();
          const lowerTitle = bookmark.title.toLowerCase();
          const lowerUrl = (bookmark.url || '').toLowerCase();
          
          if (!lowerTitle.includes(lowerPattern) && !lowerUrl.includes(lowerPattern)) {
            return false;
          }
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
    console.log('执行移动书签操作:', operation);
    
    // 验证目标文件夹
    if (!operation.target) {
      console.error('移动操作缺少目标文件夹ID');
      return {
        success: false,
        processedCount: 0,
        details: '移动操作缺少目标文件夹ID',
        error: '移动操作需要指定target目标文件夹ID'
      };
    }
    
    // 验证目标文件夹是否存在
    try {
      const folderResult = await bookmarkService.getBookmarksInFolder(operation.target);
      if (!folderResult.success) {
        console.error('目标文件夹不存在或无效:', operation.target, folderResult.error);
        return {
          success: false,
          processedCount: 0,
          details: `目标文件夹 "${operation.target}" 不存在或无效`,
          error: `目标文件夹不存在或无效: ${folderResult.error}`
        };
      }
    } catch (error) {
      console.error('验证目标文件夹时出错:', operation.target, error);
      return {
        success: false,
        processedCount: 0,
        details: '验证目标文件夹时出错',
        error: `验证目标文件夹时出错: ${error instanceof Error ? error.message : String(error)}`
      };
    }
    
    // 过滤出符合条件的书签
    const filteredBookmarks = this.filterBookmarks(bookmarks, operation.filters);
    console.log('过滤后的书签数量:', filteredBookmarks.length);
    
    if (filteredBookmarks.length === 0) {
      console.log('没有符合条件的书签需要移动');
      return {
        success: true,
        processedCount: 0,
        details: '没有符合条件的书签需要移动',
        error: undefined
      };
    }
    
    let successCount = 0;
    let errorCount = 0;
    let errorDetails: string[] = [];
    
    // 执行移动操作
    for (const bookmark of filteredBookmarks) {
      try {
        console.log(`尝试移动书签 "${bookmark.title}" (ID: ${bookmark.id}) 到文件夹 ${operation.target}`);
        // 调用Chrome API移动书签
        const result = await bookmarkService.moveBookmark(bookmark.id, { parentId: operation.target });
        if (result.success) {
          successCount++;
          console.log(`成功移动书签 "${bookmark.title}"`);
        } else {
          errorCount++;
          const errorMsg = `移动书签 "${bookmark.title}" 失败: ${result.error}`;
          console.error(errorMsg);
          errorDetails.push(errorMsg);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `移动书签 ${bookmark.id} 失败: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errorDetails.push(errorMsg);
      }
    }
    
    // 返回结果
    const details = `成功移动 ${successCount} 个书签${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`;
    console.log('移动操作完成:', details);
    
    return {
      success: errorCount === 0,
      processedCount: successCount,
      details: details + (errorDetails.length > 0 ? `。错误详情: ${errorDetails.join('; ')}` : ''),
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
  
  /**
   * 为书签添加标签操作
   * @param bookmarks 书签树
   * @param operation 标签操作配置
   * @returns 操作结果
   */
  private async tagBookmarks(bookmarks: BookmarkItem[], operation: OrganizeOperation): Promise<OrganizeResult> {
    // 验证标签名称
    if (!operation.newName) {
      return {
        success: false,
        processedCount: 0,
        details: '标签操作缺少标签名称',
        error: '标签操作需要指定newName作为标签名称'
      };
    }
    
    // 过滤出符合条件的书签
    const filteredBookmarks = this.filterBookmarks(bookmarks, operation.filters);
    
    if (filteredBookmarks.length === 0) {
      return {
        success: true,
        processedCount: 0,
        details: '没有符合条件的书签需要添加标签',
        error: undefined
      };
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // 执行添加标签操作 (通过在标题前添加标签实现)
    for (const bookmark of filteredBookmarks) {
      try {
        const tagPrefix = `[${operation.newName}] `;
        // 检查书签标题是否已经包含该标签
        if (!bookmark.title.startsWith(tagPrefix)) {
          // 调用Chrome API更新书签标题，添加标签前缀
          await bookmarkService.updateBookmark(bookmark.id, {
            title: tagPrefix + bookmark.title
          });
          successCount++;
        } else {
          // 标签已存在，算作处理成功
          successCount++;
        }
      } catch (error) {
        console.error(`为书签 ${bookmark.id} 添加标签失败:`, error);
        errorCount++;
      }
    }
    
    // 返回结果
    return {
      success: errorCount === 0,
      processedCount: successCount,
      details: `成功为 ${successCount} 个书签添加标签${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      error: errorCount > 0 ? `${errorCount} 个书签添加标签失败` : undefined
    };
  }
  
  /**
   * 按域名整理书签操作
   * @param bookmarks 书签树
   * @param operation 整理操作配置
   * @returns 操作结果
   */
  private async organizeByDomain(bookmarks: BookmarkItem[], operation: OrganizeOperation): Promise<OrganizeResult> {
    // 过滤出符合条件的书签
    const filteredBookmarks = this.filterBookmarks(bookmarks, operation.filters);
    
    if (filteredBookmarks.length === 0) {
      return {
        success: true,
        processedCount: 0,
        details: '没有符合条件的书签需要整理',
        error: undefined
      };
    }
    
    let successCount = 0;
    let errorCount = 0;
    // 记录已创建的域名文件夹ID映射
    const domainFolders = new Map<string, string>();
    
    // 执行按域名整理操作
    for (const bookmark of filteredBookmarks) {
      try {
        if (!bookmark.url) continue; // 跳过文件夹
        
        // 提取域名
        const domain = this.extractDomain(bookmark.url);
        if (!domain) continue; // 跳过无效URL
        
        // 创建或查找域名文件夹
        let domainFolderId: string;
        
        if (domainFolders.has(domain)) {
          // 使用已创建的文件夹
          domainFolderId = domainFolders.get(domain)!;
        } else {
          // 创建域名文件夹（在"其他书签"文件夹下创建）
          const parentFolder = operation.target || '2'; // 默认使用"其他书签"文件夹
          const createResult = await bookmarkService.createFolder({
            parentId: parentFolder,
            title: domain
          });
          
          if (!createResult.success) {
            throw new Error(`创建域名文件夹失败: ${createResult.error}`);
          }
          
          domainFolderId = (createResult.data as BookmarkItem).id;
          domainFolders.set(domain, domainFolderId);
        }
        
        // 将书签移动到对应的域名文件夹
        await bookmarkService.moveBookmark(bookmark.id, { parentId: domainFolderId });
        successCount++;
      } catch (error) {
        console.error(`整理书签 ${bookmark.id} 失败:`, error);
        errorCount++;
      }
    }
    
    // 返回结果
    return {
      success: errorCount === 0,
      processedCount: successCount,
      details: `成功按域名整理 ${successCount} 个书签到 ${domainFolders.size} 个域名文件夹${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      error: errorCount > 0 ? `${errorCount} 个书签整理失败` : undefined
    };
  }
}

// 导出单例实例
const organizeService = OrganizeService.getInstance();
export default organizeService; 