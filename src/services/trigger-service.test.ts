import { browser } from 'wxt/browser';
import triggerService from './trigger-service';
import taskService from './task-service';
import taskExecutor from './task-executor';
import { BOOKMARK_WRITE_LEASE_KEY } from './task-executor-types';
import {
  SELF_WRITE_EVENT_SUPPRESSION_MS,
  releaseBookmarkWriteLease,
} from './task-executor-lease';
import {
  EventType,
  ExecutionOutcome,
  Task,
  TaskStatus,
  TaskStorage,
  createEventTrigger,
  createOrganizeAction,
} from '../types/task';

jest.mock('./task-executor', () => ({
  __esModule: true,
  default: {
    executeTask: jest.fn(),
  },
}));

describe('trigger-service 事件触发语义', () => {
  const mockedExecutor = taskExecutor as unknown as { executeTask: jest.Mock };

  const createEventTask = async (id: string): Promise<void> => {
    const result = await taskService.createTask({
      id,
      name: `事件任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createEventTrigger(EventType.BOOKMARK_CHANGED),
      action: createOrganizeAction(),
    });
    expect(result.success).toBe(true);
  };

  const handleBookmarkChanged = async (): Promise<void> => {
    await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, {
      bookmark: { id: 'bookmark_1' },
    });
  };

  // 模拟任务完成自身写入并释放租约：释放动作会记录完成时间
  const completeSelfWrite = async (taskId: string, executionId: string): Promise<void> => {
    await browser.storage.local.set({
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId,
        executionId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 120000,
      },
    });
    await releaseBookmarkWriteLease(executionId);
  };

  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    jest.clearAllMocks();
    mockedExecutor.executeTask.mockResolvedValue({
      success: true,
      timestamp: Date.now(),
    });
  });

  test('上次执行失败后任务仍保持 ENABLED，可被事件自动触发', async () => {
    const taskId = 'failure_still_enabled';
    await createEventTask(taskId);

    await taskService.updateTaskExecutionHistory(taskId, {
      success: false,
      timestamp: Date.now(),
      outcome: ExecutionOutcome.FAILURE,
      error: '网络错误',
    });

    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(taskId, 0, 'event');
  });

  test('上次执行中断后任务仍保持 ENABLED，可被事件自动触发', async () => {
    const taskId = 'interrupted_still_enabled';
    await createEventTask(taskId);

    await taskService.updateTaskExecutionHistory(taskId, {
      success: false,
      timestamp: Date.now(),
      outcome: ExecutionOutcome.INTERRUPTED,
      error: '任务执行中断（扩展后台终止）',
    });

    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(taskId, 0, 'event');
  });

  test('用户禁用的任务不被执行结果覆盖，也不会被事件自动触发', async () => {
    const taskId = 'disabled_not_overridden';
    await createEventTask(taskId);
    await taskService.disableTask(taskId);

    await taskService.updateTaskExecutionHistory(taskId, {
      success: false,
      timestamp: Date.now(),
      outcome: ExecutionOutcome.FAILURE,
      error: '网络错误',
    });

    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.DISABLED);

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).not.toHaveBeenCalled();
  });

  test('任务自身持有书签写入租约时，BOOKMARK_CHANGED 不再触发同一任务', async () => {
    const taskId = 'self_write_task';
    await createEventTask(taskId);

    await browser.storage.local.set({
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId,
        executionId: 'execution_1',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 120000,
      },
    });

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).not.toHaveBeenCalled();
  });

  test('用户操作在无写入租约时仍触发任务', async () => {
    const taskId = 'user_operation_task';
    await createEventTask(taskId);

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).toHaveBeenCalledTimes(1);
    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(taskId, 0, 'event');
  });

  test('其他任务持有写入租约时，用户操作仍触发当前任务', async () => {
    const taskId = 'other_writer_task';
    await createEventTask(taskId);

    await browser.storage.local.set({
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId: 'another_task',
        executionId: 'execution_other',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 120000,
      },
    });

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(taskId, 0, 'event');
  });

  test('已过期的写入租约不阻止事件触发', async () => {
    const taskId = 'expired_write_lease_task';
    await createEventTask(taskId);

    await browser.storage.local.set({
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId,
        executionId: 'expired_execution',
        acquiredAt: Date.now() - 200000,
        expiresAt: Date.now() - 1000,
      },
    });

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(taskId, 0, 'event');
  });

  test('写入租约释放后 2 秒内，迟到的 BOOKMARK_CHANGED 不触发同一任务', async () => {
    const taskId = 'late_self_write_task';
    await createEventTask(taskId);

    await completeSelfWrite(taskId, 'late_self_write_exec');

    // 租约已释放，但写入自身产生的事件可能迟到
    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).not.toHaveBeenCalled();
  });

  test('超过自身写入抑制窗口后，同一任务恢复响应书签事件', async () => {
    const taskId = 'late_self_write_expired_task';
    await createEventTask(taskId);

    await completeSelfWrite(taskId, 'late_self_write_expired_exec');

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + SELF_WRITE_EVENT_SUPPRESSION_MS);
    try {
      await handleBookmarkChanged();
    } finally {
      nowSpy.mockRestore();
    }

    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(taskId, 0, 'event');
  });

  test('自身写入抑制窗口只跳过完成写入的任务，其他任务照常触发', async () => {
    const writerTaskId = 'self_write_only_writer';
    const otherTaskId = 'self_write_other_task';
    await createEventTask(writerTaskId);
    await createEventTask(otherTaskId);

    await completeSelfWrite(writerTaskId, 'self_write_only_exec');

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).toHaveBeenCalledTimes(1);
    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(otherTaskId, 0, 'event');
  });

  test('旧数据中的 FAILED 任务迁移为 ENABLED 后可被事件自动触发', async () => {
    const taskId = 'legacy_failed_task';
    await browser.storage.local.set({
      tasks_data: {
        tasks: {
          [taskId]: {
            id: taskId,
            name: '旧失败任务',
            status: TaskStatus.FAILED,
            createdAt: 1,
            updatedAt: 1,
            trigger: createEventTrigger(EventType.BOOKMARK_CHANGED),
            action: createOrganizeAction(),
            history: { executions: [] },
          },
        },
        lastUpdated: 1,
      },
    });

    await handleBookmarkChanged();

    expect(mockedExecutor.executeTask).toHaveBeenCalledWith(taskId, 0, 'event');

    const stored = await browser.storage.local.get('tasks_data');
    const storage = stored.tasks_data as TaskStorage;
    expect(storage.tasks[taskId].status).toBe(TaskStatus.ENABLED);
  });
});
