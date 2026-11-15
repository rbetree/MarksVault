/**
 * 浏览器通知服务
 * 消费设置页的通知开关，负责书签变更、同步状态与备份提醒三类通知
 */

import { browser } from 'wxt/browser';
import storageService from '../utils/storage-service';
import type { UserSettings } from '../utils/storage-service';
import { ActionType, Task, TaskExecutionResult } from '../types/task';
import type { BackupStatus } from '../types/backup';

// 书签变更通知的合并窗口：批量操作通常在同一轮事件循环内产生大量事件
export const BOOKMARK_NOTIFICATION_WINDOW_MS = 5000;

// 备份提醒阈值与每日检查 alarm
export const BACKUP_REMINDER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_ALARM_NAME = 'marksvault-daily-backup-reminder';
export const BACKUP_REMINDER_ALARM_PERIOD_MINUTES = 24 * 60;
export const BACKUP_REMINDER_ALARM_DELAY_MINUTES = 1;
export const BACKUP_REMINDER_LAST_NOTIFIED_KEY = 'backup_reminder_last_notified';

// 与 WXT 生成的 PublicPath 类型保持一致；运行时解析到扩展根目录 assets 下
const NOTIFICATION_ICON_PATH = '/assets/icons/logo/icon128.png' as const;
const BOOKMARK_NOTIFICATION_ID = 'marksvault-bookmark-changes';
const SYNC_NOTIFICATION_ID = 'marksvault-sync-status';
const BACKUP_REMINDER_NOTIFICATION_ID = 'marksvault-backup-reminder';
const MAX_ERROR_MESSAGE_LENGTH = 120;

type NotificationSettings = UserSettings['notifications'];
type SyncNotificationTask = Pick<Task, 'name' | 'action'>;
type SyncNotificationResult = Pick<TaskExecutionResult, 'success' | 'error'>;

/**
 * 本地日期（YYYY-MM-DD）
 * 备份提醒按用户本地日历日去重，避免 UTC 日期在跨时区时提前/延后重置
 */
function formatLocalDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * 同步类任务的动作名称；非同步动作返回 null，不产生同步状态通知
 */
function getSyncActionLabel(task: SyncNotificationTask): string | null {
  switch (task.action.type) {
    case ActionType.BACKUP:
      return task.action.operation === 'restore' ? '恢复' : '备份';
    case ActionType.PUSH:
    case ActionType.SELECTIVE_PUSH:
      return '推送';
    default:
      return null;
  }
}

export class NotificationService {
  private bookmarkChangeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBookmarkChangeCount = 0;

  /**
   * 读取通知开关
   * 设置读取失败时返回 null，调用方应跳过本次通知
   */
  private async getNotificationSettings(): Promise<NotificationSettings | null> {
    const result = await storageService.getSettings();
    if (!result.success || !result.data) return null;
    return (result.data as UserSettings).notifications ?? null;
  }

  /**
   * 创建通知
   * 通知失败只记录日志，不影响触发通知的业务流程
   * @returns 是否创建成功
   */
  private async createNotification(
    notificationId: string,
    title: string,
    message: string,
  ): Promise<boolean> {
    try {
      await browser.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: browser.runtime.getURL(NOTIFICATION_ICON_PATH),
        title,
        message,
      });
      return true;
    } catch (error) {
      console.warn('创建浏览器通知失败:', error);
      return false;
    }
  }

  /**
   * 合并发送书签变更通知
   * 首个事件开启 5 秒窗口，窗口内的后续事件只累计数量，结束时合并为一条通知
   */
  async notifyBookmarkChanges(): Promise<void> {
    const settings = await this.getNotificationSettings();
    if (!settings?.bookmarkChanges) return;

    this.pendingBookmarkChangeCount += 1;
    if (this.bookmarkChangeTimer !== null) return;

    this.bookmarkChangeTimer = setTimeout(() => {
      void this.flushBookmarkChanges();
    }, BOOKMARK_NOTIFICATION_WINDOW_MS);
  }

  private async flushBookmarkChanges(): Promise<void> {
    this.bookmarkChangeTimer = null;
    const changeCount = this.pendingBookmarkChangeCount;
    this.pendingBookmarkChangeCount = 0;
    if (changeCount === 0) return;

    // 窗口期间用户可能关闭开关，发送前重新确认
    const settings = await this.getNotificationSettings();
    if (!settings?.bookmarkChanges) return;

    const message = changeCount > 1
      ? `本次共检测到 ${changeCount} 项书签变更`
      : '检测到 1 项书签变更';
    await this.createNotification(BOOKMARK_NOTIFICATION_ID, '书签已更新', message);
  }

  /**
   * 同步状态通知
   * 仅在备份/恢复/推送任务执行结束后调用，整理等其他任务不产生该通知
   */
  async notifySyncStatus(
    task: SyncNotificationTask,
    result: SyncNotificationResult,
  ): Promise<void> {
    const settings = await this.getNotificationSettings();
    if (!settings?.syncStatus) return;

    const actionLabel = getSyncActionLabel(task);
    if (!actionLabel) return;

    const taskName = task.name?.trim() || `书签${actionLabel}`;
    if (result.success) {
      await this.createNotification(
        SYNC_NOTIFICATION_ID,
        `书签${actionLabel}完成`,
        `任务「${taskName}」执行成功`,
      );
      return;
    }

    const errorText = result.error ? truncateText(result.error, MAX_ERROR_MESSAGE_LENGTH) : '';
    const message = errorText
      ? `任务「${taskName}」执行失败：${errorText}`
      : `任务「${taskName}」执行失败，请稍后重试`;
    await this.createNotification(
      SYNC_NOTIFICATION_ID,
      `书签${actionLabel}失败`,
      message,
    );
  }

  /**
   * 备份提醒
   * 读取书签备份状态键 backup_status，距上次成功备份超过 7 天时提醒；
   * 同一本地自然日最多提醒一次
   */
  async checkBackupReminder(): Promise<void> {
    const settings = await this.getNotificationSettings();
    if (!settings?.backupReminders) return;

    const statusResult = await storageService.getBackupStatus();
    if (!statusResult.success) return;

    const status = (statusResult.data ?? {}) as BackupStatus;
    const lastBackupTime = status.lastBackupTime;
    if (typeof lastBackupTime !== 'number' || !Number.isFinite(lastBackupTime)) {
      // 没有成功备份记录时不提醒：无法确定“上次成功备份”的时间点
      return;
    }

    const now = Date.now();
    const elapsed = now - lastBackupTime;
    if (elapsed <= BACKUP_REMINDER_MAX_AGE_MS) return;

    const today = formatLocalDate(now);
    const lastNotifiedResult = await storageService.getStorageData(
      BACKUP_REMINDER_LAST_NOTIFIED_KEY,
    );
    if (lastNotifiedResult.success && lastNotifiedResult.data === today) return;

    const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
    const created = await this.createNotification(
      BACKUP_REMINDER_NOTIFICATION_ID,
      '书签备份提醒',
      `距离上次成功备份已超过 ${days} 天，请及时备份书签。`,
    );

    if (created) {
      await storageService.setStorageData(BACKUP_REMINDER_LAST_NOTIFIED_KEY, today);
    }
  }

  /**
   * 确保每日备份检查 alarm 存在
   * 同名 alarm 会被覆盖，安装/启动时调用可同时修正周期
   */
  async ensureBackupReminderAlarm(): Promise<void> {
    try {
      await browser.alarms.create(BACKUP_REMINDER_ALARM_NAME, {
        delayInMinutes: BACKUP_REMINDER_ALARM_DELAY_MINUTES,
        periodInMinutes: BACKUP_REMINDER_ALARM_PERIOD_MINUTES,
      });
    } catch (error) {
      console.warn('创建备份提醒定时任务失败:', error);
    }
  }

  /**
   * 测试辅助：清空未发送的书签变更合并窗口
   */
  resetForTesting(): void {
    if (this.bookmarkChangeTimer !== null) {
      clearTimeout(this.bookmarkChangeTimer);
    }
    this.bookmarkChangeTimer = null;
    this.pendingBookmarkChangeCount = 0;
  }
}

const notificationService = new NotificationService();
export default notificationService;
