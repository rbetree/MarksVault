import { GitHubCredentials } from '../utils/storage-service';
import storageService from '../utils/storage-service';
import {
  BOOKMARKS_FOLDER_PATH,
  BackupType,
  DEFAULT_BACKUP_REPO,
  LATEST_BACKUP_PATH,
  SETTINGS_FOLDER_PATH
} from './backup-service-config';
import { parseBackupTimestamp } from './backup-service-paths';
import { deleteRepositoryFile, listRepositoryFiles } from './backup-service-github';
import { getBackupStats } from './backup-service-stats';

/**
 * 清理超出限制的旧备份文件
 * @param credentials GitHub凭据
 * @param username GitHub用户名
 * @param type 备份类型 (书签或配置)
 * @returns 清理结果
 */
export async function cleanupOldBackups(
  credentials: GitHubCredentials,
  username: string,
  type: BackupType = BackupType.BOOKMARKS
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
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
    const folderPath = type === BackupType.SETTINGS ? SETTINGS_FOLDER_PATH : BOOKMARKS_FOLDER_PATH;

    // 3. 获取该类型的所有备份文件
    const files = await listRepositoryFiles(
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

    // latest 是恢复时的回退文件，不参与数量限制与删除，避免仅剩回退被清掉
    if (type === BackupType.BOOKMARKS) {
      backupFiles = backupFiles.filter(file => file.name !== LATEST_BACKUP_PATH);
    }

    // 如果文件数量没有超过限制，不需要清理
    if (backupFiles.length <= maxBackups) {
      console.log(`${type} 备份文件数量 (${backupFiles.length}) 未超过限制 (${maxBackups})`);
      return { success: true, deletedCount: 0 };
    }

    // 5. 按时间戳排序（从新到旧）
    backupFiles = backupFiles.sort(
      (a, b) => parseBackupTimestamp(b.name) - parseBackupTimestamp(a.name)
    );

    // 6. 保留最新的 maxBackups 个文件，删除其余文件
    const filesToDelete = backupFiles.slice(maxBackups);
    console.log(`需要删除 ${filesToDelete.length} 个旧的 ${type} 备份文件`);

    let deletedCount = 0;
    for (const file of filesToDelete) {
      try {
        await deleteRepositoryFile(
          credentials,
          username,
          DEFAULT_BACKUP_REPO,
          file.path,
          `自动清理旧的${type === BackupType.SETTINGS ? '配置' : '书签'}备份文件`,
          file.sha
        );
        deletedCount++;
        console.log(`已删除旧备份文件: ${file.path}`);
      } catch (deleteError) {
        console.error(`删除文件 ${file.path} 失败:`, deleteError);
        // 继续删除其他文件
      }
    }

    // 7. 更新备份统计信息（如果有删除操作）
    if (deletedCount > 0) {
      if (type === BackupType.BOOKMARKS) {
        // 强制刷新书签备份统计信息
        await getBackupStats(credentials, username, true);
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
