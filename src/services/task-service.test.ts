import taskService from './task-service';
import storageService from '../utils/storage-service';
import { Task, TaskStatus } from '../types/task';

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

  describe('updateTask 字段保护', () => {
    const buildTaskStorage = () => ({
      tasks: {
        task_1: {
          id: 'task_1',
          name: '原任务',
          status: TaskStatus.ENABLED,
          createdAt: 1,
          updatedAt: 1,
          history: {
            executions: [{ success: true, timestamp: 1 }],
          },
        },
      },
      lastUpdated: 1,
    });

    beforeEach(() => {
      mockedStorage.getStorageData.mockResolvedValue({
        success: true,
        data: buildTaskStorage(),
      } as any);
    });

    test('忽略表单回传的 status 与 history，只应用其他字段', async () => {
      const result = await taskService.updateTask('task_1', {
        name: '新任务名',
        status: TaskStatus.FAILED,
        history: { executions: [] },
      });

      expect(result.success).toBe(true);
      const updated = result.data as Task;
      expect(updated.name).toBe('新任务名');
      expect(updated.status).toBe(TaskStatus.ENABLED);
      expect(updated.history.executions).toHaveLength(1);

      const saved = mockedStorage.setStorageData.mock.calls[0][1] as {
        tasks: Record<string, Task>;
      };
      expect(saved.tasks.task_1.status).toBe(TaskStatus.ENABLED);
      expect(saved.tasks.task_1.history.executions).toHaveLength(1);
    });

    test('显式 setTaskStatus 仍可更新状态', async () => {
      const result = await taskService.setTaskStatus('task_1', TaskStatus.DISABLED);

      expect(result.success).toBe(true);
      expect((result.data as Task).status).toBe(TaskStatus.DISABLED);
    });
  });
});
