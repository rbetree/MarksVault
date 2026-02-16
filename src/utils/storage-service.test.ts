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
