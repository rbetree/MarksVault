jest.mock('wxt/utils/define-background', () => ({
  defineBackground: (config: unknown) => config,
}));

jest.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      onInstalled: { addListener: jest.fn() },
      onStartup: { addListener: jest.fn() },
      onMessage: { addListener: jest.fn() },
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

jest.mock('../services/task-service', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
  },
}));

jest.mock('../services/task-executor', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
  },
}));

jest.mock('../services/trigger-service', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
  },
}));

import taskExecutor from '../services/task-executor';
import taskService from '../services/task-service';
import triggerService from '../services/trigger-service';
import {
  ensureServicesInitializedForTesting,
  resetServicesInitStateForTesting,
} from './background';

describe('background 初始化门闩', () => {
  const mockedTaskService = taskService as jest.Mocked<typeof taskService>;
  const mockedTaskExecutor = taskExecutor as jest.Mocked<typeof taskExecutor>;
  const mockedTriggerService = triggerService as jest.Mocked<typeof triggerService>;

  beforeEach(() => {
    resetServicesInitStateForTesting();
    jest.clearAllMocks();
    mockedTaskService.init.mockResolvedValue(undefined);
    mockedTaskExecutor.init.mockResolvedValue(undefined);
    mockedTriggerService.init.mockResolvedValue(undefined);
  });

  test('初始化失败后下一次调用会重试', async () => {
    mockedTaskService.init
      .mockRejectedValueOnce(new Error('init failed'))
      .mockResolvedValueOnce(undefined);

    await expect(ensureServicesInitializedForTesting()).rejects.toThrow('init failed');
    await expect(ensureServicesInitializedForTesting()).resolves.toBeUndefined();

    expect(mockedTaskService.init).toHaveBeenCalledTimes(2);
    expect(mockedTaskExecutor.init).toHaveBeenCalledTimes(1);
    expect(mockedTriggerService.init).toHaveBeenCalledTimes(1);
  });

  test('并发调用只会触发一次初始化', async () => {
    await Promise.all([
      ensureServicesInitializedForTesting(),
      ensureServicesInitializedForTesting(),
    ]);

    expect(mockedTaskService.init).toHaveBeenCalledTimes(1);
    expect(mockedTaskExecutor.init).toHaveBeenCalledTimes(1);
    expect(mockedTriggerService.init).toHaveBeenCalledTimes(1);
  });
});
