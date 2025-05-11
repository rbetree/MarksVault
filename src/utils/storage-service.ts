// 用户设置类型
export interface UserSettings {
  isDarkMode: boolean;
  syncEnabled: boolean;
  viewType: 'list' | 'grid'; // 视图类型：列表或网格
  // 更多设置项...
}

// GitHub认证凭据类型
export interface GitHubCredentials {
  token: string;
}

// 备份统计信息缓存类型
export interface BackupStatsCache {
  data: {
    totalBackups: number;
    firstBackupTime?: number;
    totalBookmarks?: number;
    totalFolders?: number;
    fileSize?: number;
  };
  timestamp: number; // 缓存创建时间
}

// 书签自定义数据类型
export interface BookmarkCustomData {
  lastUpdated: number | null;
  customData: { [bookmarkId: string]: any };
  // 更多自定义数据...
}

// 存储操作结果类型
export interface StorageResult {
  success: boolean;
  data?: any;
  error?: string;
}

// 导入备份状态类型
import { BackupStatus } from '../types/backup';

class StorageService {
  // 备份统计信息缓存的过期时间（毫秒）
  private readonly BACKUP_STATS_CACHE_TTL = 10 * 60 * 1000; // 10分钟

  /**
   * 获取用户设置
   * @returns Promise<StorageResult>
   */
  async getSettings(): Promise<StorageResult> {
    try {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || {
        isDarkMode: false,
        syncEnabled: false,
        viewType: 'grid' // 默认使用网格视图
      };
      
      return {
        success: true,
        data: settings
      };
    } catch (error) {
      console.error('获取设置失败:', error);
      return {
        success: false,
        error: '获取设置失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 保存用户设置
   * @param settings 设置对象
   * @returns Promise<StorageResult>
   */
  async saveSettings(settings: UserSettings): Promise<StorageResult> {
    try {
      await chrome.storage.local.set({ settings });
      return {
        success: true
      };
    } catch (error) {
      console.error('保存设置失败:', error);
      return {
        success: false,
        error: '保存设置失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 更新用户设置
   * @param partialSettings 部分设置
   * @returns Promise<StorageResult>
   */
  async updateSettings(partialSettings: Partial<UserSettings>): Promise<StorageResult> {
    try {
      const result = await this.getSettings();
      if (!result.success) {
        return result;
      }

      const currentSettings = result.data as UserSettings;
      const updatedSettings = {
        ...currentSettings,
        ...partialSettings
      };

      return await this.saveSettings(updatedSettings);
    } catch (error) {
      console.error('更新设置失败:', error);
      return {
        success: false,
        error: '更新设置失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取书签的自定义数据
   * @returns Promise<StorageResult>
   */
  async getBookmarkCustomData(): Promise<StorageResult> {
    try {
      const result = await chrome.storage.local.get('bookmarks');
      const bookmarkData = result.bookmarks || {
        lastUpdated: null,
        customData: {}
      };
      
      return {
        success: true,
        data: bookmarkData
      };
    } catch (error) {
      console.error('获取书签数据失败:', error);
      return {
        success: false,
        error: '获取书签数据失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 保存书签的自定义数据
   * @param bookmarkData 书签数据
   * @returns Promise<StorageResult>
   */
  async saveBookmarkCustomData(bookmarkData: BookmarkCustomData): Promise<StorageResult> {
    try {
      await chrome.storage.local.set({
        bookmarks: {
          ...bookmarkData,
          lastUpdated: Date.now()
        }
      });
      
      return {
        success: true
      };
    } catch (error) {
      console.error('保存书签数据失败:', error);
      return {
        success: false,
        error: '保存书签数据失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 更新特定书签的自定义数据
   * @param bookmarkId 书签ID
   * @param customData 自定义数据
   * @returns Promise<StorageResult>
   */
  async updateBookmarkData(bookmarkId: string, customData: any): Promise<StorageResult> {
    try {
      const result = await this.getBookmarkCustomData();
      if (!result.success) {
        return result;
      }

      const currentData = result.data as BookmarkCustomData;
      
      const updatedData: BookmarkCustomData = {
        ...currentData,
        customData: {
          ...currentData.customData,
          [bookmarkId]: customData
        }
      };

      return await this.saveBookmarkCustomData(updatedData);
    } catch (error) {
      console.error(`更新书签 ${bookmarkId} 数据失败:`, error);
      return {
        success: false,
        error: `更新书签数据失败: ` + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 保存GitHub认证凭据
   * @param credentials GitHub认证凭据
   * @returns Promise<StorageResult>
   */
  async saveGitHubCredentials(credentials: GitHubCredentials): Promise<StorageResult> {
    try {
      await chrome.storage.sync.set({ 'github_credentials': credentials });
      return {
        success: true
      };
    } catch (error) {
      console.error('保存GitHub凭据失败:', error);
      return {
        success: false,
        error: '保存GitHub凭据失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取GitHub认证凭据
   * @returns Promise<StorageResult>
   */
  async getGitHubCredentials(): Promise<StorageResult> {
    try {
      const result = await chrome.storage.sync.get('github_credentials');
      return {
        success: true,
        data: result.github_credentials || null
      };
    } catch (error) {
      console.error('获取GitHub凭据失败:', error);
      return {
        success: false,
        error: '获取GitHub凭据失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 清除GitHub认证凭据
   * @returns Promise<StorageResult>
   */
  async clearGitHubCredentials(): Promise<StorageResult> {
    try {
      await chrome.storage.sync.remove('github_credentials');
      return {
        success: true
      };
    } catch (error) {
      console.error('清除GitHub凭据失败:', error);
      return {
        success: false,
        error: '清除GitHub凭据失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 保存备份状态信息
   * @param status 备份状态
   * @returns Promise<StorageResult>
   */
  async saveBackupStatus(status: BackupStatus): Promise<StorageResult> {
    try {
      // 先获取当前状态
      const currentResult = await this.getBackupStatus();
      const currentStatus = currentResult.success ? currentResult.data : {};
      
      // 合并现有状态和新状态
      const mergedStatus = {
        ...currentStatus,
        ...status
      };
      
      await chrome.storage.local.set({ 'backup_status': mergedStatus });
      return {
        success: true
      };
    } catch (error) {
      console.error('保存备份状态失败:', error);
      return {
        success: false,
        error: '保存备份状态失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
  
  /**
   * 获取备份状态信息
   * @returns Promise<StorageResult>
   */
  async getBackupStatus(): Promise<StorageResult> {
    try {
      const result = await chrome.storage.local.get('backup_status');
      return {
        success: true,
        data: result.backup_status || {}
      };
    } catch (error) {
      console.error('获取备份状态失败:', error);
      return {
        success: false,
        error: '获取备份状态失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取备份统计信息缓存
   * @returns Promise<StorageResult> 缓存的备份统计信息
   */
  async getBackupStatsCache(): Promise<StorageResult> {
    try {
      const result = await chrome.storage.local.get('backup_stats_cache');
      return {
        success: true,
        data: result.backup_stats_cache || null
      };
    } catch (error) {
      console.error('获取备份统计信息缓存失败:', error);
      return {
        success: false,
        error: '获取备份统计信息缓存失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 保存备份统计信息到缓存
   * @param statsData 备份统计信息
   * @returns Promise<StorageResult>
   */
  async saveBackupStatsCache(statsData: any): Promise<StorageResult> {
    try {
      const cacheData: BackupStatsCache = {
        data: statsData,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ 'backup_stats_cache': cacheData });
      return {
        success: true
      };
    } catch (error) {
      console.error('保存备份统计信息缓存失败:', error);
      return {
        success: false,
        error: '保存备份统计信息缓存失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 检查备份统计信息缓存是否有效（未过期）
   * @param cacheData 缓存数据
   * @returns boolean 缓存是否有效
   */
  isBackupStatsCacheValid(cacheData: BackupStatsCache | null): boolean {
    if (!cacheData || !cacheData.timestamp) {
      return false;
    }
    
    const now = Date.now();
    const cacheAge = now - cacheData.timestamp;
    
    return cacheAge < this.BACKUP_STATS_CACHE_TTL;
  }

  /**
   * 获取存储中的数据
   * @param key 存储键名
   * @returns Promise<StorageResult>
   */
  async getStorageData(key: string): Promise<StorageResult> {
    try {
      const result = await chrome.storage.local.get(key);
      return {
        success: true,
        data: result[key] || null
      };
    } catch (error) {
      console.error(`获取存储数据 ${key} 失败:`, error);
      return {
        success: false,
        error: `获取存储数据失败: ` + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 保存数据到存储
   * @param key 存储键名
   * @param data 要保存的数据
   * @returns Promise<StorageResult>
   */
  async setStorageData(key: string, data: any): Promise<StorageResult> {
    const maxRetries = 3; // 最大重试次数
    let retryCount = 0;
    let lastError: any = null;
    
    while (retryCount < maxRetries) {
      try {
        await chrome.storage.local.set({ [key]: data });
        
        if (retryCount > 0) {
          console.log(`保存数据到 ${key} 成功，在第 ${retryCount + 1} 次尝试后`);
        }
        
        return {
          success: true
        };
      } catch (error) {
        lastError = error;
        retryCount++;
        
        console.warn(`保存数据到 ${key} 失败 (尝试 ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount < maxRetries) {
          // 使用指数退避策略，增加重试间隔
          const delayMs = Math.min(100 * Math.pow(2, retryCount), 1000);
          console.log(`将在 ${delayMs}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // 所有重试都失败
    console.error(`保存数据到 ${key} 最终失败，已重试 ${maxRetries} 次:`, lastError);
    return {
      success: false,
      error: `保存数据失败 (已重试 ${maxRetries} 次): ` + 
        (lastError instanceof Error ? lastError.message : String(lastError))
    };
  }

  /**
   * 清除所有存储数据
   * @returns Promise<StorageResult>
   */
  async clearAllData(): Promise<StorageResult> {
    try {
      await Promise.all([
        chrome.storage.local.clear(),
        chrome.storage.sync.clear()
      ]);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('清除所有数据失败:', error);
      return {
        success: false,
        error: '清除所有数据失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
}

// 导出StorageService单例
const storageService = new StorageService();
export default storageService; 