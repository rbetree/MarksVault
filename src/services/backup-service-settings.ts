import { BackupStatus } from '../types/backup';
import storageService from '../utils/storage-service';
import { BackupType } from './backup-service-config';

/**
 * 创建“配置备份”数据
 * 说明：历史上该类型名为 SETTINGS，但目前用于备份/恢复扩展的完整配置快照（local + sync）。
 */
export async function createSettingsBackupData(): Promise<any> {
  // 复用本地“配置导入导出”的序列化逻辑，确保本地文件与 GitHub 备份格式一致
  const exportResult = await storageService.exportConfig({
    includeGitHubCredentials: false,
    includeLocalStorage: false
  });
  if (!exportResult.success || !exportResult.data) {
    throw new Error(`导出配置失败: ${exportResult.error || '未知错误'}`);
  }

  return exportResult.data;
}

export async function saveBackupStatusForType(
  type: BackupType,
  status: BackupStatus
): Promise<void> {
  if (type === BackupType.SETTINGS) {
    // 配置备份状态存储在另一个键中，避免与书签备份状态混淆。
    // 与书签状态一样合并写入：失败状态只带 lastOperationStatus/errorMessage，
    // 整键覆盖会抹掉上次成功的 lastBackupTime/backupFileUrl
    const currentResult = await storageService.getStorageData('settings_backup_status');
    if (!currentResult.success) {
      // 无法读取旧状态时不写入，避免用不完整状态覆盖上次成功记录
      console.error('读取配置备份状态失败，跳过状态写入:', currentResult.error);
      return;
    }
    const currentStatus = currentResult.data && typeof currentResult.data === 'object'
      ? currentResult.data as BackupStatus
      : {};
    await storageService.setStorageData('settings_backup_status', {
      ...currentStatus,
      ...status,
    });
  } else {
    await storageService.saveBackupStatus(status);
  }
}

/**
 * 获取配置备份状态（历史 key 为 settings_backup_status）
 * @param forceRefresh 是否强制刷新统计数据
 * @returns 配置备份状态信息
 */
export async function getSettingsBackupStatus(
  forceRefresh: boolean = false
): Promise<BackupStatus> {
  try {
    // 获取基本状态信息
    const result = await storageService.getStorageData('settings_backup_status');
    const status = result.success ? result.data : {};

    if (forceRefresh) {
      // 在这里可以添加获取更多配置备份统计信息的逻辑，类似于书签备份的getFullBackupStatus方法
      // 例如获取配置备份的总数量、最新备份的大小等
    }

    return status;
  } catch (error) {
    console.error('获取配置备份状态失败:', error);
    return {};
  }
}
