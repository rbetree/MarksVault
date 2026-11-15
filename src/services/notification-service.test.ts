const mockNotificationCreate = jest.fn();
const mockAlarmCreate = jest.fn();
const mockGetURL = jest.fn((path: string) => `chrome-extension://__jest__${path}`);

jest.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: mockGetURL,
    },
    notifications: {
      create: mockNotificationCreate,
    },
    alarms: {
      create: mockAlarmCreate,
    },
  },
}));

jest.mock('../utils/storage-service', () => ({
  __esModule: true,
  default: {
    getSettings: jest.fn(),
    getBackupStatus: jest.fn(),
    getStorageData: jest.fn(),
    setStorageData: jest.fn(),
  },
}));

import notificationService, {
  BACKUP_REMINDER_ALARM_DELAY_MINUTES,
  BACKUP_REMINDER_ALARM_NAME,
  BACKUP_REMINDER_ALARM_PERIOD_MINUTES,
  BACKUP_REMINDER_LAST_NOTIFIED_KEY,
  BOOKMARK_NOTIFICATION_WINDOW_MS,
} from './notification-service';
import storageService from '../utils/storage-service';
import { ActionType } from '../types/task';

const mockedStorage = storageService as jest.Mocked<typeof storageService>;
const mockedCreate = mockNotificationCreate as jest.Mock;
const mockedAlarmCreate = mockAlarmCreate as jest.Mock;

const DAY_MS = 24 * 60 * 60 * 1000;

type NotificationSwitches = {
  bookmarkChanges: boolean;
  syncStatus: boolean;
  backupReminders: boolean;
};

const mockSettings = (overrides: Partial<NotificationSwitches> = {}): void => {
  mockedStorage.getSettings.mockResolvedValue({
    success: true,
    data: {
      syncEnabled: false,
      viewType: 'grid',
      notifications: {
        bookmarkChanges: true,
        syncStatus: true,
        backupReminders: true,
        ...overrides,
      },
    },
  } as any);
};

const createSyncTask = (
  type: ActionType,
  options: {
    operation?: 'backup' | 'restore';
    name?: string;
  } = {},
) => {
  return {
    name: options.name ?? '测试同步任务',
    action: {
      type,
      operation: options.operation,
    },
  } as any;
};

describe('notification-service', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 固定本地时间，便于验证“同一自然日”去重与 7 天边界
    jest.setSystemTime(new Date(2026, 10, 15, 10, 0, 0));
    notificationService.resetForTesting();
    jest.clearAllMocks();

    mockGetURL.mockImplementation((path: string) => `chrome-extension://__jest__${path}`);
    mockedCreate.mockResolvedValue('notification-id');
    mockedAlarmCreate.mockResolvedValue(undefined);
    mockSettings();
    mockedStorage.getBackupStatus.mockResolvedValue({ success: true, data: {} });
    mockedStorage.getStorageData.mockResolvedValue({ success: true, data: null });
    mockedStorage.setStorageData.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    notificationService.resetForTesting();
    jest.useRealTimers();
  });

  describe('通知开关', () => {
    test('书签变更开关关闭时不创建通知', async () => {
      mockSettings({ bookmarkChanges: false });

      await notificationService.notifyBookmarkChanges();
      await notificationService.notifyBookmarkChanges();
      await jest.advanceTimersByTimeAsync(BOOKMARK_NOTIFICATION_WINDOW_MS);

      expect(mockedCreate).not.toHaveBeenCalled();
    });

    test('同步状态开关关闭时不创建通知', async () => {
      mockSettings({ syncStatus: false });

      await notificationService.notifySyncStatus(
        createSyncTask(ActionType.BACKUP, { operation: 'backup' }),
        { success: false, error: '上传失败' },
      );

      expect(mockedCreate).not.toHaveBeenCalled();
    });

    test('备份提醒开关关闭时不创建通知', async () => {
      mockSettings({ backupReminders: false });
      mockedStorage.getBackupStatus.mockResolvedValue({
        success: true,
        data: { lastBackupTime: Date.now() - 10 * DAY_MS },
      });

      await notificationService.checkBackupReminder();

      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });

  describe('书签变更通知', () => {
    test('5 秒窗口内的多次变更合并为一条通知', async () => {
      await notificationService.notifyBookmarkChanges();
      await notificationService.notifyBookmarkChanges();
      await notificationService.notifyBookmarkChanges();

      await jest.advanceTimersByTimeAsync(BOOKMARK_NOTIFICATION_WINDOW_MS - 1);
      expect(mockedCreate).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(mockedCreate).toHaveBeenCalledTimes(1);
      expect(mockedCreate).toHaveBeenCalledWith(
        'marksvault-bookmark-changes',
        expect.objectContaining({
          type: 'basic',
          iconUrl: 'chrome-extension://__jest__/assets/icons/logo/icon128.png',
          title: '书签已更新',
          message: '本次共检测到 3 项书签变更',
        }),
      );
    });

    test('窗口结束后的新变更进入下一窗口，不会无限合并', async () => {
      await notificationService.notifyBookmarkChanges();
      await jest.advanceTimersByTimeAsync(BOOKMARK_NOTIFICATION_WINDOW_MS);
      expect(mockedCreate).toHaveBeenCalledTimes(1);

      await notificationService.notifyBookmarkChanges();
      await jest.advanceTimersByTimeAsync(BOOKMARK_NOTIFICATION_WINDOW_MS);

      expect(mockedCreate).toHaveBeenCalledTimes(2);
      expect(mockedCreate.mock.calls[1][1].message).toBe('检测到 1 项书签变更');
    });
  });

  describe('同步状态通知', () => {
    test('备份成功时通知成功结果', async () => {
      await notificationService.notifySyncStatus(
        createSyncTask(ActionType.BACKUP, { operation: 'backup', name: '每日备份' }),
        { success: true },
      );

      expect(mockedCreate).toHaveBeenCalledTimes(1);
      expect(mockedCreate).toHaveBeenCalledWith(
        'marksvault-sync-status',
        expect.objectContaining({
          title: '书签备份完成',
          message: '任务「每日备份」执行成功',
          iconUrl: 'chrome-extension://__jest__/assets/icons/logo/icon128.png',
        }),
      );
    });

    test('恢复失败时通知失败结果与错误原因', async () => {
      await notificationService.notifySyncStatus(
        createSyncTask(ActionType.BACKUP, { operation: 'restore', name: '恢复书签' }),
        { success: false, error: '未找到可恢复的备份文件' },
      );

      expect(mockedCreate).toHaveBeenCalledTimes(1);
      const options = mockedCreate.mock.calls[0][1];
      expect(options.title).toBe('书签恢复失败');
      expect(options.message).toContain('任务「恢复书签」执行失败');
      expect(options.message).toContain('未找到可恢复的备份文件');
    });

    test('推送成功时通知推送结果', async () => {
      await notificationService.notifySyncStatus(
        createSyncTask(ActionType.PUSH, { name: '推送书签' }),
        { success: true },
      );

      expect(mockedCreate).toHaveBeenCalledWith(
        'marksvault-sync-status',
        expect.objectContaining({
          title: '书签推送完成',
          message: '任务「推送书签」执行成功',
        }),
      );
    });

    test('整理任务不产生同步状态通知', async () => {
      await notificationService.notifySyncStatus(
        createSyncTask(ActionType.ORGANIZE),
        { success: true },
      );

      expect(mockedCreate).not.toHaveBeenCalled();
    });
  });

  describe('备份提醒', () => {
    test('恰好 7 天不提醒，超过 7 天才提醒', async () => {
      const now = Date.now();

      mockedStorage.getBackupStatus.mockResolvedValue({
        success: true,
        data: { lastBackupTime: now - 7 * DAY_MS },
      });
      await notificationService.checkBackupReminder();
      expect(mockedCreate).not.toHaveBeenCalled();

      mockedStorage.getBackupStatus.mockResolvedValue({
        success: true,
        data: { lastBackupTime: now - 7 * DAY_MS - 1 },
      });
      await notificationService.checkBackupReminder();

      expect(mockedCreate).toHaveBeenCalledTimes(1);
      expect(mockedCreate).toHaveBeenCalledWith(
        'marksvault-backup-reminder',
        expect.objectContaining({
          title: '书签备份提醒',
          message: '距离上次成功备份已超过 7 天，请及时备份书签。',
        }),
      );
      expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
        BACKUP_REMINDER_LAST_NOTIFIED_KEY,
        '2026-11-15',
      );
    });

    test('同一自然日最多提醒一次，次日可再次提醒', async () => {
      mockedStorage.getBackupStatus.mockResolvedValue({
        success: true,
        data: { lastBackupTime: Date.now() - 8 * DAY_MS },
      });

      await notificationService.checkBackupReminder();
      expect(mockedCreate).toHaveBeenCalledTimes(1);

      // 同一天稍晚再次检查：读取到当天已提醒标记
      jest.setSystemTime(new Date(2026, 10, 15, 18, 0, 0));
      mockedStorage.getStorageData.mockResolvedValue({ success: true, data: '2026-11-15' });
      await notificationService.checkBackupReminder();
      expect(mockedCreate).toHaveBeenCalledTimes(1);

      // 次日检查：日期标记不再匹配
      jest.setSystemTime(new Date(2026, 10, 16, 9, 0, 0));
      await notificationService.checkBackupReminder();
      expect(mockedCreate).toHaveBeenCalledTimes(2);
    });

    test('没有成功备份记录时不提醒', async () => {
      mockedStorage.getBackupStatus.mockResolvedValue({
        success: true,
        data: { lastOperationStatus: 'failed' },
      });

      await notificationService.checkBackupReminder();

      expect(mockedCreate).not.toHaveBeenCalled();
    });

    test('通知创建失败时不写入当日已提醒标记', async () => {
      mockedStorage.getBackupStatus.mockResolvedValue({
        success: true,
        data: { lastBackupTime: Date.now() - 10 * DAY_MS },
      });
      mockedCreate.mockRejectedValueOnce(new Error('notifications denied'));

      await notificationService.checkBackupReminder();

      expect(mockedStorage.setStorageData).not.toHaveBeenCalled();
    });
  });

  describe('备份提醒定时任务', () => {
    test('确保每日 alarm 存在且周期为一天', async () => {
      await notificationService.ensureBackupReminderAlarm();

      expect(mockedAlarmCreate).toHaveBeenCalledWith(BACKUP_REMINDER_ALARM_NAME, {
        delayInMinutes: BACKUP_REMINDER_ALARM_DELAY_MINUTES,
        periodInMinutes: BACKUP_REMINDER_ALARM_PERIOD_MINUTES,
      });
    });
  });
});
