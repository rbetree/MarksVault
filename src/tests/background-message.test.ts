jest.mock('wxt/utils/define-background', () => ({
  defineBackground: (config: unknown) => config,
}));

let onMessageListener: ((message: any, sender: any, sendResponse: any) => any) | null = null;

jest.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onInstalled: { addListener: jest.fn() },
      onStartup: { addListener: jest.fn() },
      onMessage: {
        addListener: jest.fn((listener: any) => {
          onMessageListener = listener;
        }),
      },
      getManifest: jest.fn(() => ({ version: '1.0.0' })),
    },
    bookmarks: {
      onCreated: { addListener: jest.fn() },
      onRemoved: { addListener: jest.fn() },
      onChanged: { addListener: jest.fn() },
      onMoved: { addListener: jest.fn() },
    },
    storage: {
      local: {
        set: jest.fn(),
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
  },
}));

import background, {
  resetServicesInitStateForTesting,
} from '../entrypoints/background';
import { warmupBookmarkFavicons } from '../services/favicon-warmup-service';
import taskExecutor from '../services/task-executor';
import taskService from '../services/task-service';

describe('background runtime.onMessage', () => {
  const mockedWarmup = warmupBookmarkFavicons as jest.MockedFunction<typeof warmupBookmarkFavicons>;
  const mockedTaskExecutor = taskExecutor as jest.Mocked<typeof taskExecutor>;
  const mockedTaskService = taskService as jest.Mocked<typeof taskService>;

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
});
