import { BookmarkBackup, BackupResult, BackupStatus } from '../types/backup';
import { GitHubCredentials } from '../utils/storage-service';
import { BookmarkItem } from '../utils/bookmark-service';
import bookmarkService from '../utils/bookmark-service';
import githubService from './github-service';
import storageService from '../utils/storage-service';

// 备份存储库名称
const DEFAULT_BACKUP_REPO = 'marksvault-backups';
// 备份文件路径：最新文件和带时间戳的历史文件
const LATEST_BACKUP_PATH = 'bookmark_backup_latest.json';

class BackupService {
  private static instance: BackupService;
  
  private constructor() {}
  
  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }
  
  /**
   * 创建书签备份
   * @returns 序列化的书签备份数据
   */
  private async createBackupData(): Promise<BookmarkBackup> {
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
  
  /**
   * 备份书签到GitHub
   * @param credentials GitHub认证凭据
   * @param username GitHub用户名
   * @returns 备份结果
   */
  async backupToGitHub(credentials: GitHubCredentials, username: string): Promise<BackupResult> {
    try {
      // 1. 创建备份数据
      const backupData = await this.createBackupData();
      
      // 2. 确保存储库存在
      const repoExists = await githubService.repoExists(credentials, username, DEFAULT_BACKUP_REPO);
      if (!repoExists) {
        // 创建新存储库
        await githubService.createRepo(credentials, DEFAULT_BACKUP_REPO, true);
      }
      
      // 3. 序列化数据
      const backupContent = JSON.stringify(backupData, null, 2);
      
      // 4. 生成带详细时间戳的文件路径 (格式: bookmark_backup_YYYYMMDDHHMMSS.json)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
      const backupFilePath = `bookmark_backup_${timestamp}.json`;
      
      // 5. 上传新备份文件（不再更新最新文件，只创建新文件）
      const uploadResult = await githubService.createOrUpdateFile(
        credentials,
        username,
        DEFAULT_BACKUP_REPO,
        backupFilePath,
        backupContent,
        `添加书签备份 - ${now.toLocaleString()}`
      );
      
      // 6. 保存备份状态
      const backupStatus: BackupStatus = {
        lastBackupTime: now.getTime(),
        backupFileUrl: uploadResult.content.html_url,
        lastBackupFilePath: backupFilePath,
        lastOperationStatus: 'success'
      };
      
      await storageService.saveBackupStatus(backupStatus);
      
      // 7. 返回成功结果
      return {
        success: true,
        data: {
          fileUrl: uploadResult.content.html_url,
          timestamp: backupData.timestamp,
          bookmarksCount: backupData.metadata?.totalBookmarks,
          filePath: backupFilePath
        },
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('书签备份失败:', error);
      
      // 保存失败状态
      const backupStatus: BackupStatus = {
        lastOperationStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      };
      
      await storageService.saveBackupStatus(backupStatus);
      
      return {
        success: false,
        error: `备份失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * 从GitHub恢复书签
   * @param credentials GitHub认证凭据
   * @param username GitHub用户名
   * @param useTimestampedFile 是否使用带时间戳的文件而不是最新文件
   * @param timestampedFilePath 带时间戳的文件路径(如果useTimestampedFile为true)
   * @returns 恢复结果
   */
  async restoreFromGitHub(
    credentials: GitHubCredentials, 
    username: string,
    useTimestampedFile: boolean = false,
    timestampedFilePath?: string
  ): Promise<BackupResult> {
    try {
      // 1. 确保存储库存在
      const repoExists = await githubService.repoExists(credentials, username, DEFAULT_BACKUP_REPO);
      if (!repoExists) {
        throw new Error('备份存储库不存在，请先进行备份');
      }
      
      // 2. 获取备份文件内容
      const filePath = useTimestampedFile && timestampedFilePath 
        ? timestampedFilePath 
        : LATEST_BACKUP_PATH;
      
      const fileData = await githubService.getFileContent(
        credentials,
        username,
        DEFAULT_BACKUP_REPO,
        filePath
      );
      
      // 3. 解析备份数据
      const backupData = JSON.parse(fileData.content) as BookmarkBackup;
      
      // 4. 验证数据格式
      if (!backupData.bookmarks || !Array.isArray(backupData.bookmarks)) {
        throw new Error('备份文件格式不正确');
      }
      
      console.log('备份数据结构:', JSON.stringify(backupData.bookmarks.map((b: BookmarkItem) => ({ id: b.id, title: b.title, children: b.children?.length || 0 }))));
      
      // 5. 执行恢复操作
      // 5.1 获取书签根文件夹
      const rootsResult = await bookmarkService.getBookmarkRoots();
      if (!rootsResult.success || !rootsResult.data) {
        throw new Error(`获取书签根文件夹失败: ${rootsResult.error}`);
      }
      
      const roots = rootsResult.data;
      console.log('浏览器书签根:', JSON.stringify(roots.map((r: BookmarkItem) => ({ id: r.id, title: r.title }))));
      
      // 找到书签栏 - 优先使用ID为1的(Chrome书签栏)
      let bookmarkBar = roots.find((root: BookmarkItem) => root.id === '1');
      
      // 如果通过ID找不到，尝试通过标题找(可能有本地化差异)
      if (!bookmarkBar) {
        const possibleTitles = ['书签栏', 'Bookmarks Bar', 'Bookmarks bar', 'Bookmark Bar'];
        bookmarkBar = roots.find((root: BookmarkItem) => 
          possibleTitles.includes(root.title)
        );
      }
      
      if (!bookmarkBar) {
        throw new Error('找不到书签栏，无法恢复书签');
      }
      
      console.log('找到书签栏:', bookmarkBar.id, bookmarkBar.title);
      
      // 5.2 准备要恢复的书签数据
      // 从备份中查找合适的书签数据
      let bookmarksToRestore: BookmarkItem[] = [];
      
      // 尝试方法1: 查找标题为"书签栏"的项
      const bookmarkBarInBackup = backupData.bookmarks
        .flatMap((root: BookmarkItem) => root.children || [])
        .find((item: BookmarkItem) => ['书签栏', 'Bookmarks Bar', 'Bookmarks bar', 'Bookmark Bar'].includes(item.title));
      
      if (bookmarkBarInBackup && bookmarkBarInBackup.children) {
        console.log('方法1: 从备份中找到书签栏:', bookmarkBarInBackup.title);
        bookmarksToRestore = bookmarkBarInBackup.children;
      } else {
        // 尝试方法2: 使用备份根节点的第一个子节点的子节点
        console.log('方法1失败，尝试方法2');
        if (backupData.bookmarks[0] && backupData.bookmarks[0].children) {
          // 通常第一个子节点会是书签栏
          const firstChild = backupData.bookmarks[0].children[0];
          if (firstChild && firstChild.children) {
            console.log('方法2: 使用第一个子节点的子节点');
            bookmarksToRestore = firstChild.children;
          } else if (backupData.bookmarks[0].children) {
            // 如果第一个子节点没有子节点，使用所有子节点
            console.log('方法2: 使用所有子节点');
            bookmarksToRestore = backupData.bookmarks[0].children;
          }
        }
      }
      
      // 方法3: 最后尝试用直接的书签数据
      if (bookmarksToRestore.length === 0) {
        console.log('方法3: 直接使用根书签数据');
        // 如果前两种方法都找不到，直接使用根书签数据
        if (backupData.bookmarks[0] && backupData.bookmarks[0].children) {
          bookmarksToRestore = backupData.bookmarks[0].children;
        } else {
          bookmarksToRestore = backupData.bookmarks;
        }
      }
      
      if (bookmarksToRestore.length === 0) {
        throw new Error('备份数据中找不到可恢复的书签');
      }
      
      console.log(`准备恢复 ${bookmarksToRestore.length} 个书签项`);
      
      // 5.3 递归删除现有书签
      // 保存现有书签的备份，以防恢复失败
      const existingBookmarks = bookmarkBar.children || [];
      console.log(`当前有 ${existingBookmarks.length} 个书签项将被清除`);
      
      // 5.4 递归创建新书签的函数
      const createBookmarks = async (
        items: BookmarkItem[], 
        parentId: string
      ): Promise<void> => {
        for (const item of items) {
          try {
            if (item.isFolder) {
              // 创建文件夹
              const folderResult = await bookmarkService.createFolder({
                parentId,
                title: item.title
              });
              
              if (!folderResult.success) {
                console.error(`创建文件夹 ${item.title} 失败:`, folderResult.error);
                continue;
              }
              
              // 递归创建子书签
              if (item.children && item.children.length > 0) {
                await createBookmarks(item.children, folderResult.data.id);
              }
            } else if (item.url) {
              // 创建书签
              await bookmarkService.createBookmark({
                parentId,
                title: item.title,
                url: item.url
              });
            }
          } catch (itemError) {
            console.error(`处理书签项 ${item.title} 时出错:`, itemError);
            // 继续处理下一项
          }
        }
      };
      
      // 5.5 开始恢复过程
      // 先移除现有书签
      try {
        for (const child of bookmarkBar.children || []) {
          await bookmarkService.removeBookmarkTree(child.id);
        }
        console.log('成功清除现有书签');
        
        // 恢复书签
        await createBookmarks(bookmarksToRestore, bookmarkBar.id);
        console.log('成功恢复书签');
      } catch (restoreError) {
        console.error('恢复过程中发生错误:', restoreError);
        throw restoreError;
      }
      
      // 6. 保存恢复状态
      const backupStatus: BackupStatus = {
        lastRestoreTime: Date.now(),
        lastOperationStatus: 'success'
      };
      
      await storageService.saveBackupStatus(backupStatus);
      
      // 7. 返回成功结果
      return {
        success: true,
        data: {
          timestamp: backupData.timestamp,
          bookmarksCount: backupData.metadata?.totalBookmarks || bookmarksToRestore.length
        },
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('书签恢复失败:', error);
      
      // 保存失败状态
      const backupStatus: BackupStatus = {
        lastOperationStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      };
      
      await storageService.saveBackupStatus(backupStatus);
      
      return {
        success: false,
        error: `恢复失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * 获取备份统计信息
   * @param credentials GitHub凭据
   * @param username GitHub用户名
   * @param forceRefresh 是否强制刷新（忽略缓存）
   * @returns 备份统计信息
   */
  async getBackupStats(
    credentials: GitHubCredentials, 
    username: string,
    forceRefresh: boolean = false
  ): Promise<{
    totalBackups: number;
    firstBackupTime?: number;
    totalBookmarks?: number;
    totalFolders?: number;
    fileSize?: number;
    isFromCache?: boolean;
  }> {
    try {
      // 1. 尝试从缓存获取
      if (!forceRefresh) {
        const cacheResult = await storageService.getBackupStatsCache();
        if (cacheResult.success && cacheResult.data) {
          const cache = cacheResult.data;
          // 检查缓存是否有效
          if (storageService.isBackupStatsCacheValid(cache)) {
            console.log('使用备份统计信息缓存');
            return { ...cache.data, isFromCache: true };
          }
        }
      }
      
      // 2. 缓存无效或强制刷新，从GitHub获取数据
      console.log('从GitHub获取备份统计信息');
      
      // 获取所有备份文件
      const files = await githubService.getRepositoryFiles(
        credentials,
        username,
        DEFAULT_BACKUP_REPO
      );
      
      // 过滤并计算备份文件数量
      const backupFiles = files.filter(
        file => file.name.startsWith('bookmark_backup_') && file.name.endsWith('.json')
      );
      
      const totalBackups = backupFiles.length;
      
      if (totalBackups === 0) {
        return { totalBackups: 0 };
      }
      
      // 解析文件名中的时间戳
      const parseTimestamp = (filename: string): number => {
        const match = filename.match(/bookmark_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
        if (match) {
          const [_, year, month, day, hour, minute, second] = match;
          return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
        }
        return 0;
      };
      
      // 提取时间戳并排序
      const timestamps = backupFiles
        .map(file => parseTimestamp(file.name))
        .filter(ts => ts > 0)
        .sort((a, b) => a - b);
      
      // 最早备份时间
      const firstBackupTime = timestamps.length > 0 ? timestamps[0] : undefined;
      
      // 如果有最近的备份文件，获取其内容以提取书签和文件夹数量
      let totalBookmarks: number | undefined;
      let totalFolders: number | undefined;
      let fileSize: number | undefined;
      
      // 获取最新备份文件(按时间戳排序)
      const latestFile = backupFiles
        .sort((a, b) => parseTimestamp(b.name) - parseTimestamp(a.name))[0];
      
      if (latestFile) {
        // 设置文件大小
        fileSize = latestFile.size;
        
        // 获取文件内容以提取详细信息
        try {
          const fileData = await githubService.getFileContent(
            credentials,
            username,
            DEFAULT_BACKUP_REPO,
            latestFile.path
          );
          
          const backupData = JSON.parse(fileData.content) as BookmarkBackup;
          
          // 提取元数据
          if (backupData.metadata) {
            totalBookmarks = backupData.metadata.totalBookmarks;
            totalFolders = backupData.metadata.totalFolders;
          }
        } catch (error) {
          console.error('获取最新备份内容失败:', error);
          // 如果获取内容失败，只返回基本统计信息
        }
      }
      
      // 构建结果
      const statsData = {
        totalBackups,
        firstBackupTime,
        totalBookmarks,
        totalFolders,
        fileSize
      };
      
      // 3. 将获取的数据保存到缓存
      await storageService.saveBackupStatsCache(statsData);
      
      return statsData;
    } catch (error) {
      console.error('获取备份统计信息失败:', error);
      // 发生错误时返回基本信息
      return { totalBackups: 0 };
    }
  }
  
  /**
   * 获取备份状态，支持异步更新
   * @param forceRefresh 是否强制刷新缓存数据
   * @param updateCallback 异步更新完成后的回调函数
   * @returns 备份状态信息
   */
  async getBackupStatus(
    forceRefresh: boolean = false,
    updateCallback?: (updatedStatus: BackupStatus) => void
  ): Promise<BackupStatus> {
    try {
      // 1. 先获取本地存储的基本状态信息
      const result = await storageService.getBackupStatus();
      const status = result.success ? result.data : {};
      
      // 2. 尝试从缓存获取统计信息
      try {
        const cacheResult = await storageService.getBackupStatsCache();
        if (!forceRefresh && cacheResult.success && cacheResult.data && 
            storageService.isBackupStatsCacheValid(cacheResult.data)) {
          // 使用缓存的统计信息
          const cachedStatus = { ...status, stats: cacheResult.data.data };
          
          // 3. 异步刷新数据（不阻塞UI）
          this.refreshBackupStatsAsync(cachedStatus, updateCallback);
          
          return cachedStatus;
        }
      } catch (error) {
        console.error('获取缓存的备份统计信息失败:', error);
      }
      
      // 4. 如果没有有效缓存，同步获取完整数据
      return await this.getFullBackupStatus(status, updateCallback);
    } catch (error) {
      console.error('获取备份状态失败:', error);
      return {};
    }
  }
  
  /**
   * 获取完整的备份状态（包括从GitHub获取的统计信息）
   * @param baseStatus 基本状态信息
   * @param updateCallback 更新回调
   * @returns 完整的备份状态
   */
  private async getFullBackupStatus(
    baseStatus: BackupStatus,
    updateCallback?: (updatedStatus: BackupStatus) => void
  ): Promise<BackupStatus> {
    try {
      // 尝试获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      if (!credentialsResult.success || !credentialsResult.data) {
        return baseStatus; // 无法获取凭据，返回基本状态
      }
      
      // 获取GitHub用户名
      const userResult = await githubService.validateCredentials(credentialsResult.data);
      
      // 获取统计信息
      const stats = await this.getBackupStats(credentialsResult.data, userResult.login, true);
      
      // 更新状态
      const updatedStatus = { ...baseStatus, stats };
      
      // 如果提供了回调，执行回调
      if (updateCallback) {
        updateCallback(updatedStatus);
      }
      
      return updatedStatus;
    } catch (error) {
      console.error('获取完整备份状态失败:', error);
      return baseStatus; // 出错时返回基本状态
    }
  }
  
  /**
   * 异步刷新备份统计信息
   * @param currentStatus 当前状态
   * @param updateCallback 更新回调
   */
  private async refreshBackupStatsAsync(
    currentStatus: BackupStatus,
    updateCallback?: (updatedStatus: BackupStatus) => void
  ): Promise<void> {
    setTimeout(async () => {
      try {
        const updatedStatus = await this.getFullBackupStatus(currentStatus, updateCallback);
        
        // 如果提供了回调但在getFullBackupStatus中未调用（例如因为出错），这里调用
        if (updateCallback && JSON.stringify(updatedStatus) !== JSON.stringify(currentStatus)) {
          updateCallback(updatedStatus);
        }
      } catch (error) {
        console.error('异步刷新备份统计信息失败:', error);
      }
    }, 100); // 短暂延迟，确保UI先渲染
  }
  
  /**
   * 创建HTML格式的书签数据
   * @returns HTML格式的书签数据
   */
  private async createHtmlBookmarkData(): Promise<string> {
    // 获取所有书签
    const bookmarksResult = await bookmarkService.getAllBookmarks();
    if (!bookmarksResult.success) {
      throw new Error(`获取书签失败: ${bookmarksResult.error}`);
    }
    
    const bookmarks = bookmarksResult.data as BookmarkItem[];
    
    // 创建标准的HTML书签格式
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    html += '<!-- This is an automatically generated file.\n';
    html += '     It will be read and overwritten.\n';
    html += '     DO NOT EDIT! -->\n';
    html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    html += '<TITLE>Bookmarks</TITLE>\n';
    html += '<H1>Bookmarks</H1>\n';
    html += '<DL><p>\n';
    
    // 递归生成书签HTML
    const generateBookmarkHtml = (items: BookmarkItem[], indentLevel: number = 1): string => {
      const indent = '    '.repeat(indentLevel);
      let result = '';
      
      items.forEach(item => {
        if (item.isFolder) {
          // 文件夹项
          result += `${indent}<DT><H3>${this.escapeHtml(item.title)}</H3>\n`;
          result += `${indent}<DL><p>\n`;
          
          if (item.children && item.children.length > 0) {
            result += generateBookmarkHtml(item.children, indentLevel + 1);
          }
          
          result += `${indent}</DL><p>\n`;
        } else if (item.url) {
          // 书签项
          const addDate = item.dateAdded ? ` ADD_DATE="${Math.floor(item.dateAdded / 1000)}"` : '';
          result += `${indent}<DT><A HREF="${this.escapeHtml(item.url)}"${addDate}>${this.escapeHtml(item.title)}</A>\n`;
        }
      });
      
      return result;
    };
    
    html += generateBookmarkHtml(bookmarks);
    html += '</DL><p>\n';
    
    return html;
  }
  
  /**
   * HTML转义特殊字符
   * @param text 需要转义的文本
   * @returns 转义后的文本
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  /**
   * 推送书签到GitHub
   * @param credentials GitHub认证凭据
   * @param username GitHub用户名
   * @param repoName 目标仓库名称，默认为menav
   * @param folderPath 目标文件夹路径，默认为bookmarks
   * @param commitMessage 提交消息
   * @returns 推送结果
   */
  async pushBookmarksToGitHub(
    credentials: GitHubCredentials, 
    username: string,
    repoName: string = 'menav',
    folderPath: string = 'bookmarks',
    commitMessage: string = '自动推送书签'
  ): Promise<BackupResult> {
    try {
      // 1. 创建HTML格式的书签数据
      const htmlBookmarkData = await this.createHtmlBookmarkData();
      
      // 2. 确保存储库存在
      const repoExists = await githubService.repoExists(credentials, username, repoName);
      if (!repoExists) {
        // 创建新存储库
        await githubService.createRepo(credentials, repoName, true);
      }
      
      // 3. 生成文件名 (格式: bookmarks_YYYYMMDD.html)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      
      const dateString = `${year}${month}${day}`;
      const fileName = `bookmarks_${dateString}.html`;
      const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      
      // 4. 上传HTML书签文件
      const uploadResult = await githubService.createOrUpdateFile(
        credentials,
        username,
        repoName,
        filePath,
        htmlBookmarkData,
        commitMessage || `推送书签 - ${now.toLocaleString()}`
      );
      
      // 5. 保存状态 (使用与备份相同的状态结构，但区分开)
      const backupStatus: BackupStatus = {
        lastBackupTime: now.getTime(),
        backupFileUrl: uploadResult.content.html_url,
        lastBackupFilePath: filePath,
        lastOperationStatus: 'success'
      };
      
      await storageService.saveBackupStatus({
        ...backupStatus,
        stats: {
          ...backupStatus.stats,
          isFromCache: false
        }
      });
      
      // 6. 返回成功结果
      return {
        success: true,
        data: {
          fileUrl: uploadResult.content.html_url,
          timestamp: now.getTime(),
          filePath: filePath
        },
        timestamp: now.getTime()
      };
    } catch (error) {
      console.error('推送书签失败:', error);
      
      // 保存失败状态
      const backupStatus: BackupStatus = {
        lastOperationStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      };
      
      await storageService.saveBackupStatus(backupStatus);
      
      return {
        success: false,
        error: `推送失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default BackupService.getInstance(); 