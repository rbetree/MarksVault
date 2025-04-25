// 用户设置类型
export interface UserSettings {
  isDarkMode: boolean;
  syncEnabled: boolean;
  viewType: 'list' | 'grid'; // 视图类型：列表或网格
  // 更多设置项...
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

class StorageService {
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
   * 清除所有存储数据
   * @returns Promise<StorageResult>
   */
  async clearAllData(): Promise<StorageResult> {
    try {
      await chrome.storage.local.clear();
      return {
        success: true
      };
    } catch (error) {
      console.error('清除数据失败:', error);
      return {
        success: false,
        error: '清除数据失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
}

// 导出存储服务单例
export default new StorageService(); 