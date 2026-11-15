jest.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
      },
      sync: {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
      },
    },
  },
}));

import { browser } from 'wxt/browser';
import storageService from './storage-service';

describe('storage-service getStorageData', () => {
  const mockedLocalGet = browser.storage.local.get as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    { input: false, label: 'false' },
    { input: 0, label: '0' },
    { input: '', label: "''" },
  ])('应保留合法 falsy 值: $label', async ({ input }) => {
    mockedLocalGet.mockResolvedValueOnce({ sample_key: input });

    const result = await storageService.getStorageData('sample_key');

    expect(result.success).toBe(true);
    expect(result.data).toBe(input);
  });

  test('键不存在时应返回 null', async () => {
    mockedLocalGet.mockResolvedValueOnce({});

    const result = await storageService.getStorageData('sample_key');

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

describe('storage-service importConfig 运行态保护', () => {
  const mockedLocalGet = browser.storage.local.get as jest.Mock;
  const mockedLocalSet = browser.storage.local.set as jest.Mock;
  const mockedLocalClear = browser.storage.local.clear as jest.Mock;

  const baseConfig = {
    schemaVersion: 1,
    app: 'MarksVault',
    extensionVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    local: { settings: { syncEnabled: false, viewType: 'list' } },
    sync: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('导入配置后应保留运行态数据（租约/快照/恢复暂存）', async () => {
    // 当前存储包含运行态数据与用户配置
    mockedLocalGet.mockResolvedValueOnce({
      settings: { syncEnabled: true, viewType: 'grid' },
      bookmark_write_lease: { taskId: 't-1' },
      'execution_lease:t-1': { until: 123456 },
      execution_snapshots: { 't-1': {} },
      pending_restore_backup: '{"id":"1"}',
    });

    const result = await storageService.importConfig(baseConfig as any);

    expect(result.success).toBe(true);
    expect(mockedLocalClear).toHaveBeenCalledTimes(1);
    // 第一次 set：导入备份数据
    expect(mockedLocalSet.mock.calls[0][0]).toEqual({
      settings: { syncEnabled: false, viewType: 'list' },
    });
    // 第二次 set：回写运行态数据（以当前运行态为准）
    expect(mockedLocalSet).toHaveBeenCalledTimes(2);
    const runtimeSetCall = mockedLocalSet.mock.calls[1][0];
    expect(runtimeSetCall['bookmark_write_lease']).toEqual({ taskId: 't-1' });
    expect(runtimeSetCall['execution_lease:t-1']).toEqual({ until: 123456 });
    expect(runtimeSetCall['execution_snapshots']).toEqual({ 't-1': {} });
    expect(runtimeSetCall['pending_restore_backup']).toBe('{"id":"1"}');
  });

  test('无运行态数据时只执行一次 set（导入数据）', async () => {
    mockedLocalGet.mockResolvedValueOnce({
      settings: { syncEnabled: true, viewType: 'grid' },
    });

    const result = await storageService.importConfig(baseConfig as any);

    expect(result.success).toBe(true);
    expect(mockedLocalClear).toHaveBeenCalledTimes(1);
    expect(mockedLocalSet).toHaveBeenCalledTimes(1);
    expect(mockedLocalSet.mock.calls[0][0]).toEqual({
      settings: { syncEnabled: false, viewType: 'list' },
    });
  });

  test('导入写入失败时应回滚到导入前的全量数据', async () => {
    const originalData = {
      settings: { syncEnabled: true, viewType: 'grid' },
      bookmarks: { lastUpdated: 1, customData: { '1': { note: 'keep' } } },
      bookmark_write_lease: { taskId: 't-1' },
    };
    mockedLocalGet.mockResolvedValueOnce(originalData);
    mockedLocalSet.mockRejectedValueOnce(new Error('quota exceeded'));

    const result = await storageService.importConfig(baseConfig as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('导入配置失败');
    expect(result.error).toContain('quota exceeded');
    // 首次 set 导入数据失败后，再次 clear 并写回导入前的完整快照
    expect(mockedLocalClear).toHaveBeenCalledTimes(2);
    expect(mockedLocalSet).toHaveBeenNthCalledWith(1, {
      settings: { syncEnabled: false, viewType: 'list' },
    });
    expect(mockedLocalSet).toHaveBeenNthCalledWith(2, originalData);
  });

  test('导入写入与回滚都失败时返回两个错误', async () => {
    mockedLocalGet.mockResolvedValueOnce({
      settings: { syncEnabled: true, viewType: 'grid' },
    });
    mockedLocalSet
      .mockRejectedValueOnce(new Error('write failed'))
      .mockRejectedValueOnce(new Error('rollback failed'));

    const result = await storageService.importConfig(baseConfig as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('write failed');
    expect(result.error).toContain('恢复原数据失败');
    expect(result.error).toContain('rollback failed');
  });
});
