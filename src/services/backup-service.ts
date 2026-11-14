import { BackupResult, BackupStatus } from '../types/backup';
import { GitHubCredentials } from '../utils/storage-service';
import { BookmarkSelection } from '../types/task';
import { BackupType } from './backup-service-config';
import {
  backupToGitHub as backupToGitHubImpl,
  pushBookmarksToGitHub as pushBookmarksToGitHubImpl
} from './backup-service-backup';
import {
  restoreBookmarksFromGitHub,
  restoreSettingsFromGitHub
} from './backup-service-restore';
import {
  BackupStats,
  getBackupStats as getBackupStatsImpl,
  getBackupStatus as getBackupStatusImpl
} from './backup-service-stats';
import { getSettingsBackupStatus as getSettingsBackupStatusImpl } from './backup-service-settings';
import { cleanupOldBackups as cleanupOldBackupsImpl } from './backup-service-cleanup';
import { generateSelectiveHtml as generateSelectiveHtmlImpl } from './backup-service-html';

export { BackupType };

class BackupService {
  private static instance: BackupService;

  private constructor() { }

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
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
    return backupToGitHubImpl(credentials, username, type);
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
      return restoreSettingsFromGitHub(credentials, username, useTimestampedFile, timestampedFilePath);
    } else {
      return restoreBookmarksFromGitHub(credentials, username, useTimestampedFile, timestampedFilePath);
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
  ): Promise<BackupStats> {
    return getBackupStatsImpl(credentials, username, forceRefresh);
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
    return getBackupStatusImpl(forceRefresh, updateCallback);
  }

  /**
   * 获取配置备份状态（历史 key 为 settings_backup_status）
   * @param forceRefresh 是否强制刷新统计数据
   * @returns 配置备份状态信息
   */
  async getSettingsBackupStatus(
    forceRefresh: boolean = false
  ): Promise<BackupStatus> {
    return getSettingsBackupStatusImpl(forceRefresh);
  }

  /**
   * 根据选择的书签生成HTML
   * @param selections 用户选择的书签数组
   * @returns HTML字符串
   */
  async generateSelectiveHtml(selections: BookmarkSelection[]): Promise<string> {
    return generateSelectiveHtmlImpl(selections);
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
    return pushBookmarksToGitHubImpl(credentials, username, repoName, folderPath, commitMessage);
  }

  /**
   * 清理超出限制的旧备份文件
   * @param credentials GitHub凭据
   * @param username GitHub用户名
   * @param type 备份类型 (书签或配置)
   * @returns 清理结果
   */
  async cleanupOldBackups(
    credentials: GitHubCredentials,
    username: string,
    type: BackupType = BackupType.BOOKMARKS
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    return cleanupOldBackupsImpl(credentials, username, type);
  }
}

export default BackupService.getInstance();
