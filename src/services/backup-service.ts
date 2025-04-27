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
   * 获取备份状态
   * @returns 备份状态信息
   */
  async getBackupStatus(): Promise<BackupStatus> {
    const result = await storageService.getBackupStatus();
    return result.success ? result.data : {};
  }
}

export default BackupService.getInstance(); 