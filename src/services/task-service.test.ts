import taskService from './task-service';
import storageService from '../utils/storage-service';
import {
  ExecutionOutcome,
  Task,
  TaskStatus,
  TaskStorage,
} from '../types/task';

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

  describe('启用状态与执行结果解耦', () => {
    const buildTask = (id: string, status: TaskStatus) => ({
      id,
      name: `任务 ${id}`,
      status,
      createdAt: 1,
      updatedAt: 1,
      history: { executions: [] },
    });

    const buildStorage = (status: TaskStatus = TaskStatus.ENABLED) => ({
      tasks: {
        task_1: buildTask('task_1', status),
      },
      lastUpdated: 1,
    });

    beforeEach(() => {
      mockedStorage.getStorageData.mockResolvedValue({
        success: true,
        data: buildStorage(),
      } as any);
    });

    test('读取旧 FAILED/COMPLETED 任务时迁移为 ENABLED 并持久化', async () => {
      mockedStorage.getStorageData.mockResolvedValue({
        success: true,
        data: {
          tasks: {
            failed: buildTask('failed', TaskStatus.FAILED),
            completed: buildTask('completed', TaskStatus.COMPLETED),
            disabled: buildTask('disabled', TaskStatus.DISABLED),
          },
          lastUpdated: 1,
        },
      } as any);

      const result = await taskService.getTasks();

      expect(result.success).toBe(true);
      const storage = result.data as TaskStorage;
      expect(storage.tasks.failed.status).toBe(TaskStatus.ENABLED);
      expect(storage.tasks.completed.status).toBe(TaskStatus.ENABLED);
      // 用户主动禁用是稳定配置，迁移不能把它改回启用
      expect(storage.tasks.disabled.status).toBe(TaskStatus.DISABLED);

      expect(mockedStorage.setStorageData).toHaveBeenCalledTimes(1);
      const saved = mockedStorage.setStorageData.mock.calls[0][1] as TaskStorage;
      expect(saved.tasks.failed.status).toBe(TaskStatus.ENABLED);
      expect(saved.tasks.completed.status).toBe(TaskStatus.ENABLED);
    });

    test('执行失败只写入历史，不改变 ENABLED 启用状态', async () => {
      const failure = {
        success: false,
        timestamp: 2,
        outcome: ExecutionOutcome.FAILURE,
        error: '网络错误',
      };

      const result = await taskService.updateTaskExecutionHistory('task_1', failure);

      expect(result.success).toBe(true);
      const saved = mockedStorage.setStorageData.mock.calls[0][1] as TaskStorage;
      expect(saved.tasks.task_1.status).toBe(TaskStatus.ENABLED);
      expect(saved.tasks.task_1.history.lastExecution).toEqual(failure);
    });

    test('执行成功不改变用户 DISABLED 启用状态', async () => {
      mockedStorage.getStorageData.mockResolvedValue({
        success: true,
        data: buildStorage(TaskStatus.DISABLED),
      } as any);

      const success = {
        success: true,
        timestamp: 3,
        outcome: ExecutionOutcome.SUCCESS,
      };

      const result = await taskService.updateTaskExecutionHistory('task_1', success);

      expect(result.success).toBe(true);
      const saved = mockedStorage.setStorageData.mock.calls[0][1] as TaskStorage;
      expect(saved.tasks.task_1.status).toBe(TaskStatus.DISABLED);
      expect(saved.tasks.task_1.history.lastExecution).toEqual(success);
    });

    test('setTaskStatus 不再持久化 FAILED/COMPLETED', async () => {
      mockedStorage.getStorageData.mockImplementation(async () => ({
        success: true,
        data: buildStorage(TaskStatus.ENABLED),
      } as any));

      const failedResult = await taskService.setTaskStatus('task_1', TaskStatus.FAILED);
      expect((failedResult.data as Task).status).toBe(TaskStatus.ENABLED);

      const completedResult = await taskService.setTaskStatus('task_1', TaskStatus.COMPLETED);
      expect((completedResult.data as Task).status).toBe(TaskStatus.ENABLED);
    });

    test('创建任务时 FAILED/COMPLETED 归一化为 ENABLED', async () => {
      mockedStorage.getStorageData.mockResolvedValue({
        success: true,
        data: { tasks: {}, lastUpdated: 1 },
      } as any);

      const result = await taskService.createTask({
        id: 'new_task',
        status: TaskStatus.FAILED,
      });

      expect(result.success).toBe(true);
      expect((result.data as Task).status).toBe(TaskStatus.ENABLED);
    });
  });
});
