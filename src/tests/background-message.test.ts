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
    executeTaskWithData: jest.fn(),
  },
}));

jest.mock('../services/trigger-service', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
  },
}));

import background from '../entrypoints/background';
import { warmupBookmarkFavicons } from '../services/favicon-warmup-service';

describe('background runtime.onMessage', () => {
  const mockedWarmup = warmupBookmarkFavicons as jest.MockedFunction<typeof warmupBookmarkFavicons>;

  beforeEach(() => {
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
});
