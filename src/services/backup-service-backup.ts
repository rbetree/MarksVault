import { BackupResult, BackupStatus } from '../types/backup';
import { GitHubCredentials } from '../utils/storage-service';
import storageService from '../utils/storage-service';
import { isRetryableGitHubError } from './github-service';
import { BackupType, DEFAULT_BACKUP_REPO } from './backup-service-config';
import { buildPushFilePath, buildTimestampedBackupFilePath } from './backup-service-paths';
import { ensureRepositoryExists, writeRepositoryFile } from './backup-service-github';
import { createBookmarkBackupData } from './backup-service-bookmark-data';
import { createSettingsBackupData, saveBackupStatusForType } from './backup-service-settings';
import { createHtmlBookmarkData } from './backup-service-html';
import { cleanupOldBackups } from './backup-service-cleanup';

/**
 * 备份到GitHub
 * @param credentials GitHub认证凭据
 * @param username GitHub用户名
 * @param type 备份类型 (bookmarks 或 settings)
 * @returns 备份结果
 */
export async function backupToGitHub(
  credentials: GitHubCredentials,
  username: string,
  type: BackupType = BackupType.BOOKMARKS
): Promise<BackupResult> {
  try {
    // 1. 创建备份数据 (根据类型)
    const backupData = type === BackupType.SETTINGS
      ? await createSettingsBackupData()
      : await createBookmarkBackupData();

    // 2. 确保存储库存在
    await ensureRepositoryExists(credentials, username, DEFAULT_BACKUP_REPO, {
      existedLog: '仓库已存在，使用现有仓库',
      createFailedLog: '创建仓库失败，再次检查仓库是否存在:',
      recheckedExistsLog: '仓库已存在，继续备份流程'
    });

    // 3. 序列化数据
    const backupContent = JSON.stringify(backupData, null, 2);

    // 4. 生成带详细时间戳的文件路径
    const now = new Date();
    const { filePath: backupFilePath, description: backupDescription } =
      buildTimestampedBackupFilePath(type, now);

    // GitHub API对于不存在的目录会自动创建
    // 但我们可以先检查目录是否存在于仓库中
    // 5. 上传新备份文件
    console.log(`开始上传备份文件: ${backupFilePath}`);
    try {
      const uploadResult = await writeRepositoryFile(
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

      await saveBackupStatusForType(type, backupStatus);

      // 清理超出限制的旧备份文件
      try {
        const cleanupResult = await cleanupOldBackups(
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

      await saveBackupStatusForType(type, backupStatus);

      return {
        success: false,
        // 结构化可重试性标记：网络/限流等临时性失败可重试，凭据/配置等错误不可重试
        retryable: isRetryableGitHubError(uploadError),
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

    await saveBackupStatusForType(type, backupStatus);

    return {
      success: false,
      retryable: isRetryableGitHubError(error),
      error: `备份失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
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
export async function pushBookmarksToGitHub(
  credentials: GitHubCredentials,
  username: string,
  repoName: string = 'menav',
  folderPath: string = 'bookmarks',
  commitMessage: string = '自动推送书签'
): Promise<BackupResult> {
  try {
    // 1. 创建HTML格式的书签数据
    const htmlBookmarkData = await createHtmlBookmarkData();

    // 2. 确保存储库存在
    await ensureRepositoryExists(credentials, username, repoName, {
      existedLog: '目标仓库已存在，使用现有仓库',
      createFailedLog: '创建目标仓库失败，再次检查仓库是否存在:',
      recheckedExistsLog: '目标仓库已存在，继续推送流程'
    });

    // 3. 生成文件名 (格式: bookmarks_YYYYMMDD.html)
    const now = new Date();
    const filePath = buildPushFilePath(folderPath, now);

    // 4. 上传HTML书签文件
    const uploadResult = await writeRepositoryFile(
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
      retryable: isRetryableGitHubError(error),
      error: `推送失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
