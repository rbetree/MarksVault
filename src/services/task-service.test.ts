import taskService from './task-service';
import storageService from '../utils/storage-service';

jest.mock('../utils/storage-service', () => ({
  __esModule: true,
  default: {
    setStorageData: jest.fn(),
    getStorageData: jest.fn(),
  },
}));

describe('task-service 持久化结果', () => {
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.setStorageData.mockResolvedValue({ success: true } as any);
  });

  test('存储层返回失败时不应误报成功', async () => {
    mockedStorage.setStorageData.mockResolvedValue({
      success: false,
      error: 'disk full',
    } as any);

    const result = await taskService.clearAllTasks();

    expect(result.success).toBe(false);
    expect(result.error).toContain('disk full');
  });

  test('存储层成功时返回成功', async () => {
    const result = await taskService.clearAllTasks();

    expect(result.success).toBe(true);
  });
});
