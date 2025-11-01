/**
 * 版本检查服务
 * 负责检查扩展版本更新、比较版本号、管理更新提醒
 */

export interface ReleaseInfo {
  version: string;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

export interface VersionCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseInfo?: ReleaseInfo;
  isDevelopmentMode?: boolean;
}

class VersionService {
  private static instance: VersionService;
  
  // GitHub 仓库信息
  private readonly GITHUB_OWNER = 'rbetree';
  private readonly GITHUB_REPO = 'MarksVault';
  private readonly GITHUB_API_URL = `https://api.github.com/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/latest`;
  
  // localStorage 键名
  private readonly STORAGE_KEYS = {
    LAST_CHECK: 'version_last_check'
  };
  
  // 检查冷却时间（24小时）
  private readonly CHECK_COOLDOWN = 24 * 60 * 60 * 1000;
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): VersionService {
    if (!VersionService.instance) {
      VersionService.instance = new VersionService();
    }
    return VersionService.instance;
  }
  
  /**
   * 获取当前扩展版本
   */
  getCurrentVersion(): string {
    return chrome.runtime.getManifest().version;
  }
  
  /**
   * 从 GitHub API 获取最新版本信息
   */
  async getLatestRelease(): Promise<ReleaseInfo | null> {
    try {
      const response = await fetch(this.GITHUB_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        // 处理 API 限流或其他错误
        if (response.status === 403) {
          console.warn('GitHub API 限流，请稍后再试');
        } else if (response.status === 404) {
          console.warn('未找到最新版本信息');
        } else {
          console.error(`获取最新版本失败: ${response.status}`);
        }
        return null;
      }
      
      const data = await response.json();
      
      // 解析版本号（移除 'v' 前缀）
      const version = data.tag_name?.replace(/^v/, '') || data.name?.replace(/^v/, '');
      
      if (!version) {
        console.error('无法从 release 数据中解析版本号');
        return null;
      }
      
      return {
        version,
        releaseUrl: data.html_url || `https://github.com/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/latest`,
        releaseNotes: data.body || '暂无更新说明',
        publishedAt: data.published_at || new Date().toISOString()
      };
    } catch (error) {
      console.error('获取最新版本失败:', error);
      return null;
    }
  }
  
  /**
   * 比较两个语义化版本号
   * @returns 1 如果 v1 > v2, -1 如果 v1 < v2, 0 如果相等
   */
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(n => parseInt(n, 10));
    const parts2 = v2.split('.').map(n => parseInt(n, 10));
    
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }
  
  /**
   * 检查是否应该进行版本检查（考虑冷却时间）
   */
  shouldCheckVersion(): boolean {
    try {
      const lastCheckStr = localStorage.getItem(this.STORAGE_KEYS.LAST_CHECK);
      
      if (!lastCheckStr) {
        return true;
      }
      
      const lastCheck = parseInt(lastCheckStr, 10);
      const now = Date.now();
      
      return (now - lastCheck) >= this.CHECK_COOLDOWN;
    } catch (error) {
      console.error('检查版本检查时间失败:', error);
      return true; // 出错时允许检查
    }
  }
  
  /**
   * 更新最后检查时间
   */
  private updateLastCheckTime(): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.LAST_CHECK, Date.now().toString());
    } catch (error) {
      console.error('更新检查时间失败:', error);
    }
  }
  
  
  /**
   * 清除所有版本检查相关的存储
   */
  clearVersionStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.LAST_CHECK);
    } catch (error) {
      console.error('清除版本存储失败:', error);
    }
  }
  
  /**
   * 检查是否有可用更新
   * @param force 是否强制检查（忽略冷却时间）
   */
  async checkForUpdates(force: boolean = false): Promise<VersionCheckResult> {
    const currentVersion = this.getCurrentVersion();
    
    // 检查是否需要进行版本检查
    if (!force && !this.shouldCheckVersion()) {
      return {
        hasUpdate: false,
        currentVersion
      };
    }
    
    // 更新最后检查时间
    this.updateLastCheckTime();
    
    // 获取最新版本信息
    const releaseInfo = await this.getLatestRelease();
    
    if (!releaseInfo) {
      // 即使没有 release，也显示开发模式徽章
      return {
        hasUpdate: false,
        currentVersion,
        isDevelopmentMode: true // 没有正式发布版本时，视为开发模式
      };
    }
    
    // 比较版本
    const comparison = this.compareVersions(releaseInfo.version, currentVersion);
    const hasUpdate = comparison > 0;
    const isDevelopmentMode = comparison < 0; // 当前版本大于最新版本，表示处于开发模式
    
    return {
      hasUpdate,
      currentVersion,
      latestVersion: releaseInfo.version,
      releaseInfo,
      isDevelopmentMode
    };
  }
}

// 导出单例实例
export default VersionService.getInstance();