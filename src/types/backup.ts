import { BookmarkItem } from '../utils/bookmark-service';

/**
 * 书签备份数据结构
 */
export interface BookmarkBackup {
  /** 备份版本号 */
  version: string;
  /** 备份创建时间戳 */
  timestamp: number;
  /** 备份设备/来源信息 */
  source: string;
  /** 书签树 */
  bookmarks: BookmarkItem[];
  /** 备份元数据 */
  metadata?: {
    /** 总书签数量 */
    totalBookmarks: number;
    /** 总文件夹数量 */
    totalFolders: number;
    /** 其他可能的元数据 */
    [key: string]: any;
  };
}

/**
 * 备份操作结果
 */
export interface BackupResult {
  /** 操作是否成功 */
  success: boolean;
  /** 返回的数据(如果有) */
  data?: any;
  /** 错误信息(如果有) */
  error?: string;
  /** 时间戳 */
  timestamp?: number;
}

/**
 * 备份状态信息
 */
export interface BackupStatus {
  /** 最后备份时间 */
  lastBackupTime?: number;
  /** 最后恢复时间 */
  lastRestoreTime?: number;
  /** 备份文件URL */
  backupFileUrl?: string;
  /** 最后备份的文件路径 */
  lastBackupFilePath?: string;
  /** 最后操作状态 */
  lastOperationStatus?: 'success' | 'failed';
  /** 错误信息 */
  errorMessage?: string;
} 