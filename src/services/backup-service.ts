import { BookmarkBackup, BackupResult, BackupStatus } from '../types/backup';
import { GitHubCredentials } from '../utils/storage-service';
import { BookmarkItem } from '../utils/bookmark-service';
import bookmarkService from '../utils/bookmark-service';
import githubService from './github-service';
import storageService from '../utils/storage-service';
import { getFaviconUrl } from '../utils/favicon-service';

// 备份存储库名称
const DEFAULT_BACKUP_REPO = 'marksvault-backups';
// 备份文件路径：最新文件和带时间戳的历史文件
const LATEST_BACKUP_PATH = 'bookmarks_backup_latest.json';
// 设置文件备份文件夹路径
const SETTINGS_FOLDER_PATH = 'settings';
// 备份类型常量
export enum BackupType {
  BOOKMARKS = 'bookmarks',
  SETTINGS = 'settings'
}

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
   * 创建设置备份数据
   * @returns 设置备份数据对象
   */
  private async createSettingsBackupData(): Promise<any> {
    // 获取用户设置
    const settingsResult = await storageService.getSettings();
    if (!settingsResult.success) {
      throw new Error(`获取设置失败: ${settingsResult.error}`);
    }
    
    // 创建源信息
    const source = `MarksVault Extension (${navigator.platform})`;
    
    // 创建备份对象
    const backup = {
      version: '1.0',
      timestamp: Date.now(),
      source,
      settings: settingsResult.data,
      metadata: {
        type: 'settings'
      }
    };
    
    return backup;
  }
  
  /**
   * 备份到GitHub
   * @param credentials GitHub认证凭据
   * @param username GitHub用户名
   * @param type 备份类型 (bookmarks 或 settings)
   * @returns 备份结果
   */
  async backupToGitHub(
    credentials: GitHubCredentials, 
    username: string,
    type: BackupType = BackupType.BOOKMARKS
  ): Promise<BackupResult> {
    try {
      // 1. 创建备份数据 (根据类型)
      let backupData: any;
      let backupFolder: string;
      let backupDescription: string;
      
      if (type === BackupType.SETTINGS) {
        backupData = await this.createSettingsBackupData();
        backupFolder = SETTINGS_FOLDER_PATH;
        backupDescription = '设置';
      } else {
        backupData = await this.createBackupData();
        backupFolder = 'bookmarks';
        backupDescription = '书签';
      }
      
      // 2. 确保存储库存在
      const repoExists = await githubService.repoExists(credentials, username, DEFAULT_BACKUP_REPO);
      if (!repoExists) {
        // 创建新存储库
        try {
          const createRepoResult = await githubService.createRepo(credentials, DEFAULT_BACKUP_REPO, true);
          
          // 检查创建结果中是否有_repoExisted标记，表示仓库已存在但成功获取了信息
          if (createRepoResult._repoExisted) {
            console.log('仓库已存在，使用现有仓库');
          } else {
            // 给存储库一些时间初始化
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (repoError) {
          // 如果创建仓库失败，再次检查仓库是否存在
          console.error('创建仓库失败，再次检查仓库是否存在:', repoError);
          const recheckedExists = await githubService.repoExists(credentials, username, DEFAULT_BACKUP_REPO);
          
          if (!recheckedExists) {
            // 如果确实不存在，则抛出原始错误
            throw repoError;
          } else {
            console.log('仓库已存在，继续备份流程');
          }
        }
      }
      
      // 3. 序列化数据
      const backupContent = JSON.stringify(backupData, null, 2);
      
      // 4. 生成带详细时间戳的文件路径
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
      const fileName = `${type}_backup_${timestamp}.json`;
      // 将文件保存到对应文件夹
      const backupFilePath = `${backupFolder}/${fileName}`;
      
      // GitHub API对于不存在的目录会自动创建
      // 但我们可以先检查目录是否存在于仓库中
      // 5. 上传新备份文件
      console.log(`开始上传备份文件: ${backupFilePath}`);
      try {
        const uploadResult = await githubService.createOrUpdateFile(
          credentials,
          username,
          DEFAULT_BACKUP_REPO,
          backupFilePath,
          backupContent,
          `添加${backupDescription}备份 - ${now.toLocaleString()}`
        );
        console.log('备份文件上传成功');
        
        // 6. 保存备份状态
        const backupStatus: BackupStatus = {
          lastBackupTime: now.getTime(),
          backupFileUrl: uploadResult.content.html_url,
          lastBackupFilePath: backupFilePath,
          lastOperationStatus: 'success'
        };
        
        if (type === BackupType.SETTINGS) {
          // 设置备份状态存储在另一个键中，避免与书签备份状态混淆
          await storageService.setStorageData('settings_backup_status', backupStatus);
        } else {
          await storageService.saveBackupStatus(backupStatus);
        }
        
        // 清理超出限制的旧备份文件
        try {
          const cleanupResult = await this.cleanupOldBackups(
            credentials,
            username,
            type
          );
          
          if (cleanupResult.deletedCount > 0) {
            console.log(`已清理 ${cleanupResult.deletedCount} 个旧的 ${type} 备份文件`);
          }
        } catch (cleanupError) {
          // 清理失败不应影响备份结果，只记录日志
          console.error('清理旧备份文件失败:', cleanupError);
        }
        
        // 7. 返回成功结果
        return {
          success: true,
          data: {
            fileUrl: uploadResult.content.html_url,
            timestamp: backupData.timestamp,
            filePath: backupFilePath
          },
          timestamp: backupData.timestamp
        };
      } catch (uploadError) {
        console.error(`上传备份文件失败:`, uploadError);
        
        // 保存失败状态
        const backupStatus: BackupStatus = {
          lastOperationStatus: 'failed',
          errorMessage: uploadError instanceof Error ? uploadError.message : String(uploadError)
        };
        
        if (type === BackupType.SETTINGS) {
          await storageService.setStorageData('settings_backup_status', backupStatus);
        } else {
          await storageService.saveBackupStatus(backupStatus);
        }
        
        return {
          success: false,
          error: `备份失败: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`
        };
      }
    } catch (error) {
      console.error(`${type}备份失败:`, error);
      
      // 保存失败状态
      const backupStatus: BackupStatus = {
        lastOperationStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      };
      
      if (type === BackupType.SETTINGS) {
        await storageService.setStorageData('settings_backup_status', backupStatus);
      } else {
        await storageService.saveBackupStatus(backupStatus);
      }
      
      return {
        success: false,
        error: `备份失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * 从GitHub恢复
   * @param credentials GitHub认证凭据
   * @param username GitHub用户名
   * @param type 恢复类型 (bookmarks 或 settings)
   * @param useTimestampedFile 是否使用带时间戳的文件而不是最新文件
   * @param timestampedFilePath 带时间戳的文件路径(如果useTimestampedFile为true)
   * @returns 恢复结果
   */
  async restoreFromGitHub(
    credentials: GitHubCredentials, 
    username: string,
    useTimestampedFile: boolean = false,
    timestampedFilePath?: string,
    type: BackupType = BackupType.BOOKMARKS
  ): Promise<BackupResult> {
    if (type === BackupType.SETTINGS) {
      return this.restoreSettingsFromGitHub(credentials, username, useTimestampedFile, timestampedFilePath);
    } else {
      return this.restoreBookmarksFromGitHub(credentials, username, useTimestampedFile, timestampedFilePath);
    }
  }
  
  /**
   * 从GitHub恢复设置
   * @param credentials GitHub认证凭据
   * @param username GitHub用户名
   * @param useTimestampedFile 是否使用带时间戳的文件
   * @param timestampedFilePath 带时间戳的文件路径
   * @returns 恢复结果
   */
  private async restoreSettingsFromGitHub(
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
      
      let filePath: string;
      
      if (useTimestampedFile && timestampedFilePath) {
        // 如果指定了时间戳文件，使用指定的文件
        filePath = timestampedFilePath.startsWith(SETTINGS_FOLDER_PATH) ? 
          timestampedFilePath : `${SETTINGS_FOLDER_PATH}/${timestampedFilePath}`;
      } else {
        // 否则，获取设置文件夹中的所有文件，找到最新的设置备份文件
        console.log(`尝试获取目录内容: ${SETTINGS_FOLDER_PATH}`);
        try {
          const files = await githubService.getRepositoryFiles(
            credentials,
            username,
            DEFAULT_BACKUP_REPO,
            SETTINGS_FOLDER_PATH
          );
          
          console.log(`获取到${files.length}个文件:`, files.map(f => f.name).join(', '));
          
          // 过滤获取所有设置备份文件
          const settingsBackupFiles = files.filter(
            file => file.name.startsWith('settings_backup_') && file.name.endsWith('.json')
          );
          
          console.log(`找到${settingsBackupFiles.length}个设置备份文件`);
          
          if (settingsBackupFiles.length === 0) {
            throw new Error('未找到设置备份文件，请先进行备份');
          }
          
          // 解析文件名中的时间戳，以便找到最新文件
          const parseTimestamp = (filename: string): number => {
            const match = filename.match(/settings_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
            if (match) {
              const [_, year, month, day, hour, minute, second] = match;
              return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
            }
            return 0;
          };
          
          // 按时间戳降序排序文件，取第一个（最新的）
          const latestFile = settingsBackupFiles
            .sort((a, b) => parseTimestamp(b.name) - parseTimestamp(a.name))[0];
          
          filePath = latestFile.path;
          console.log(`选择最新的设置备份文件: ${filePath}`);
        } catch (error) {
          console.error('获取仓库文件列表失败:', error);
          throw new Error(`获取仓库文件列表失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // 2. 获取备份文件内容
      console.log('尝试获取设置备份文件:', filePath);
      const fileData = await githubService.getFileContent(
        credentials,
        username,
        DEFAULT_BACKUP_REPO,
        filePath
      );
      
      // 3. 解析备份数据
      const backupData = JSON.parse(fileData.content);
      
      // 4. 验证数据格式
      if (!backupData.settings || typeof backupData.settings !== 'object') {
        throw new Error('备份文件格式不正确');
      }
      
      // 5. 保存设置
      const result = await storageService.saveSettings(backupData.settings);
      
      if (!result.success) {
        throw new Error(`保存设置失败: ${result.error}`);
      }
      
      // 6. 保存恢复状态
      const now = new Date();
      const restoreStatus: BackupStatus = {
        lastRestoreTime: now.getTime(),
        lastOperationStatus: 'success'
      };
      
      await storageService.setStorageData('settings_backup_status', restoreStatus);
      
      // 7. 返回成功结果
      return {
        success: true,
        data: {
          timestamp: backupData.timestamp,
          filePath
        },
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('设置恢复失败:', error);
      
      // 保存失败状态
      const restoreStatus: BackupStatus = {
        lastOperationStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      };
      
      await storageService.setStorageData('settings_backup_status', restoreStatus);
      
      return {
        success: false,
        error: `恢复失败: ${error instanceof Error ? error.message : String(error)}`
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
  private async restoreBookmarksFromGitHub(
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
        ? (timestampedFilePath.startsWith('bookmarks/') ? timestampedFilePath : `bookmarks/${timestampedFilePath}`)
        : `bookmarks/${LATEST_BACKUP_PATH}`;
      
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
      
      // 获取所有备份文件 (从bookmarks文件夹)
      const files = await githubService.getRepositoryFiles(
        credentials,
        username,
        DEFAULT_BACKUP_REPO,
        'bookmarks'
      );
      
      // 过滤并计算备份文件数量
      const backupFiles = files.filter(
        file => file.name.startsWith('bookmarks_backup_') && file.name.endsWith('.json')
      );
      
      const totalBackups = backupFiles.length;
      
      if (totalBackups === 0) {
        return { totalBackups: 0 };
      }
      
      // 解析文件名中的时间戳
      const parseTimestamp = (filename: string): number => {
        // 使用新格式的正则表达式
        const match = filename.match(/bookmarks_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
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
            latestFile.path // 已经包含了bookmarks/前缀
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
   * 获取备份状态
   * @param forceRefresh 是否强制刷新统计数据
   * @param updateCallback 状态更新回调函数
   * @returns 备份状态信息
   */
  async getBackupStatus(
    forceRefresh: boolean = false,
    updateCallback?: (updatedStatus: BackupStatus) => void
  ): Promise<BackupStatus> {
    try {
      // 获取基本状态信息
      const result = await storageService.getBackupStatus();
      const baseStatus = result.success ? result.data : {};
      
      // 如果需要强制刷新或者状态中没有统计数据，则获取完整状态
      if (forceRefresh || !baseStatus.stats) {
        const fullStatus = await this.getFullBackupStatus(baseStatus, updateCallback);
        return fullStatus;
      }
      
      // 如果有回调但状态已经包含统计数据，则异步刷新并通过回调返回更新后的状态
      if (updateCallback && baseStatus.stats) {
        // 异步刷新统计数据
        this.refreshBackupStatsAsync(baseStatus, updateCallback);
      }
      
      return baseStatus;
    } catch (error) {
      console.error('获取备份状态失败:', error);
      return {};
    }
  }
  
  /**
   * 获取设置备份状态
   * @param forceRefresh 是否强制刷新统计数据
   * @returns 设置备份状态信息
   */
  async getSettingsBackupStatus(
    forceRefresh: boolean = false
  ): Promise<BackupStatus> {
    try {
      // 获取基本状态信息
      const result = await storageService.getStorageData('settings_backup_status');
      const status = result.success ? result.data : {};
      
      if (forceRefresh) {
        // 在这里可以添加获取更多设置备份统计信息的逻辑，类似于书签备份的getFullBackupStatus方法
        // 例如获取设置备份的总数量、最新备份的大小等
      }
      
      return status;
    } catch (error) {
      console.error('获取设置备份状态失败:', error);
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
   * 获取图标并转换为 Base64 Data URI (PNG 格式)
   * @param url 网站 URL
   * @returns Base64 编码的 PNG 图标数据或 null
   */
  private async fetchIconAsBase64(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      // 如果已经是 PNG 格式，直接转换
      if (blob.type === 'image/png') {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
      
      // 如果不是 PNG，通过 Canvas 转换为 PNG
      return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        
        img.onload = () => {
          try {
            // 创建 canvas 进行格式转换
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(objectUrl);
              resolve(null);
              return;
            }
            
            ctx.drawImage(img, 0, 0);
            
            // 转换为 PNG 格式的 Data URI
            const pngDataUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(objectUrl);
            resolve(pngDataUrl);
          } catch (error) {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        
        img.src = objectUrl;
      });
    } catch (error) {
      console.warn('获取图标失败:', error);
      return null;
    }
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
    
    // 判断是否为书签栏文件夹
    const isBookmarkBar = (item: BookmarkItem): boolean => {
      // 通过ID判断（Chrome/Edge书签栏ID为'1'）
      if (item.id === '1') {
        return true;
      }
      // 通过标题判断
      const bookmarkBarTitles = ['書籤列', '书签栏', 'Bookmarks Bar', 'Bookmarks bar', 'Bookmark Bar'];
      return bookmarkBarTitles.includes(item.title);
    };
    
    // 递归生成书签HTML（异步）
    const generateBookmarkHtml = async (items: BookmarkItem[], indentLevel: number = 1, skipRootWrapper: boolean = true): Promise<string> => {
      const indent = '    '.repeat(indentLevel);
      let result = '';
      
      for (const item of items) {
        if (item.isFolder) {
          // 对于根节点的第一层，完全跳过根包装文件夹，直接处理其子节点
          if (skipRootWrapper && indentLevel === 1 && !isBookmarkBar(item)) {
            // 如果不是书签栏，直接递归处理子节点，不输出此节点的HTML
            if (item.children && item.children.length > 0) {
              result += await generateBookmarkHtml(item.children, indentLevel, false);
            }
            continue;
          }
          
          // 文件夹项 - 只添加 ADD_DATE 和 LAST_MODIFIED 属性
          const addDate = item.dateAdded ? Math.floor(item.dateAdded / 1000) : Math.floor(Date.now() / 1000);
          const lastModified = item.dateGroupModified ? Math.floor(item.dateGroupModified / 1000) : 0;
          
          // 检查是否为书签栏
          const personalToolbar = isBookmarkBar(item) ? ' PERSONAL_TOOLBAR_FOLDER="true"' : '';
          
          result += `${indent}<DT><H3 ADD_DATE="${addDate}" LAST_MODIFIED="${lastModified}"${personalToolbar}>${this.escapeHtml(item.title)}</H3>\n`;
          result += `${indent}<DL><p>\n`;
          
          if (item.children && item.children.length > 0) {
            result += await generateBookmarkHtml(item.children, indentLevel + 1, false);
          }
          
          result += `${indent}</DL><p>\n`;
        } else if (item.url) {
          // 书签项 - 只添加 ADD_DATE 和 ICON 属性（不添加 LAST_MODIFIED）
          const addDate = item.dateAdded ? Math.floor(item.dateAdded / 1000) : Math.floor(Date.now() / 1000);
          
          // 获取 ICON - 保持 PNG 格式
          let iconAttr = '';
          try {
            const faviconUrl = getFaviconUrl(item.url);
            if (faviconUrl) {
              const iconData = await this.fetchIconAsBase64(faviconUrl);
              if (iconData) {
                // 确保使用 PNG 格式
                if (iconData.startsWith('data:image/')) {
                  iconAttr = ` ICON="${iconData}"`;
                }
              }
            }
          } catch (error) {
            console.warn('Failed to fetch icon for', item.url, error);
          }
          
          result += `${indent}<DT><A HREF="${this.escapeHtml(item.url)}" ADD_DATE="${addDate}"${iconAttr}>${this.escapeHtml(item.title)}</A>\n`;
        }
      }
      
      return result;
    };
    
    html += await generateBookmarkHtml(bookmarks, 1, true);
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
        try {
          const createRepoResult = await githubService.createRepo(credentials, repoName, true);
          
          // 检查创建结果中是否有_repoExisted标记，表示仓库已存在但成功获取了信息
          if (createRepoResult._repoExisted) {
            console.log('目标仓库已存在，使用现有仓库');
          } else {
            // 给新创建的仓库一些时间初始化
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (repoError) {
          // 如果创建仓库失败，再次检查仓库是否存在
          console.error('创建目标仓库失败，再次检查仓库是否存在:', repoError);
          const recheckedExists = await githubService.repoExists(credentials, username, repoName);
          
          if (!recheckedExists) {
            // 如果确实不存在，则抛出原始错误
            throw repoError;
          } else {
            console.log('目标仓库已存在，继续推送流程');
          }
        }
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
  
  /**
   * 清理超出限制的旧备份文件
   * @param credentials GitHub凭据
   * @param username GitHub用户名
   * @param type 备份类型 (书签或设置)
   * @returns 清理结果
   */
  async cleanupOldBackups(
    credentials: GitHubCredentials,
    username: string,
    type: BackupType = BackupType.BOOKMARKS
  ): Promise<{success: boolean; deletedCount: number; error?: string}> {
    try {
      // 1. 获取用户设置，检查最大备份数量限制
      const settingsResult = await storageService.getSettings();
      if (!settingsResult.success) {
        return { success: true, deletedCount: 0 }; // 无法获取设置，不执行清理
      }

      const maxBackups = settingsResult.data?.backup?.maxBackupsPerType || 0;
      if (maxBackups <= 0) {
        return { success: true, deletedCount: 0 }; // 没有设置限制或限制为0，不执行清理
      }

      // 2. 确定要检查的文件夹路径
      const folderPath = type === BackupType.SETTINGS ? SETTINGS_FOLDER_PATH : 'bookmarks';
      
      // 3. 获取该类型的所有备份文件
      const files = await githubService.getRepositoryFiles(
        credentials,
        username,
        DEFAULT_BACKUP_REPO,
        folderPath
      );
      
      // 4. 根据备份类型过滤文件
      const filePrefix = type === BackupType.SETTINGS ? 'settings_backup_' : 'bookmarks_backup_';
      let backupFiles = files.filter(
        file => file.name.startsWith(filePrefix) && file.name.endsWith('.json')
      );
      
      // 如果文件数量没有超过限制，不需要清理
      if (backupFiles.length <= maxBackups) {
        console.log(`${type} 备份文件数量 (${backupFiles.length}) 未超过限制 (${maxBackups})`);
        return { success: true, deletedCount: 0 };
      }
      
      // 5. 解析文件名中的时间戳
      const parseTimestamp = (filename: string): number => {
        // 匹配文件名中的时间戳部分 (例如: xxx_backup_20230415123045.json)
        const match = filename.match(/_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
        if (match) {
          const [_, year, month, day, hour, minute, second] = match;
          return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
        }
        return 0;
      };
      
      // 6. 按时间戳排序（从新到旧）
      backupFiles = backupFiles.sort(
        (a, b) => parseTimestamp(b.name) - parseTimestamp(a.name)
      );
      
      // 7. 保留最新的 maxBackups 个文件，删除其余文件
      const filesToDelete = backupFiles.slice(maxBackups);
      console.log(`需要删除 ${filesToDelete.length} 个旧的 ${type} 备份文件`);
      
      let deletedCount = 0;
      for (const file of filesToDelete) {
        try {
          await githubService.deleteFile(
            credentials,
            username,
            DEFAULT_BACKUP_REPO,
            file.path,
            `自动清理旧的${type === BackupType.SETTINGS ? '设置' : '书签'}备份文件`,
            file.sha
          );
          deletedCount++;
          console.log(`已删除旧备份文件: ${file.path}`);
        } catch (deleteError) {
          console.error(`删除文件 ${file.path} 失败:`, deleteError);
          // 继续删除其他文件
        }
      }
      
      // 8. 更新备份统计信息（如果有删除操作）
      if (deletedCount > 0) {
        if (type === BackupType.BOOKMARKS) {
          // 强制刷新书签备份统计信息
          await this.getBackupStats(credentials, username, true);
        }
      }
      
      return { success: true, deletedCount };
    } catch (error) {
      console.error('清理旧备份文件失败:', error);
      return { 
        success: false, 
        deletedCount: 0,
        error: `清理失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default BackupService.getInstance(); 