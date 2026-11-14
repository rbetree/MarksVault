import { BookmarkBackup, BackupResult, BackupStatus } from '../types/backup';
import { BookmarkItem, findBookmarkBar } from '../utils/bookmark-service';
import bookmarkService from '../utils/bookmark-service';
import storageService from '../utils/storage-service';
import { GitHubCredentials } from '../utils/storage-service';
import { GitHubApiError, RetryableError, isRetryableGitHubError } from './github-service';
import { BackupType, DEFAULT_BACKUP_REPO, SETTINGS_FOLDER_PATH } from './backup-service-config';
import {
  parseSettingsBackupTimestamp,
  resolveBookmarksRestoreFilePath,
  resolveLatestBookmarksBackupFilePath,
  resolveSettingsRestoreFilePath
} from './backup-service-paths';
import {
  listRepositoryFiles,
  readRepositoryFileContent,
  repositoryExists
} from './backup-service-github';
import {
  replaceBookmarkBarContents,
  selectBookmarksToRestore,
  stashCurrentBookmarkBar,
  validateBackupTreeForRestore
} from './backup-service-bookmark-data';
import { saveBackupStatusForType } from './backup-service-settings';

/**
 * 从GitHub恢复配置（历史类型名为 SETTINGS）
 * @param credentials GitHub认证凭据
 * @param username GitHub用户名
 * @param useTimestampedFile 是否使用带时间戳的文件
 * @param timestampedFilePath 带时间戳的文件路径
 * @returns 恢复结果
 */
export async function restoreSettingsFromGitHub(
  credentials: GitHubCredentials,
  username: string,
  useTimestampedFile: boolean = false,
  timestampedFilePath?: string
): Promise<BackupResult> {
  try {
    // 1. 确保存储库存在
    const repoExists = await repositoryExists(credentials, username, DEFAULT_BACKUP_REPO);
    if (!repoExists) {
      throw new Error('备份存储库不存在，请先进行备份');
    }

    let filePath: string;

    if (useTimestampedFile && timestampedFilePath) {
      // 如果指定了时间戳文件，使用指定的文件
      filePath = resolveSettingsRestoreFilePath(timestampedFilePath);
    } else {
      // 否则，获取配置备份文件夹中的所有文件，找到最新的备份文件
      console.log(`尝试获取目录内容: ${SETTINGS_FOLDER_PATH}`);
      let files: Awaited<ReturnType<typeof listRepositoryFiles>>;
      try {
        files = await listRepositoryFiles(
          credentials,
          username,
          DEFAULT_BACKUP_REPO,
          SETTINGS_FOLDER_PATH
        );
      } catch (error) {
        console.error('获取仓库文件列表失败:', error);
        // 网络/限流等临时性失败保留结构化分类，供上层判定可重试性
        if (error instanceof RetryableError || error instanceof GitHubApiError) {
          throw error;
        }
        throw new Error(`获取仓库文件列表失败: ${error instanceof Error ? error.message : String(error)}`);
      }

      console.log(`获取到${files.length}个文件:`, files.map(f => f.name).join(', '));

      // 过滤获取所有配置备份文件（历史命名为 settings_backup_）
      const settingsBackupFiles = files.filter(
        file => file.name.startsWith('settings_backup_') && file.name.endsWith('.json')
      );

      console.log(`找到${settingsBackupFiles.length}个配置备份文件`);

      if (settingsBackupFiles.length === 0) {
        throw new Error('未找到配置备份文件，请先进行备份');
      }

      // 按时间戳降序排序文件，取第一个（最新的）
      const latestFile = settingsBackupFiles
        .sort((a, b) => parseSettingsBackupTimestamp(b.name) - parseSettingsBackupTimestamp(a.name))[0];

      filePath = latestFile.path;
      console.log(`选择最新的配置备份文件: ${filePath}`);
    }

    // 2. 获取备份文件内容
    console.log('尝试获取配置备份文件:', filePath);
    const fileContent = await readRepositoryFileContent(
      credentials,
      username,
      DEFAULT_BACKUP_REPO,
      filePath
    );

    // 3. 解析备份数据
    const backupData = JSON.parse(fileContent);

    // 4. 兼容两种格式：
    // - 新版：配置快照（schemaVersion/app/local...），复用 storageService.importConfig
    // - 旧版：仅 settings（backupData.settings），保持兼容
    const looksLikeConfig = backupData
      && typeof backupData === 'object'
      && backupData.schemaVersion === 1
      && backupData.app === 'MarksVault'
      && backupData.local
      && typeof backupData.local === 'object';

    if (looksLikeConfig) {
      const result = await storageService.importConfig(backupData, { importLocalStorage: false });
      if (!result.success) {
        throw new Error(`导入配置失败: ${result.error}`);
      }
    } else if (backupData.settings && typeof backupData.settings === 'object') {
      const result = await storageService.saveSettings(backupData.settings);
      if (!result.success) {
        throw new Error(`保存设置失败: ${result.error}`);
      }
    } else {
      throw new Error('备份文件格式不正确');
    }

    // 6. 保存恢复状态
    const now = new Date();
    const restoreStatus: BackupStatus = {
      lastRestoreTime: now.getTime(),
      lastOperationStatus: 'success'
    };

    await saveBackupStatusForType(BackupType.SETTINGS, restoreStatus);

    // 7. 返回成功结果
    return {
      success: true,
      data: {
        timestamp: typeof backupData?.timestamp === 'number'
          ? backupData.timestamp
          : Date.now(),
        filePath
      },
      timestamp: typeof backupData?.timestamp === 'number'
        ? backupData.timestamp
        : undefined
    };
  } catch (error) {
    console.error('配置恢复失败:', error);

    // 保存失败状态
    const restoreStatus: BackupStatus = {
      lastOperationStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error)
    };

    await saveBackupStatusForType(BackupType.SETTINGS, restoreStatus);

    return {
      success: false,
      retryable: isRetryableGitHubError(error),
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
export async function restoreBookmarksFromGitHub(
  credentials: GitHubCredentials,
  username: string,
  useTimestampedFile: boolean = false,
  timestampedFilePath?: string
): Promise<BackupResult> {
  try {
    // 1. 确保存储库存在
    const repoExists = await repositoryExists(credentials, username, DEFAULT_BACKUP_REPO);
    if (!repoExists) {
      throw new Error('备份存储库不存在，请先进行备份');
    }

    // 2. 获取备份文件内容
    const filePath = useTimestampedFile && timestampedFilePath
      ? resolveBookmarksRestoreFilePath(timestampedFilePath)
      : await resolveLatestBookmarksBackupFilePath(credentials, username);

    const fileContent = await readRepositoryFileContent(
      credentials,
      username,
      DEFAULT_BACKUP_REPO,
      filePath
    );

    // 3. 解析备份数据
    const backupData = JSON.parse(fileContent) as BookmarkBackup;

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

    // 兼容 Chrome/Edge/Firefox：按 ID + 标题双策略识别书签栏。
    const bookmarkBar = findBookmarkBar(roots);
    if (!bookmarkBar) {
      throw new Error('找不到书签栏，无法恢复书签');
    }

    console.log('找到书签栏:', bookmarkBar.id, bookmarkBar.title);

    // 5.2 准备要恢复的书签数据
    // 从备份中查找合适的书签数据
    const bookmarksToRestore = selectBookmarksToRestore(backupData.bookmarks);

    if (bookmarksToRestore.length === 0) {
      throw new Error('备份数据中找不到可恢复的书签');
    }

    console.log(`准备恢复 ${bookmarksToRestore.length} 个书签项`);

    // 5.3 前置校验备份数据（必须在任何删除操作之前执行）
    validateBackupTreeForRestore(bookmarksToRestore);

    // 5.4 删除前暂存现有书签树（序列化后持久化到 storage.local）
    await stashCurrentBookmarkBar(bookmarkBar);

    // 5.5 递归删除现有书签
    const existingBookmarks = bookmarkBar.children || [];
    console.log(`当前有 ${existingBookmarks.length} 个书签项将被清除`);

    // 5.6/5.7 递归删除并创建新书签
    await replaceBookmarkBarContents(bookmarkBar, bookmarksToRestore);

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

    // 注意：此处刻意不清理 pending_restore_backup 暂存数据。
    // 恢复失败时该数据保留在 storage.local，作为数据保底供未来回滚入口使用。
    // 仅当恢复全部成功（5.8）时才删除。

    // 保存失败状态
    const backupStatus: BackupStatus = {
      lastOperationStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error)
    };

    await storageService.saveBackupStatus(backupStatus);

    return {
      success: false,
      retryable: isRetryableGitHubError(error),
      error: `恢复失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
