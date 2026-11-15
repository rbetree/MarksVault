import { GitHubCredentials } from '../utils/storage-service';
import githubService, { GitHubApiError } from './github-service';
import {
  BOOKMARKS_FOLDER_PATH,
  BackupType,
  DEFAULT_BACKUP_REPO,
  LATEST_BACKUP_PATH,
  SETTINGS_FOLDER_PATH
} from './backup-service-config';

/**
 * 解析书签备份文件名中的时间戳（bookmarks_backup_YYYYMMDDHHMMSS.json）
 */
export function parseBookmarksBackupTimestamp(filename: string): number {
  const match = filename.match(/bookmarks_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
  if (!match) return 0;

  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
  // 正则匹配但日期越界（如 13 月）时为 NaN，按最旧处理，避免污染排序
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * 是否为“带时间戳”的书签备份文件
 */
export function isTimestampedBookmarksBackupFile(filename: string): boolean {
  return parseBookmarksBackupTimestamp(filename) > 0;
}

/**
 * 解析“最新书签备份文件路径”
 * 优先选择时间戳备份文件；若不存在，回退到历史的 latest 文件名。
 */
export async function resolveLatestBookmarksBackupFilePath(
  credentials: GitHubCredentials,
  username: string
): Promise<string> {
  let files: Awaited<ReturnType<typeof githubService.getRepositoryFiles>>;
  try {
    files = await githubService.getRepositoryFiles(
      credentials,
      username,
      DEFAULT_BACKUP_REPO,
      BOOKMARKS_FOLDER_PATH
    );
  } catch (error) {
    // 仓库或 bookmarks/ 目录不存在时 GitHub 返回 404：这是“没有可恢复备份”，
    // 不是文件列表读取失败，避免用户看到误导性的网络/权限错误
    if (error instanceof GitHubApiError && error.status === 404) {
      throw new Error('未找到可恢复的书签备份文件，请先进行备份');
    }
    throw error;
  }

  const timestampedFiles = files.filter(file => isTimestampedBookmarksBackupFile(file.name));
  if (timestampedFiles.length > 0) {
    return timestampedFiles.sort(
      (a, b) => parseBookmarksBackupTimestamp(b.name) - parseBookmarksBackupTimestamp(a.name)
    )[0].path;
  }

  // 兼容历史逻辑：若仓库中存在 latest 文件，仍支持恢复。
  const latestFile = files.find(file => file.name === LATEST_BACKUP_PATH);
  if (latestFile) {
    return latestFile.path;
  }

  throw new Error('未找到可恢复的书签备份文件，请先进行备份');
}

/**
 * 解析配置备份文件名中的时间戳
 */
export function parseSettingsBackupTimestamp(filename: string): number {
  const match = filename.match(/settings_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
  if (!match) return 0;

  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
  // 正则匹配但日期越界（如 13 月）时为 NaN，按最旧处理，避免污染排序
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function parseBackupTimestamp(filename: string): number {
  // 匹配文件名中的时间戳部分 (例如: xxx_backup_20230415123045.json)
  const match = filename.match(/_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
  if (!match) return 0;

  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
  // 正则匹配但日期越界（如 13 月）时为 NaN，按最旧处理，避免污染排序
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function buildTimestampedBackupFilePath(
  type: BackupType,
  now: Date
): { filePath: string; description: string } {
  const folderPath = type === BackupType.SETTINGS ? SETTINGS_FOLDER_PATH : BOOKMARKS_FOLDER_PATH;
  const description = type === BackupType.SETTINGS ? '配置' : '书签';

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const fileName = `${type}_backup_${timestamp}.json`;
  return { filePath: `${folderPath}/${fileName}`, description };
}

export function buildPushFilePath(folderPath: string, now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const dateString = `${year}${month}${day}`;
  const fileName = `bookmarks_${dateString}.html`;
  return folderPath ? `${folderPath}/${fileName}` : fileName;
}

export function resolveSettingsRestoreFilePath(timestampedFilePath: string): string {
  return timestampedFilePath.startsWith(`${SETTINGS_FOLDER_PATH}/`)
    ? timestampedFilePath
    : `${SETTINGS_FOLDER_PATH}/${timestampedFilePath}`;
}

export function resolveBookmarksRestoreFilePath(timestampedFilePath: string): string {
  return timestampedFilePath.startsWith(`${BOOKMARKS_FOLDER_PATH}/`)
    ? timestampedFilePath
    : `${BOOKMARKS_FOLDER_PATH}/${timestampedFilePath}`;
}
