// 备份存储库名称
export const DEFAULT_BACKUP_REPO = 'marksvault-backups';
// 备份文件路径：最新文件和带时间戳的历史文件
export const LATEST_BACKUP_PATH = 'bookmarks_backup_latest.json';
// 设置文件备份文件夹路径
export const SETTINGS_FOLDER_PATH = 'settings';
// 书签备份文件夹路径
export const BOOKMARKS_FOLDER_PATH = 'bookmarks';
// 备份类型常量
export enum BackupType {
  BOOKMARKS = 'bookmarks',
  SETTINGS = 'settings'
}
