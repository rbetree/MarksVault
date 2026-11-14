import { BackupStatus, BookmarkBackup } from '../types/backup';
import { GitHubCredentials } from '../utils/storage-service';
import storageService from '../utils/storage-service';
import githubService from './github-service';
import { BOOKMARKS_FOLDER_PATH, DEFAULT_BACKUP_REPO } from './backup-service-config';
import { parseBookmarksBackupTimestamp } from './backup-service-paths';
import { listRepositoryFiles, readRepositoryFileContent } from './backup-service-github';

export interface BackupStats {
  totalBackups: number;
  firstBackupTime?: number;
  totalBookmarks?: number;
  totalFolders?: number;
  fileSize?: number;
  isFromCache?: boolean;
}

/**
 * 获取备份统计信息
 * @param credentials GitHub凭据
 * @param username GitHub用户名
 * @param forceRefresh 是否强制刷新（忽略缓存）
 * @returns 备份统计信息
 */
export async function getBackupStats(
  credentials: GitHubCredentials,
  username: string,
  forceRefresh: boolean = false
): Promise<BackupStats> {
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
    const files = await listRepositoryFiles(
      credentials,
      username,
      DEFAULT_BACKUP_REPO,
      BOOKMARKS_FOLDER_PATH
    );

    // 过滤并计算备份文件数量
    const backupFiles = files.filter(
      file => file.name.startsWith('bookmarks_backup_') && file.name.endsWith('.json')
    );

    // latest 是恢复回退文件，不计入备份数量，避免与清理口径不一致
    const totalBackups = backupFiles.filter(
      file => parseBookmarksBackupTimestamp(file.name) > 0
    ).length;

    if (totalBackups === 0) {
      return { totalBackups: 0 };
    }

    // 提取时间戳并排序
    const timestamps = backupFiles
      .map(file => parseBookmarksBackupTimestamp(file.name))
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
      .sort((a, b) => parseBookmarksBackupTimestamp(b.name) - parseBookmarksBackupTimestamp(a.name))[0];

    if (latestFile) {
      // 设置文件大小
      fileSize = latestFile.size;

      // 获取文件内容以提取详细信息
      try {
        const fileContent = await readRepositoryFileContent(
          credentials,
          username,
          DEFAULT_BACKUP_REPO,
          latestFile.path // 已经包含了bookmarks/前缀
        );

        const backupData = JSON.parse(fileContent) as BookmarkBackup;

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
export async function getBackupStatus(
  forceRefresh: boolean = false,
  updateCallback?: (updatedStatus: BackupStatus) => void
): Promise<BackupStatus> {
  try {
    // 获取基本状态信息
    const result = await storageService.getBackupStatus();
    const baseStatus = result.success ? result.data : {};

    // 非强制刷新：优先使用本地缓存的统计信息（避免每次打开都访问 GitHub）
    if (!forceRefresh) {
      const cacheResult = await storageService.getBackupStatsCache();
      if (
        cacheResult.success &&
        cacheResult.data &&
        storageService.isBackupStatsCacheValid(cacheResult.data) &&
        cacheResult.data.data
      ) {
        return {
          ...baseStatus,
          stats: {
            ...(cacheResult.data.data as any),
            isFromCache: true,
          },
        };
      }

      // 兼容：如果历史数据里已经存了 stats，则直接返回
      if (baseStatus.stats) {
        return baseStatus;
      }
    }

    // 无缓存（首次）或用户手动刷新：从 GitHub 拉取
    const fullStatus = await getFullBackupStatus(baseStatus, updateCallback, forceRefresh);

    // 将最新统计写回 backup_status，方便下次无缓存时仍可展示
    if (fullStatus.stats) {
      await storageService.saveBackupStatus({ stats: { ...fullStatus.stats, isFromCache: false } });
    }

    return fullStatus;
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
async function getFullBackupStatus(
  baseStatus: BackupStatus,
  updateCallback?: (updatedStatus: BackupStatus) => void,
  forceRefreshStats: boolean = false
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
    const stats = await getBackupStats(credentialsResult.data, userResult.login, forceRefreshStats);

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
