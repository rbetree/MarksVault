jest.mock('wxt/utils/define-background', () => ({
  defineBackground: (config: unknown) => config,
}));

let onMessageListener: ((message: any, sender: any, sendResponse: any) => any) | null = null;
let onInstalledListener: ((details: any) => any) | null = null;
let onStartupListener: (() => any) | null = null;
let onAlarmListener: ((alarm: any) => any) | null = null;
let onBookmarkCreatedListener: ((id: string, bookmark: any) => any) | null = null;

jest.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onInstalled: {
        addListener: jest.fn((listener: any) => {
          onInstalledListener = listener;
        }),
      },
      onStartup: {
        addListener: jest.fn((listener: any) => {
          onStartupListener = listener;
        }),
      },
      onMessage: {
        addListener: jest.fn((listener: any) => {
          onMessageListener = listener;
        }),
      },
      getManifest: jest.fn(() => ({ version: '1.0.0' })),
    },
    bookmarks: {
      onCreated: {
        addListener: jest.fn((listener: any) => {
          onBookmarkCreatedListener = listener;
        }),
      },
      onRemoved: { addListener: jest.fn() },
      onChanged: { addListener: jest.fn() },
      onMoved: { addListener: jest.fn() },
    },
    storage: {
      local: {
        set: jest.fn(),
        get: jest.fn().mockResolvedValue({
          settings: {},
          bookmarks: {},
          tasks_data: { tasks: {}, lastUpdated: 0 },
        }),
      },
    },
    alarms: {
      create: jest.fn(),
      onAlarm: {
        addListener: jest.fn((listener: any) => {
          onAlarmListener = listener;
        }),
      },
    },
  },
}));

jest.mock('../services/favicon-warmup-service', () => ({
  __esModule: true,
  warmupBookmarkFavicons: jest.fn(),
}));

jest.mock('../services/task-service', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getTaskById: jest.fn(),
  },
}));

jest.mock('../services/task-executor', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    executeTask: jest.fn(),
    executeTaskWithData: jest.fn(),
  },
}));

jest.mock('../services/trigger-service', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    handleEventTrigger: jest.fn(),
  },
}));

jest.mock('../services/notification-service', () => ({
  __esModule: true,
  default: {
    notifyBookmarkChanges: jest.fn(),
    notifySyncStatus: jest.fn(),
    checkBackupReminder: jest.fn(),
    ensureBackupReminderAlarm: jest.fn(),
  },
  BACKUP_REMINDER_ALARM_NAME: 'marksvault-daily-backup-reminder',
}));

jest.mock('../services/backup-service', () => ({
  __esModule: true,
  default: {
    restorePendingBookmarkBackup: jest.fn(),
  },
}));

jest.mock('../services/task-executor-lease', () => ({
  __esModule: true,
  tryAcquireBookmarkWriteLease: jest.fn(),
  releaseBookmarkWriteLease: jest.fn(),
}));

import background, {
  resetServicesInitStateForTesting,
} from '../entrypoints/background';
import { warmupBookmarkFavicons } from '../services/favicon-warmup-service';
import notificationService, {
  BACKUP_REMINDER_ALARM_NAME,
} from '../services/notification-service';
import taskExecutor from '../services/task-executor';
import taskService from '../services/task-service';
import backupService from '../services/backup-service';
import {
  releaseBookmarkWriteLease,
  tryAcquireBookmarkWriteLease,
} from '../services/task-executor-lease';
import { ACTION_TIMEOUTS } from '../services/task-executor-types';

describe('background runtime.onMessage', () => {
  const mockedWarmup = warmupBookmarkFavicons as jest.MockedFunction<typeof warmupBookmarkFavicons>;
  const mockedNotificationService =
    notificationService as jest.Mocked<typeof notificationService>;
  const mockedTaskExecutor = taskExecutor as jest.Mocked<typeof taskExecutor>;
  const mockedTaskService = taskService as jest.Mocked<typeof taskService>;
  const mockedBackupService = backupService as jest.Mocked<typeof backupService>;
  const mockedTryAcquireWriteLease =
    tryAcquireBookmarkWriteLease as jest.MockedFunction<typeof tryAcquireBookmarkWriteLease>;
  const mockedReleaseWriteLease =
    releaseBookmarkWriteLease as jest.MockedFunction<typeof releaseBookmarkWriteLease>;

  const waitForResponse = async (sendResponse: jest.Mock): Promise<void> => {
    for (let i = 0; i < 200; i++) {
      if (sendResponse.mock.calls.length > 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('等待 sendResponse 超时');
  };

  const startListener = (): ((message: any, sender: any, sendResponse: any) => any) => {
    (background as any).main();
    expect(onMessageListener).toBeTruthy();
    return onMessageListener as (message: any, sender: any, sendResponse: any) => any;
  };

  beforeEach(() => {
    resetServicesInitStateForTesting();
    jest.clearAllMocks();
    onMessageListener = null;
    onInstalledListener = null;
    onStartupListener = null;
    onAlarmListener = null;
    onBookmarkCreatedListener = null;

    mockedNotificationService.notifyBookmarkChanges.mockResolvedValue(undefined);
    mockedNotificationService.notifySyncStatus.mockResolvedValue(undefined);
    mockedNotificationService.checkBackupReminder.mockResolvedValue(undefined);
    mockedNotificationService.ensureBackupReminderAlarm.mockResolvedValue(undefined);
  });

  test('WARMUP_BOOKMARK_FAVICONS 会通过 sendResponse 返回结果', async () => {
    mockedWarmup.mockResolvedValue({
      success: true,
      attempted: 2,
      warmed: 2,
      failed: 0,
      skipped: 0,
      durationMs: 123,
    });

    (background as any).main();
    expect(onMessageListener).toBeTruthy();

    const listener = onMessageListener;
    if (!listener) {
      throw new Error('runtime.onMessage listener 未注册');
    }

    const sendResponse = jest.fn();
    const returned = listener(
      { type: 'WARMUP_BOOKMARK_FAVICONS', payload: { scope: 'bookmark_bar' } },
      null,
      sendResponse,
    );

    // Chrome 异步消息响应需要返回 true
    expect(returned).toBe(true);

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: {
        success: true,
        attempted: 2,
        warmed: 2,
        failed: 0,
        skipped: 0,
        durationMs: 123,
      },
      error: undefined,
    });
  });

  describe('EXECUTE_TASK', () => {
    beforeEach(() => {
      mockedTaskService.getTaskById.mockResolvedValue({
        success: true,
        data: { id: 'task_1' },
      } as any);
    });

    test('通过 background 以 manual 来源执行任务并返回成功', async () => {
      mockedTaskExecutor.executeTask.mockResolvedValue({
        success: true,
        timestamp: Date.now(),
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      const returned = listener(
        { type: 'EXECUTE_TASK', payload: { taskId: 'task_1' } },
        null,
        sendResponse,
      );

      expect(returned).toBe(true);
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTask).toHaveBeenCalledWith('task_1', 0, 'manual');
      expect(mockedNotificationService.notifySyncStatus).toHaveBeenCalledWith(
        { id: 'task_1' },
        expect.objectContaining({ success: true }),
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true, error: undefined });
    });

    test('执行失败时通过 sendResponse 返回失败原因', async () => {
      mockedTaskExecutor.executeTask.mockResolvedValue({
        success: false,
        timestamp: Date.now(),
        error: '任务正在执行中',
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        { type: 'EXECUTE_TASK', payload: { taskId: 'task_1' } },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '任务正在执行中',
      });
    });

    test('执行器抛错时通过 sendResponse 返回错误，不产生未处理异常', async () => {
      mockedTaskExecutor.executeTask.mockRejectedValue(new Error('执行器异常'));
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        { type: 'EXECUTE_TASK', payload: { taskId: 'task_1' } },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '执行器异常',
      });
    });

    test('缺少任务ID时返回明确错误且不执行任务', async () => {
      const listener = startListener();
      const sendResponse = jest.fn();

      listener({ type: 'EXECUTE_TASK', payload: {} }, null, sendResponse);
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTask).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '无效的任务ID',
      });
    });

    test('任务不存在时返回明确错误且不执行任务', async () => {
      mockedTaskService.getTaskById.mockResolvedValue({
        success: false,
        error: '未找到任务',
      } as any);
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        { type: 'EXECUTE_TASK', payload: { taskId: 'missing_task' } },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTask).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '任务不存在',
      });
    });

    test('兼容早期快捷备份发送的顶层 taskId', async () => {
      mockedTaskExecutor.executeTask.mockResolvedValue({
        success: true,
        timestamp: Date.now(),
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener({ type: 'EXECUTE_TASK', taskId: 'task_1' }, null, sendResponse);
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTask).toHaveBeenCalledWith('task_1', 0, 'manual');
      expect(sendResponse).toHaveBeenCalledWith({ success: true, error: undefined });
    });
  });

  describe('EXECUTE_TASK_WITH_DATA', () => {
    const restoreTask = {
      id: 'task_restore',
      name: '恢复任务',
      status: 'enabled',
      createdAt: 1,
      updatedAt: 1,
      trigger: { type: 'manual', enabled: true, description: '手动触发' },
      action: {
        type: 'backup',
        operation: 'restore',
        description: '从GitHub恢复书签',
        target: 'github',
        options: { backupFilePath: '' },
      },
      history: { executions: [] },
    };

    beforeEach(() => {
      mockedTaskService.getTaskById.mockResolvedValue({
        success: true,
        data: restoreTask,
      } as any);
    });

    test('使用指定备份文件在 background 执行恢复并返回成功', async () => {
      mockedTaskExecutor.executeTaskWithData.mockResolvedValue({
        success: true,
        timestamp: Date.now(),
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        {
          type: 'EXECUTE_TASK_WITH_DATA',
          payload: { taskId: 'task_restore', backupFilePath: 'bookmarks/backup_1.json' },
        },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTaskWithData).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task_restore',
          action: expect.objectContaining({
            operation: 'restore',
            options: expect.objectContaining({
              backupFilePath: 'bookmarks/backup_1.json',
            }),
          }),
        }),
        0,
        'manual',
      );
      expect(mockedNotificationService.notifySyncStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task_restore' }),
        expect.objectContaining({ success: true }),
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true, error: undefined });
    });

    test('未指定备份文件时移除旧路径，使用最新备份', async () => {
      mockedTaskExecutor.executeTaskWithData.mockResolvedValue({
        success: true,
        timestamp: Date.now(),
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        { type: 'EXECUTE_TASK_WITH_DATA', payload: { taskId: 'task_restore' } },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      const executedTask = mockedTaskExecutor.executeTaskWithData.mock.calls[0][0] as any;
      expect(executedTask.action.options.backupFilePath).toBeUndefined();
      expect(sendResponse).toHaveBeenCalledWith({ success: true, error: undefined });
    });

    test('恢复失败时通过 sendResponse 返回失败原因', async () => {
      mockedTaskExecutor.executeTaskWithData.mockResolvedValue({
        success: false,
        timestamp: Date.now(),
        error: '恢复失败',
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        { type: 'EXECUTE_TASK_WITH_DATA', payload: { taskId: 'task_restore' } },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: '恢复失败' });
    });

    test('缺少任务ID时返回明确错误且不执行任务', async () => {
      const listener = startListener();
      const sendResponse = jest.fn();

      listener({ type: 'EXECUTE_TASK_WITH_DATA', payload: {} }, null, sendResponse);
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTaskWithData).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '无效的任务ID',
      });
    });

    test('备份文件路径类型无效时返回明确错误且不执行任务', async () => {
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        { type: 'EXECUTE_TASK_WITH_DATA', payload: { taskId: 'task_restore', backupFilePath: 1 } },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTaskWithData).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '无效的备份文件路径',
      });
    });

    test('非恢复任务不能通过该消息执行', async () => {
      mockedTaskService.getTaskById.mockResolvedValue({
        success: true,
        data: {
          ...restoreTask,
          action: {
            ...restoreTask.action,
            operation: 'backup',
          },
        },
      } as any);
      const listener = startListener();
      const sendResponse = jest.fn();

      listener(
        { type: 'EXECUTE_TASK_WITH_DATA', payload: { taskId: 'task_restore' } },
        null,
        sendResponse,
      );
      await waitForResponse(sendResponse);

      expect(mockedTaskExecutor.executeTaskWithData).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '仅支持恢复书签任务',
      });
    });
  });

  describe('RESTORE_PENDING_BOOKMARK_BACKUP', () => {
    beforeEach(() => {
      mockedTryAcquireWriteLease.mockResolvedValue({ success: true, denied: false });
      mockedReleaseWriteLease.mockResolvedValue(undefined);
    });

    test('写入租约被占用时拒绝回滚，不修改书签', async () => {
      mockedTryAcquireWriteLease.mockResolvedValue({ success: false, denied: true });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener({ type: 'RESTORE_PENDING_BOOKMARK_BACKUP' }, null, sendResponse);
      await waitForResponse(sendResponse);

      expect(mockedBackupService.restorePendingBookmarkBackup).not.toHaveBeenCalled();
      expect(mockedReleaseWriteLease).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '另一个任务正在修改书签树，请稍后重试',
      });
    });

    test('回滚成功后释放写入租约并返回书签数量', async () => {
      mockedBackupService.restorePendingBookmarkBackup.mockResolvedValue({
        success: true,
        data: { timestamp: Date.now(), bookmarksCount: 3 },
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener({ type: 'RESTORE_PENDING_BOOKMARK_BACKUP' }, null, sendResponse);
      await waitForResponse(sendResponse);

      expect(mockedTryAcquireWriteLease).toHaveBeenCalledTimes(1);
      const executionId = mockedTryAcquireWriteLease.mock.calls[0][1];
      const leaseDuration = mockedTryAcquireWriteLease.mock.calls[0][2];
      expect(mockedTryAcquireWriteLease).toHaveBeenCalledWith(
        'pending_restore_rollback',
        executionId,
        expect.any(Number),
      );
      // 回滚重建书签树，写入租约覆盖恢复动作超时
      expect(leaseDuration).toBeGreaterThanOrEqual(ACTION_TIMEOUTS.restore);
      expect(mockedReleaseWriteLease).toHaveBeenCalledWith(executionId);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { timestamp: expect.any(Number), bookmarksCount: 3 },
        error: undefined,
      });
    });

    test('回滚失败后同样释放写入租约并返回失败原因', async () => {
      mockedBackupService.restorePendingBookmarkBackup.mockResolvedValue({
        success: false,
        error: '回滚失败: 暂存数据损坏',
      });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener({ type: 'RESTORE_PENDING_BOOKMARK_BACKUP' }, null, sendResponse);
      await waitForResponse(sendResponse);

      const executionId = mockedTryAcquireWriteLease.mock.calls[0][1];
      expect(mockedReleaseWriteLease).toHaveBeenCalledWith(executionId);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        data: undefined,
        error: '回滚失败: 暂存数据损坏',
      });
    });

    test('写入租约无法可靠保存时拒绝回滚', async () => {
      mockedTryAcquireWriteLease.mockResolvedValue({ success: false, denied: false });
      const listener = startListener();
      const sendResponse = jest.fn();

      listener({ type: 'RESTORE_PENDING_BOOKMARK_BACKUP' }, null, sendResponse);
      await waitForResponse(sendResponse);

      expect(mockedBackupService.restorePendingBookmarkBackup).not.toHaveBeenCalled();
      expect(mockedReleaseWriteLease).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '获取书签写入租约失败',
      });
    });
  });

  describe('通知接入', () => {
    const getListener = <T>(listener: T | null, name: string): T => {
      if (!listener) throw new Error(`${name} 监听器未注册`);
      return listener;
    };

    test('书签创建事件触发书签变更通知', async () => {
      startListener();
      const listener = getListener(onBookmarkCreatedListener, 'bookmarks.onCreated');

      await listener('bookmark_1', { id: 'bookmark_1', title: '示例书签' });

      expect(mockedNotificationService.notifyBookmarkChanges).toHaveBeenCalledTimes(1);
    });

    test('备份提醒 alarm 触发检查，其他 alarm 被忽略', async () => {
      startListener();
      const listener = getListener(onAlarmListener, 'alarms.onAlarm');

      listener({ name: 'other-alarm' });
      expect(mockedNotificationService.checkBackupReminder).not.toHaveBeenCalled();

      listener({ name: BACKUP_REMINDER_ALARM_NAME });
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(mockedNotificationService.checkBackupReminder).toHaveBeenCalledTimes(1);
    });

    test('安装与浏览器启动时确保备份提醒定时任务存在', async () => {
      startListener();
      const installedListener = getListener(onInstalledListener, 'runtime.onInstalled');
      const startupListener = getListener(onStartupListener, 'runtime.onStartup');

      await installedListener({ reason: 'install' });
      await startupListener();

      expect(mockedNotificationService.ensureBackupReminderAlarm).toHaveBeenCalledTimes(2);
    });
  });
});
