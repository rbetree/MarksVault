import { browser } from 'wxt/browser';
import taskExecutor, { TaskExecutor, EXECUTION_LEASE_KEY_PREFIX, BOOKMARK_WRITE_LEASE_KEY } from './task-executor';
import * as taskExecutorLease from './task-executor-lease';
import taskService from './task-service';
import storageService from '../utils/storage-service';
import { RetryableError, RetryableErrorCategory, GitHubApiError } from './github-service';
import { resolveActionTimeout, runWithTimeout } from './task-executor-timeout';
import { ACTION_TIMEOUTS, DEFAULT_CONFIG } from './task-executor-types';
import {
  BackupAction,
  BookmarkSelection,
  SelectivePushAction,
  Task,
  TaskStatus,
  ExecutionOutcome,
  createBackupAction,
  createEventTrigger,
  createManualTrigger,
  createOrganizeAction,
  createPushAction,
  createSelectivePushAction,
  EventType,
} from '../types/task';

// 可控 deferred，用于模拟执行过程中悬挂（如 SW 中断前的执行状态）
const createDeferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// 轮询等待条件成立
const waitFor = async (predicate: () => boolean, timeoutMs = 2000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor 超时');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('task-executor 安全策略', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
  });

  test('restore 操作：非手动触发任务应被拒绝执行', async () => {
    const create = await taskService.createTask({
      id: 'restore_event_task',
      name: '事件触发恢复（应被拒绝）',
      status: TaskStatus.ENABLED,
      trigger: createEventTrigger(EventType.BROWSER_STARTUP),
      action: createBackupAction('restore'),
    });

    expect(create.success).toBe(true);

    const result = await taskExecutor.executeTask('restore_event_task');
    expect(result.success).toBe(false);
    expect(result.error).toContain('必须使用手动触发任务');
  });
});

describe('task-executor 任务快照隔离', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('验收1：执行开始后编辑任务定义，本次执行使用执行开始时的快照', async () => {
    const taskId = 'snapshot_edit_task';
    const action = createBackupAction('backup') as BackupAction;
    action.options.commitMessage = '执行开始时的配置';
    await taskService.createTask({
      id: taskId,
      name: '快照隔离测试',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action,
    });

    jest
      .spyOn(taskExecutor as any, 'executeBackupAction')
      .mockImplementation(async (task: unknown) => {
        const snapshotTask = task as Task;
        // 模拟执行过程中任务定义被编辑
        const editedAction = createBackupAction('backup') as BackupAction;
        editedAction.options.commitMessage = '执行中被修改的配置';
        await taskService.updateTask(taskId, { action: editedAction });

        // 本次执行仍应使用执行开始时的任务定义
        const usedCommitMessage = (snapshotTask.action as BackupAction).options.commitMessage;
        return {
          success: true,
          timestamp: Date.now(),
          details: `本次执行使用: ${usedCommitMessage}`,
        };
      });

    const result = await taskExecutor.executeTask(taskId);

    expect(result.success).toBe(true);
    expect(result.details).toContain('本次执行使用: 执行开始时的配置');

    // 持久化的任务定义确实已被编辑
    const persisted = await taskService.getTaskById(taskId);
    expect(((persisted.data as Task).action as BackupAction).options.commitMessage).toBe('执行中被修改的配置');
  });

  test('验收1：执行开始后删除任务，不影响已开始的执行', async () => {
    const taskId = 'snapshot_delete_task';
    const action = createBackupAction('backup') as BackupAction;
    action.options.commitMessage = '删除前配置';
    await taskService.createTask({
      id: taskId,
      name: '快照删除测试',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action,
    });

    const gate = createDeferred();
    const backupSpy = jest
      .spyOn(taskExecutor as any, 'executeBackupAction')
      .mockImplementation(async (task: unknown) => {
        const snapshotTask = task as Task;
        await gate.promise;
        return { success: true, timestamp: Date.now(), details: `任务 ${snapshotTask.id} 执行完成` };
      });

    const executionPromise = taskExecutor.executeTask(taskId);

    // 等待执行进入操作阶段后删除任务
    await waitFor(() => backupSpy.mock.calls.length > 0);
    await taskService.deleteTask(taskId);

    gate.resolve();
    const result = await executionPromise;

    expect(result.success).toBe(true);
    expect(result.details).toContain('执行完成');
  });
});

describe('task-executor 执行输入持久化与恢复', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('验收2、3：带执行输入的 executeTaskWithData 在 SW 中断后输入不丢失且可恢复判定，不写回任务配置', async () => {
    const taskId = 'selective_task';
    await taskService.createTask({
      id: taskId,
      name: '选择性推送',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createSelectivePushAction('menav', 'bookmarks', '选择性推送'),
    });

    const selections: BookmarkSelection[] = [
      { id: 'bm1', title: '书签1', type: 'bookmark', url: 'https://example.com/1' },
      { id: 'bm2', title: '书签2', type: 'bookmark', url: 'https://example.com/2' },
    ];

    // 构造带执行输入的临时任务对象（与 background.ts EXECUTE_SELECTIVE_PUSH 分支一致）
    const taskResult = await taskService.getTaskById(taskId);
    const task = taskResult.data as Task;
    const selectiveAction = task.action as SelectivePushAction;
    const taskWithSelections: Task = {
      ...task,
      action: {
        ...selectiveAction,
        options: {
          ...selectiveAction.options,
          selections,
        },
      },
    };

    // 模拟执行悬挂（如 SW 中断前正在执行中）
    const gate = createDeferred();
    const selectiveSpy = jest
      .spyOn(taskExecutor as any, 'executeSelectivePush')
      .mockImplementation(async (t: unknown) => {
        const snapshotTask = t as Task;
        await gate.promise;
        return { success: true, timestamp: Date.now(), details: `任务 ${snapshotTask.id} 执行完成` };
      });

    const executionPromise = taskExecutor.executeTaskWithData(taskWithSelections, 0, 'manual');

    // 等待执行开始（快照已固化到 storage）
    await waitFor(() => selectiveSpy.mock.calls.length > 0);

    // 模拟 SW 重启：从 storage 重新读取快照，执行输入不丢失，可恢复判定
    const snapshot = await taskExecutor.getPendingSnapshot(taskId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.taskId).toBe(taskId);
    expect(((snapshot?.task.action as SelectivePushAction | undefined)?.options)?.selections).toEqual(selections);
    expect(snapshot?.source).toBe('manual');

    // 执行输入不会写回任务的持久化配置（保持配置时的空值）
    const persisted = await taskService.getTaskById(taskId);
    expect(((persisted.data as Task).action as SelectivePushAction).options.selections).toBeUndefined();

    // 放行执行
    gate.resolve();
    const result = await executionPromise;
    expect(result.success).toBe(true);

    // 执行正常结束后快照被清理，执行输入失效
    const after = await taskExecutor.getPendingSnapshot(taskId);
    expect(after).toBeNull();

    // 执行历史包含执行来源
    const finalTask = (await taskService.getTaskById(taskId)).data as Task;
    expect(finalTask.history.lastExecution?.source).toBe('manual');
  });
});

describe('task-executor 执行来源记录', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createBackupTask = async (id: string): Promise<void> => {
    const action = createBackupAction('backup') as BackupAction;
    action.options.commitMessage = `消息-${id}`;
    await taskService.createTask({
      id,
      name: '备份任务',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action,
    });
  };

  test('验收4：手动发起（source=manual）的执行历史记录执行来源', async () => {
    await createBackupTask('source_manual_task');
    jest
      .spyOn(taskExecutor as any, 'executeBackupAction')
      .mockResolvedValue({ success: true, timestamp: Date.now(), details: '备份成功' });

    await taskExecutor.executeTask('source_manual_task', 0, 'manual');

    const task = (await taskService.getTaskById('source_manual_task')).data as Task;
    expect(task.history.lastExecution?.success).toBe(true);
    expect(task.history.lastExecution?.source).toBe('manual');
  });

  test('验收4：事件触发（source=event）的执行历史记录执行来源', async () => {
    await createBackupTask('source_event_task');
    jest
      .spyOn(taskExecutor as any, 'executeBackupAction')
      .mockResolvedValue({ success: true, timestamp: Date.now(), details: '备份成功' });

    await taskExecutor.executeTask('source_event_task', 0, 'event');

    const task = (await taskService.getTaskById('source_event_task')).data as Task;
    expect(task.history.lastExecution?.success).toBe(true);
    expect(task.history.lastExecution?.source).toBe('event');
  });

  test('验收4：执行来源参数默认 manual，保持调用兼容', async () => {
    await createBackupTask('source_default_task');
    jest
      .spyOn(taskExecutor as any, 'executeBackupAction')
      .mockResolvedValue({ success: true, timestamp: Date.now(), details: '备份成功' });

    await taskExecutor.executeTask('source_default_task');

    const task = (await taskService.getTaskById('source_default_task')).data as Task;
    expect(task.history.lastExecution?.source).toBe('manual');
  });

  test('验收4：失败执行的历史记录同样包含执行来源', async () => {
    await createBackupTask('source_fail_task');
    jest.spyOn(taskExecutor as any, 'executeBackupAction').mockResolvedValue({
      success: false,
      timestamp: Date.now(),
      error: '模拟失败',
    });

    await taskExecutor.executeTask('source_fail_task', 0, 'event');

    const task = (await taskService.getTaskById('source_fail_task')).data as Task;
    expect(task.history.lastExecution?.success).toBe(false);
    expect(task.history.lastExecution?.source).toBe('event');
  });
});

describe('task-executor 执行租约', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    jest.restoreAllMocks();
    // 每个测试使用全新实例，避免内存执行状态残留
    TaskExecutor.resetForTesting();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const leaseKey = (taskId: string) => `${EXECUTION_LEASE_KEY_PREFIX}${taskId}`;

  const createBackupTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `租约测试任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('backup'),
    });
  };

  const readLease = async (taskId: string): Promise<any> => {
    const result = await browser.storage.local.get(leaseKey(taskId));
    return result[leaseKey(taskId)];
  };

  // 等待执行租约写入 storage.local
  const waitForLease = async (taskId: string): Promise<any> => {
    for (let i = 0; i < 200; i++) {
      const lease = await readLease(taskId);
      if (lease) {
        return lease;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('等待执行租约超时');
  };

  test('验收1、6：执行期间获取执行租约，同一任务的新执行请求被拒绝且不产生执行历史', async () => {
    const taskId = 'lease_occupied_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '备份完成' };
    });

    const firstRun = executor.executeTask(taskId);

    // 执行租约已获取：包含任务ID、执行ID、获取时间、到期时间
    const lease = await waitForLease(taskId);
    expect(lease.taskId).toBe(taskId);
    expect(lease.executionId).toBeTruthy();
    expect(lease.acquiredAt).toBeLessThanOrEqual(Date.now());
    expect(lease.expiresAt).toBeGreaterThan(Date.now());

    // 同一任务的新执行请求被拒绝
    const rejected = await executor.executeTask(taskId);
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe('任务正在执行中');

    // 被拒绝的请求不产生执行历史记录
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.executions.length).toBe(0);

    // 放行原执行
    gate.resolve();
    const firstResult = await firstRun;
    expect(firstResult.success).toBe(true);
  });

  test('验收2：模拟 SW 重启后，未到期执行租约仍然阻止重复执行', async () => {
    const taskId = 'lease_restart_task';
    await createBackupTask(taskId);

    // 第一个执行引擎实例（模拟重启前的 SW）
    const executor1 = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor1 as any, 'executeBackupAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '重启前执行完成' };
    });

    const firstRun = executor1.executeTask(taskId);
    await waitForLease(taskId);

    // 模拟 Service Worker 重启：重建执行引擎实例并重新初始化
    TaskExecutor.resetForTesting();
    const executor2 = TaskExecutor.getInstance();
    await executor2.init();

    // 未到期执行租约仍然阻止重复执行
    const rejected = await executor2.executeTask(taskId);
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe('任务正在执行中');

    // 租约到期后，重启后的执行引擎可以再次发起执行
    const lease = await readLease(taskId);
    await browser.storage.local.set({
      [leaseKey(taskId)]: { ...lease, expiresAt: Date.now() - 1 },
    });
    jest.spyOn(executor2 as any, 'executeBackupAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '重启后执行完成',
    });
    const afterExpiry = await executor2.executeTask(taskId);
    expect(afterExpiry.success).toBe(true);

    // 清理重启前的悬挂执行
    gate.resolve();
    await firstRun;
  });

  test('验收3：执行租约到期后同一任务可以再次发起执行', async () => {
    const taskId = 'lease_expired_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    jest.spyOn(executor as any, 'executeBackupAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '备份完成',
    });

    // 模拟中断残留的过期执行租约（租约到期表示原任务执行已失去运行所有权）
    await browser.storage.local.set({
      [leaseKey(taskId)]: {
        taskId,
        executionId: 'stale-execution',
        acquiredAt: Date.now() - 200000,
        expiresAt: Date.now() - 1000,
      },
    });

    // 租约到期后同一任务可以再次发起执行（过期租约不阻塞）
    const result = await executor.executeTask(taskId);
    expect(result.success).toBe(true);

    // 执行结束后过期租约已被新执行取代并释放
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('验收4：执行正常结束后执行租约被释放，后续执行请求可通过', async () => {
    const taskId = 'lease_released_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    jest.spyOn(executor as any, 'executeBackupAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '备份完成',
    });

    // 第一次执行
    const firstResult = await executor.executeTask(taskId);
    expect(firstResult.success).toBe(true);

    // 执行正常结束后租约被释放
    expect(await readLease(taskId)).toBeUndefined();

    // 后续执行请求可通过
    const secondResult = await executor.executeTask(taskId);
    expect(secondResult.success).toBe(true);
  });

  test('验收1、5：executeTaskWithData 同样受执行租约保护', async () => {
    const taskId = 'lease_with_data_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '备份完成' };
    });

    const task = (await taskService.getTaskById(taskId)).data as Task;

    // executeTaskWithData 获取执行租约
    const firstRun = executor.executeTaskWithData(task, 0, 'manual');
    await waitForLease(taskId);

    // executeTask 与 executeTaskWithData 共用租约判定
    const rejected = await executor.executeTask(taskId);
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe('任务正在执行中');

    gate.resolve();
    const firstResult = await firstRun;
    expect(firstResult.success).toBe(true);
    expect(await readLease(taskId)).toBeUndefined();

    // 释放后 executeTaskWithData 可再次执行
    const afterRelease = await executor.executeTaskWithData(task, 0, 'manual');
    expect(afterRelease.success).toBe(true);
  });

  test('验收6：执行租约无法可靠保存时，执行请求不被接受且不产生执行历史', async () => {
    const taskId = 'lease_acquire_fail_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    jest.spyOn(executor as any, 'acquireExecutionLease').mockResolvedValue({
      success: false,
      executionId: '',
    });

    const result = await executor.executeTask(taskId);
    expect(result.success).toBe(false);
    expect(result.error).toBe('获取执行租约失败');

    // 被拒绝的请求不产生执行历史记录，也不残留租约
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.executions.length).toBe(0);
    expect(await readLease(taskId)).toBeUndefined();
  });
});

describe('task-executor 三态结果与中断恢复', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    jest.restoreAllMocks();
    // 每个测试使用全新实例，避免内存执行状态残留（模拟 SW 重启）
    TaskExecutor.resetForTesting();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const leaseKey = (taskId: string) => `${EXECUTION_LEASE_KEY_PREFIX}${taskId}`;

  const createBackupTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `三态结果测试任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('backup'),
    });
  };

  const readLease = async (taskId: string): Promise<any> => {
    const result = await browser.storage.local.get(leaseKey(taskId));
    return result[leaseKey(taskId)];
  };

  // 等待执行租约写入 storage.local
  const waitForLease = async (taskId: string): Promise<any> => {
    for (let i = 0; i < 200; i++) {
      const lease = await readLease(taskId);
      if (lease) {
        return lease;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('等待执行租约超时');
  };

  // 执行动作被悬挂：模拟超时后底层操作可能仍在进行
  const hangExecution = (executor: TaskExecutor): jest.SpyInstance => {
    return jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      await new Promise(() => {});
    });
  };

  test('验收1：超时结束的执行被标记为结果不确定，不进入重试，不标记 FAILED', async () => {
    const taskId = 'timeout_uncertain_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ actionTimeouts: { backup: 50 } });
    const backupSpy = hangExecution(executor);

    const result = await executor.executeTask(taskId);

    // 结果为"结果不确定"（结构化字段），而非简单失败
    expect(result.success).toBe(false);
    expect(result.outcome).toBe(ExecutionOutcome.UNCERTAIN);
    expect(result.error).toContain('超时');

    // 不进入重试：动作执行器只被调用一次
    expect(backupSpy).toHaveBeenCalledTimes(1);

    // 执行结果不改变启用状态：任务恢复为 ENABLED，
    // 未到期执行租约保留以阻止并发重入
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    expect(task.history.lastExecution?.outcome).toBe(ExecutionOutcome.UNCERTAIN);
    expect(task.history.lastExecution?.success).toBe(false);
  });

  test('验收2：模拟 SW 重启且租约未到期时，遗留执行恢复为结果不确定', async () => {
    const taskId = 'recover_uncertain_task';
    await createBackupTask(taskId);

    // 第一个执行引擎实例（模拟重启前的 SW，执行悬挂中）
    const executor1 = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor1 as any, 'executeBackupAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '重启前执行完成' };
    });
    const firstRun = executor1.executeTask(taskId);
    await waitForLease(taskId);

    // 模拟 Service Worker 重启：重建执行引擎实例并重新初始化
    TaskExecutor.resetForTesting();
    const executor2 = TaskExecutor.getInstance();
    await executor2.init();

    // 遗留执行恢复为"结果不确定"并写入执行历史
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.lastExecution?.outcome).toBe(ExecutionOutcome.UNCERTAIN);
    expect(task.history.lastExecution?.success).toBe(false);
    expect(task.history.lastExecution?.source).toBe('manual');

    // 结果不确定不等于失败：任务不标记为 FAILED
    expect(task.status).toBe(TaskStatus.ENABLED);

    // 未到期执行租约保留，继续阻止同一任务被重复执行
    const rejected = await executor2.executeTask(taskId);
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe('任务正在执行中');

    // 遗留执行已终结，快照（执行输入）已清理
    expect(await executor2.getPendingSnapshot(taskId)).toBeNull();

    // 清理重启前的悬挂执行
    gate.resolve();
    await firstRun;
  });

  test('验收3：模拟 SW 重启且租约已到期时，遗留执行恢复为执行中断', async () => {
    const taskId = 'recover_interrupted_task';
    await createBackupTask(taskId);

    // 第一个执行引擎实例（模拟重启前的 SW，执行悬挂中）
    const executor1 = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor1 as any, 'executeBackupAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '重启前执行完成' };
    });
    const firstRun = executor1.executeTask(taskId);
    const lease = await waitForLease(taskId);

    // 执行租约已到期：原执行已失去运行所有权
    await browser.storage.local.set({
      [leaseKey(taskId)]: { ...lease, expiresAt: Date.now() - 1 },
    });

    // 模拟 Service Worker 重启：重建执行引擎实例并重新初始化
    TaskExecutor.resetForTesting();
    const executor2 = TaskExecutor.getInstance();
    await executor2.init();

    // 遗留执行恢复为"执行中断"并写入执行历史
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.lastExecution?.outcome).toBe(ExecutionOutcome.INTERRUPTED);
    expect(task.history.lastExecution?.success).toBe(false);
    expect(task.history.lastExecution?.source).toBe('manual');

    // 执行中断只记录结果，不改变启用状态：任务保持 ENABLED
    expect(task.status).toBe(TaskStatus.ENABLED);

    // 已到期租约被清理，快照（执行输入）已清理
    expect(await readLease(taskId)).toBeUndefined();
    expect(await executor2.getPendingSnapshot(taskId)).toBeNull();

    // 中断后任务仍启用：可以再次发起执行，不会因一次中断永久停掉自动任务
    jest.spyOn(executor2 as any, 'executeBackupAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '中断后重新执行完成',
    });
    const rerun = await executor2.executeTask(taskId);
    expect(rerun.success).toBe(true);

    // 清理重启前的悬挂执行
    gate.resolve();
    await firstRun;
  });

  test('验收4：无遗留执行的 RUNNING 残留恢复为 ENABLED 且不重复写入历史', async () => {
    const taskId = 'recover_stale_running_task';
    await createBackupTask(taskId);

    // 超时收尾后：执行结果已写入历史，启用状态已恢复 ENABLED
    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ actionTimeouts: { backup: 30 } });
    hangExecution(executor);
    const result = await executor.executeTask(taskId);
    expect(result.outcome).toBe(ExecutionOutcome.UNCERTAIN);
    expect((await taskService.getTaskById(taskId)).data.status).toBe(TaskStatus.ENABLED);

    // 模拟收尾前 SW 中断留下的 RUNNING 残留（无快照、无执行租约）
    await taskService.setTaskStatus(taskId, TaskStatus.RUNNING);

    // 模拟 Service Worker 重启：重建执行引擎实例并重新初始化
    TaskExecutor.resetForTesting();
    const executor2 = TaskExecutor.getInstance();
    await executor2.init();

    // 无遗留执行：RUNNING 状态残留被恢复为 ENABLED，不重复写入历史
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    expect(task.history.executions.length).toBe(1);
    expect(task.history.lastExecution?.outcome).toBe(ExecutionOutcome.UNCERTAIN);
  });

  test('验收5：结果不确定的执行不会被自动重试', async () => {
    const taskId = 'uncertain_no_retry_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ actionTimeouts: { backup: 30 }, maxRetries: 3 });
    const backupSpy = hangExecution(executor);
    const executeSpy = jest.spyOn(executor, 'executeTask');

    const result = await executor.executeTask(taskId);

    expect(result.outcome).toBe(ExecutionOutcome.UNCERTAIN);
    // 动作执行器只调用一次，executeTask 无递归重试
    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  test('验收6：三态结果模型——成功/失败结果按 success 兼容推断 outcome 并写入历史', async () => {
    const executor = TaskExecutor.getInstance();

    // 成功路径：历史记录携带 outcome=success，任务状态为 ENABLED
    const successId = 'outcome_success_task';
    await createBackupTask(successId);
    jest.spyOn(executor as any, 'executeBackupAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '备份成功',
    });
    const successResult = await executor.executeTask(successId);
    expect(successResult.outcome).toBe(ExecutionOutcome.SUCCESS);

    const successTask = (await taskService.getTaskById(successId)).data as Task;
    expect(successTask.history.lastExecution?.outcome).toBe(ExecutionOutcome.SUCCESS);
    expect(successTask.status).toBe(TaskStatus.ENABLED);

    // 失败路径：历史记录携带 outcome=failure，启用状态保持 ENABLED
    const failureId = 'outcome_failure_task';
    await createBackupTask(failureId);
    jest.spyOn(executor as any, 'executeBackupAction').mockResolvedValue({
      success: false,
      timestamp: Date.now(),
      error: '模拟失败',
    });
    const failureResult = await executor.executeTask(failureId);
    expect(failureResult.outcome).toBe(ExecutionOutcome.FAILURE);

    const failureTask = (await taskService.getTaskById(failureId)).data as Task;
    expect(failureTask.history.lastExecution?.outcome).toBe(ExecutionOutcome.FAILURE);
    expect(failureTask.status).toBe(TaskStatus.ENABLED);
  });
});

describe('task-executor 书签写入租约', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    jest.restoreAllMocks();
    // 每个测试使用全新实例，避免内存执行状态残留
    TaskExecutor.resetForTesting();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const readWriteLease = async (): Promise<any> => {
    const result = await browser.storage.local.get(BOOKMARK_WRITE_LEASE_KEY);
    return result[BOOKMARK_WRITE_LEASE_KEY];
  };

  // 等待书签写入租约写入 storage.local
  const waitForWriteLease = async (): Promise<any> => {
    for (let i = 0; i < 200; i++) {
      const lease = await readWriteLease();
      if (lease) {
        return lease;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('等待书签写入租约超时');
  };

  const createOrganizeTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `写入租约测试任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createOrganizeAction(),
    });
  };

  const createRestoreTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `恢复测试任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('restore'),
    });
  };

  test('验收1：两个修改书签树的任务并发时，手动触发的第二个被写入租约阻止并得到提示，不产生执行历史', async () => {
    const holderId = 'write_lease_org_holder';
    const blockedId = 'write_lease_org_blocked';
    await createOrganizeTask(holderId);
    await createOrganizeTask(blockedId);

    const executor = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor as any, 'executeOrganizeAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '整理完成' };
    });

    const firstRun = executor.executeTask(holderId, 0, 'manual');

    // 写入租约已获取：包含持有任务ID、执行ID、获取时间、到期时间
    const lease = await waitForWriteLease();
    expect(lease.taskId).toBe(holderId);
    expect(lease.executionId).toBeTruthy();
    expect(lease.acquiredAt).toBeLessThanOrEqual(Date.now());
    expect(lease.expiresAt).toBeGreaterThan(Date.now());

    // 第二个写入任务（手动触发）被写入租约阻止，返回失败并带清晰提示
    const blocked = await executor.executeTask(blockedId, 0, 'manual');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('请稍后重试');

    // 被阻止的请求不产生执行历史
    const blockedTask = (await taskService.getTaskById(blockedId)).data as Task;
    expect(blockedTask.history.executions.length).toBe(0);

    // 放行原执行
    gate.resolve();
    const firstResult = await firstRun;
    expect(firstResult.success).toBe(true);

    // 写入任务正常结束后写入租约被释放
    expect(await readWriteLease()).toBeUndefined();
  });

  test('验收1：两个修改书签树的任务并发时，事件触发的第二个被写入租约阻止并跳过（不产生执行历史）', async () => {
    const holderId = 'write_lease_org_holder2';
    const blockedId = 'write_lease_org_blocked2';
    await createOrganizeTask(holderId);
    await createOrganizeTask(blockedId);

    const executor = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor as any, 'executeOrganizeAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '整理完成' };
    });

    const firstRun = executor.executeTask(holderId, 0, 'event');
    await waitForWriteLease();

    // 第二个写入任务（事件触发）被跳过：返回失败，提示本次执行被跳过
    const blocked = await executor.executeTask(blockedId, 0, 'event');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('被跳过');

    // 被跳过的请求不产生执行历史
    const blockedTask = (await taskService.getTaskById(blockedId)).data as Task;
    expect(blockedTask.history.executions.length).toBe(0);

    gate.resolve();
    await firstRun;
  });

  test('验收1：BACKUP/restore 与 ORGANIZE 同属写入操作，互相被写入租约阻止', async () => {
    const restoreId = 'write_lease_restore_holder';
    const organizeId = 'write_lease_org_blocked3';
    await createRestoreTask(restoreId);
    await createOrganizeTask(organizeId);

    const executor = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '恢复完成' };
    });

    const firstRun = executor.executeTask(restoreId, 0, 'manual');

    // 恢复任务同样获取写入租约
    const lease = await waitForWriteLease();
    expect(lease.taskId).toBe(restoreId);

    // 整理任务被恢复任务持有的写入租约阻止
    const blocked = await executor.executeTask(organizeId, 0, 'manual');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain('请稍后重试');

    gate.resolve();
    const firstResult = await firstRun;
    expect(firstResult.success).toBe(true);
  });

  test('验收2：只读/上传任务（备份、推送、选择性推送）在写入任务执行期间仍可并行执行，且不获取写入租约', async () => {
    const holderId = 'write_lease_parallel_org';
    await createOrganizeTask(holderId);

    const executor = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor as any, 'executeOrganizeAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '整理完成' };
    });

    const firstRun = executor.executeTask(holderId, 0, 'manual');
    const lease = await waitForWriteLease();
    expect(lease.taskId).toBe(holderId);

    // 备份（上传）、推送、选择性推送任务在写入任务执行期间仍可执行
    await taskService.createTask({
      id: 'write_lease_parallel_backup',
      name: '备份任务',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('backup'),
    });
    await taskService.createTask({
      id: 'write_lease_parallel_push',
      name: '推送任务',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createPushAction(),
    });
    await taskService.createTask({
      id: 'write_lease_parallel_selective',
      name: '选择性推送任务',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createSelectivePushAction('menav', 'bookmarks', '选择性推送'),
    });

    jest.spyOn(executor as any, 'executeBackupAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '备份完成',
    });
    jest.spyOn(executor as any, 'executePushAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '推送完成',
    });
    jest.spyOn(executor as any, 'executeSelectivePush').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '选择性推送完成',
    });

    const backupResult = await executor.executeTask('write_lease_parallel_backup', 0, 'manual');
    expect(backupResult.success).toBe(true);

    const pushResult = await executor.executeTask('write_lease_parallel_push', 0, 'manual');
    expect(pushResult.success).toBe(true);

    const selectiveResult = await executor.executeTask('write_lease_parallel_selective', 0, 'manual');
    expect(selectiveResult.success).toBe(true);

    // 写入任务持有的写入租约未被只读/上传任务改写或释放
    expect((await readWriteLease()).taskId).toBe(holderId);

    gate.resolve();
    await firstRun;
  });

  test('验收3：写入任务正常结束后写入租约被释放，后续写入任务可执行', async () => {
    const firstId = 'write_lease_release_first';
    const secondId = 'write_lease_release_second';
    await createOrganizeTask(firstId);
    await createOrganizeTask(secondId);

    const executor = TaskExecutor.getInstance();
    jest.spyOn(executor as any, 'executeOrganizeAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '整理完成',
    });

    // 第一次写入任务执行
    const firstResult = await executor.executeTask(firstId, 0, 'manual');
    expect(firstResult.success).toBe(true);

    // 执行正常结束后写入租约被释放
    expect(await readWriteLease()).toBeUndefined();

    // 后续写入任务可执行
    const secondResult = await executor.executeTask(secondId, 0, 'manual');
    expect(secondResult.success).toBe(true);
  });

  test('验收4：模拟 SW 重启后，未到期的写入租约仍阻止新写入任务；租约到期后恢复可执行', async () => {
    const holderId = 'write_lease_restart_holder';
    const blockedId = 'write_lease_restart_blocked';
    await createOrganizeTask(holderId);
    await createOrganizeTask(blockedId);

    // 重启前的执行引擎实例（模拟重启前的 SW）
    const executor1 = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor1 as any, 'executeOrganizeAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '重启前执行完成' };
    });

    const firstRun = executor1.executeTask(holderId, 0, 'manual');
    const lease = await waitForWriteLease();
    expect(lease.taskId).toBe(holderId);

    // 模拟 Service Worker 重启：重建执行引擎实例并重新初始化
    TaskExecutor.resetForTesting();
    const executor2 = TaskExecutor.getInstance();
    await executor2.init();

    // 未到期的写入租约仍然阻止新写入任务（手动触发得到提示）
    jest.spyOn(executor2 as any, 'executeOrganizeAction').mockResolvedValue({
      success: true,
      timestamp: Date.now(),
      details: '重启后执行完成',
    });
    const rejected = await executor2.executeTask(blockedId, 0, 'manual');
    expect(rejected.success).toBe(false);
    expect(rejected.error).toContain('请稍后重试');

    // 租约到期后，重启后的执行引擎可以再次发起写入任务
    const currentLease = await readWriteLease();
    await browser.storage.local.set({
      [BOOKMARK_WRITE_LEASE_KEY]: { ...currentLease, expiresAt: Date.now() - 1 },
    });
    const afterExpiry = await executor2.executeTask(blockedId, 0, 'manual');
    expect(afterExpiry.success).toBe(true);

    // 清理重启前的悬挂执行
    gate.resolve();
    await firstRun;
  });

  test('验收1：写入租约无法可靠保存时，执行请求不被接受、不产生执行历史且不残留执行租约', async () => {
    const taskId = 'write_lease_acquire_fail_task';
    await createOrganizeTask(taskId);

    const executor = TaskExecutor.getInstance();
    jest.spyOn(executor as any, 'acquireBookmarkWriteLease').mockResolvedValue({
      success: false,
    });

    const result = await executor.executeTask(taskId, 0, 'manual');
    expect(result.success).toBe(false);
    expect(result.error).toBe('获取书签写入租约失败');

    // 被拒绝的请求不产生执行历史，也不残留执行租约
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.executions.length).toBe(0);
    const executionLeaseResult = await browser.storage.local.get(`${EXECUTION_LEASE_KEY_PREFIX}${taskId}`);
    expect(executionLeaseResult[`${EXECUTION_LEASE_KEY_PREFIX}${taskId}`]).toBeUndefined();
  });
});

describe('task-executor 重试策略', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    jest.restoreAllMocks();
    // 每个测试使用全新实例，避免内存执行状态残留
    TaskExecutor.resetForTesting();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const leaseKey = (taskId: string) => `${EXECUTION_LEASE_KEY_PREFIX}${taskId}`;

  const createBackupTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `重试策略测试任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('backup'),
    });
  };

  const readLease = async (taskId: string): Promise<any> => {
    const result = await browser.storage.local.get(leaseKey(taskId));
    return result[leaseKey(taskId)];
  };

  test('验收1：网络等临时性失败在租约有效期内按配置重试，重试延续同一执行租约', async () => {
    const taskId = 'retry_within_lease_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let callCount = 0;
    const leaseIds: string[] = [];
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      // 每次执行尝试开始时本执行仍持有租约
      const lease = await readLease(taskId);
      leaseIds.push(lease?.executionId);
      if (callCount === 1) {
        // 结果携带结构化可重试性标记（临时性失败，如网络错误）
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: 'GitHub备份失败: 网络错误: Failed to fetch',
        };
      }
      return { success: true, timestamp: Date.now(), details: '备份成功' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(result.success).toBe(true);
    // 首次尝试 + 1 次重试
    expect(backupSpy).toHaveBeenCalledTimes(2);
    // 重试属于同一任务执行：延续执行租约，executionId 不变（未覆盖获取新租约）
    expect(leaseIds.length).toBe(2);
    expect(leaseIds[0]).toBe(leaseIds[1]);
    // 执行正常结束后租约被释放
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('验收1、4：抛出的结构化 RetryableError（网络分类）在租约期内重试，判定不依赖错误消息', async () => {
    const taskId = 'retry_structured_error_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // 结构化错误：分类明确（网络），消息不含任何旧的关键词
        throw new RetryableError(RetryableErrorCategory.NETWORK, '完全无关的错误消息内容');
      }
      return { success: true, timestamp: Date.now(), details: '备份成功' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(result.success).toBe(true);
    expect(backupSpy).toHaveBeenCalledTimes(2);
  });

  test('验收1：限流错误（GitHubApiError 429）在租约期内重试，其余 4xx（如 401）不重试', async () => {
    const rateLimitId = 'retry_rate_limit_task';
    await createBackupTask(rateLimitId);
    const credentialErrorId = 'retry_credential_error_task';
    await createBackupTask(credentialErrorId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    // 429 限流：可重试，重试后成功
    let rateLimitCalls = 0;
    const rateLimitSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      rateLimitCalls++;
      if (rateLimitCalls === 1) {
        throw new GitHubApiError(429, 'API rate limit exceeded');
      }
      return { success: true, timestamp: Date.now(), details: '备份成功' };
    });
    const rateLimitResult = await executor.executeTask(rateLimitId, 0, 'manual');
    expect(rateLimitResult.success).toBe(true);
    expect(rateLimitSpy).toHaveBeenCalledTimes(2);

    // 401 凭据错误：不可重试，只执行一次并按失败收尾
    // （与上面共用同一 spy，先清空调用计数）
    const credentialSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      throw new GitHubApiError(401, 'Bad credentials');
    });
    credentialSpy.mockClear();
    const credentialResult = await executor.executeTask(credentialErrorId, 0, 'manual');
    expect(credentialSpy).toHaveBeenCalledTimes(1);
    expect(credentialResult.success).toBe(false);
    expect(credentialResult.outcome).toBe(ExecutionOutcome.FAILURE);
  });

  test('验收1：executeTaskWithData 同样在租约期内重试', async () => {
    const taskId = 'retry_with_data_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const task = (await taskService.getTaskById(taskId)).data as Task;
    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new RetryableError(RetryableErrorCategory.NETWORK, '模拟网络错误');
      }
      return { success: true, timestamp: Date.now(), details: '备份成功' };
    });

    const result = await executor.executeTaskWithData(task, 0, 'manual');

    expect(result.success).toBe(true);
    expect(backupSpy).toHaveBeenCalledTimes(2);
  });

  test('P1：重试链使用首次固化的任务定义，重试窗口内编辑任务不影响本次执行', async () => {
    const taskId = 'retry_snapshot_isolation_task';
    const action = createBackupAction('backup') as BackupAction;
    action.options.commitMessage = '首次固化的配置';
    await taskService.createTask({
      id: taskId,
      name: '重试快照隔离测试',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action,
    });

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const usedMessages: string[] = [];
    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async (task: unknown) => {
      callCount++;
      const currentTask = task as Task;
      usedMessages.push((currentTask.action as BackupAction).options.commitMessage ?? '');
      if (callCount === 1) {
        // 重试窗口内任务被编辑：持久化配置变化不应影响本次执行
        const editedAction = createBackupAction('backup') as BackupAction;
        editedAction.options.commitMessage = '重试窗口内的新配置';
        await taskService.updateTask(taskId, { action: editedAction });
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '备份成功' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(result.success).toBe(true);
    expect(backupSpy).toHaveBeenCalledTimes(2);
    // 首次尝试与重试都使用执行开始时的任务定义
    expect(usedMessages).toEqual(['首次固化的配置', '首次固化的配置']);
    const persisted = (await taskService.getTaskById(taskId)).data as Task;
    expect((persisted.action as BackupAction).options.commitMessage).toBe('重试窗口内的新配置');
  });

  test('P1：选择性推送重试保留执行输入（selections），不回退为持久化配置', async () => {
    const taskId = 'retry_selective_input_task';
    await taskService.createTask({
      id: taskId,
      name: '选择性推送重试',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createSelectivePushAction('menav', 'bookmarks', '选择性推送'),
    });

    const task = (await taskService.getTaskById(taskId)).data as Task;
    const selections: BookmarkSelection[] = [
      { id: 'bm1', title: '书签1', type: 'bookmark', url: 'https://example.com/1' },
      { id: 'bm2', title: '书签2', type: 'bookmark', url: 'https://example.com/2' },
    ];
    const selectiveAction = task.action as SelectivePushAction;
    const taskWithSelections: Task = {
      ...task,
      action: {
        ...selectiveAction,
        options: {
          ...selectiveAction.options,
          selections,
        },
      },
    };

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const observedSelectionCounts: number[] = [];
    let callCount = 0;
    const selectiveSpy = jest.spyOn(executor as any, 'executeSelectivePush').mockImplementation(async (t: unknown) => {
      callCount++;
      const currentTask = t as Task;
      observedSelectionCounts.push(((currentTask.action as SelectivePushAction).options.selections ?? []).length);
      if (callCount === 1) {
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '推送成功' };
    });

    const result = await executor.executeTaskWithData(taskWithSelections, 0, 'manual');

    expect(result.success).toBe(true);
    expect(selectiveSpy).toHaveBeenCalledTimes(2);
    // 重试仍能读到本次选择的书签，而非持久化配置中的空值
    expect(observedSelectionCounts).toEqual([2, 2]);
    const persisted = (await taskService.getTaskById(taskId)).data as Task;
    expect((persisted.action as SelectivePushAction).options.selections).toBeUndefined();
  });

  test('P1：恢复任务重试保留执行输入（backupFilePath），不回退为持久化配置', async () => {
    const taskId = 'retry_restore_input_task';
    const action = createBackupAction('restore') as BackupAction;
    action.options.backupFilePath = '';
    await taskService.createTask({
      id: taskId,
      name: '恢复重试',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action,
    });

    const persistedTask = (await taskService.getTaskById(taskId)).data as Task;
    const selectedFilePath = 'backups/bookmarks-2026-11-15.html';
    const taskWithFile: Task = {
      ...persistedTask,
      action: {
        ...(persistedTask.action as BackupAction),
        options: {
          ...(persistedTask.action as BackupAction).options,
          backupFilePath: selectedFilePath,
        },
      },
    };

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const observedPaths: Array<string | undefined> = [];
    const snapshotPaths: Array<string | undefined> = [];
    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async (t: unknown) => {
      callCount++;
      const currentTask = t as Task;
      observedPaths.push((currentTask.action as BackupAction).options.backupFilePath);
      // 执行输入随快照持久化，SW 中断后仍可从快照读取
      const snapshot = await executor.getPendingSnapshot(taskId);
      snapshotPaths.push(((snapshot?.task.action as BackupAction | undefined)?.options)?.backupFilePath);
      if (callCount === 1) {
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '恢复成功' };
    });

    const result = await executor.executeTaskWithData(taskWithFile, 0, 'manual');

    expect(result.success).toBe(true);
    expect(backupSpy).toHaveBeenCalledTimes(2);
    // 重试仍使用本次选择的备份文件，而非持久化配置中的空路径
    expect(observedPaths).toEqual([selectedFilePath, selectedFilePath]);
    // 执行输入已纳入执行快照，可用于 SW 中断后的恢复判定
    expect(snapshotPaths).toEqual([selectedFilePath, selectedFilePath]);
    const persisted = (await taskService.getTaskById(taskId)).data as Task;
    expect((persisted.action as BackupAction).options.backupFilePath).toBe('');
  });

  test('P2：重试链为每次执行尝试续期执行租约，累计耗时超过原租约时长仍可重试', async () => {
    const taskId = 'retry_lease_renewal_task';
    await createBackupTask(taskId);

    // 用可控时钟模拟执行耗时推进，避免依赖实时余量造成 CI 抖动
    const baseNow = Date.now();
    let timeOffset = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => baseNow + timeOffset);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 2 });

    const renewSpy = jest.spyOn(taskExecutorLease, 'renewExecutionLease');

    let callCount = 0;
    const leaseIds: string[] = [];
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      const lease = await readLease(taskId);
      leaseIds.push(lease?.executionId);
      if (callCount === 1) {
        // 首次尝试已消耗大部分租约：剩余有效期 450ms
        await browser.storage.local.set({
          [leaseKey(taskId)]: { ...(lease as object), expiresAt: Date.now() + 450 },
        });
        // 第二次尝试开始时（300ms）租约仍有效
        timeOffset = 300;
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      if (callCount === 2) {
        // 第三次尝试开始时（600ms）未续期租约已到期，续期后仍有效
        timeOffset = 600;
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '备份成功' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    // 首次尝试 + 2 次重试：第三次尝试开始时已超过未续期租约的到期时间
    expect(result.success).toBe(true);
    expect(backupSpy).toHaveBeenCalledTimes(3);
    // 每次重试尝试各续期一次，共 2 次
    expect(renewSpy).toHaveBeenCalledTimes(2);
    // 重试延续同一执行租约，未重新获取
    expect(new Set(leaseIds).size).toBe(1);
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('P1：第一次尝试期间禁用任务后重试，不覆盖 DISABLED 状态', async () => {
    const taskId = 'retry_disabled_during_first_attempt';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // 第一次尝试期间用户禁用任务，随后失败进入正常重试
        await taskService.setTaskStatus(taskId, TaskStatus.DISABLED);
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '重试成功' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(result.success).toBe(true);
    // 重试正常执行（同一任务执行的后续尝试），但状态不覆盖用户的禁用意图
    expect(backupSpy).toHaveBeenCalledTimes(2);
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.DISABLED);
    expect(task.history.executions.length).toBe(1);
    expect(task.history.lastExecution?.success).toBe(true);
  });

  test('P2：续期发现其他执行已接管时，不改状态/历史且不删除新执行快照', async () => {
    const taskId = 'retry_lease_taken_over_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const otherExecutionId = 'other-execution';
    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const task = (await taskService.getTaskById(taskId)).data as Task;
        // 模拟其他执行在重试窗口内合法接管：持有未到期租约并写入自己的快照
        await browser.storage.local.set({
          [leaseKey(taskId)]: {
            taskId,
            executionId: otherExecutionId,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + 120000,
          },
          execution_snapshots: {
            [taskId]: {
              taskId,
              task: { ...task, name: '其他执行的快照' },
              source: 'event',
              createdAt: Date.now(),
            },
          },
        });
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '不应执行' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    // 原执行停止重试，且不产生第二次执行尝试
    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('接管');
    // 不改写任务状态/历史：由接管的新执行负责
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.RUNNING);
    expect(task.history.executions.length).toBe(0);
    // 不删除新执行写入的快照与租约
    const snapshot = await executor.getPendingSnapshot(taskId);
    expect(snapshot?.task.name).toBe('其他执行的快照');
    expect(snapshot?.source).toBe('event');
    expect((await readLease(taskId))?.executionId).toBe(otherExecutionId);
  });

  test('P2：租约由其他执行持有且已到期时，按接管处理，不清理状态/快照', async () => {
    const taskId = 'retry_foreign_expired_lease_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const foreignExecutionId = 'foreign-expired-execution';
    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const task = (await taskService.getTaskById(taskId)).data as Task;
        // 其他执行的租约已到期，但仍不属于本执行
        await browser.storage.local.set({
          [leaseKey(taskId)]: {
            taskId,
            executionId: foreignExecutionId,
            acquiredAt: Date.now() - 200000,
            expiresAt: Date.now() - 1000,
          },
          execution_snapshots: {
            [taskId]: {
              taskId,
              task: { ...task, name: '其他执行的快照' },
              source: 'event',
              createdAt: Date.now(),
            },
          },
        });
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '不应执行' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    // 非本执行的租约无论是否到期都按接管处理：不改状态/历史，不删快照
    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('接管');
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.RUNNING);
    expect(task.history.executions.length).toBe(0);
    expect((await executor.getPendingSnapshot(taskId))?.task.name).toBe('其他执行的快照');
    expect((await readLease(taskId))?.executionId).toBe(foreignExecutionId);
  });

  test('P2：清理前二次校验发现他人未到期租约时跳过清理', async () => {
    const taskId = 'retry_secondary_check_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    // 续期读到本执行的已到期租约；清理前的二次校验读到他人未到期租约
    const foreignActiveLease = {
      taskId,
      executionId: 'foreign-active-execution',
      acquiredAt: Date.now(),
      expiresAt: Date.now() + 120000,
    };
    let afterFirstAttempt = false;
    let leaseReadsAfterFirstAttempt = 0;
    const originalGetStorageData = storageService.getStorageData.bind(storageService);
    jest.spyOn(storageService, 'getStorageData').mockImplementation(async (key: string) => {
      if (key === leaseKey(taskId) && afterFirstAttempt) {
        leaseReadsAfterFirstAttempt++;
        // 第一次是续期读取（返回真实的已到期租约），第二次是清理前二次校验
        if (leaseReadsAfterFirstAttempt >= 2) {
          return { success: true, data: foreignActiveLease };
        }
      }
      return originalGetStorageData(key);
    });

    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // 本执行租约在第一次尝试后到期
        const lease = await readLease(taskId);
        await browser.storage.local.set({
          [leaseKey(taskId)]: { ...(lease as object), expiresAt: Date.now() - 1 },
        });
        afterFirstAttempt = true;
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '不应执行' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('接管');
    // 二次校验发现他人租约：不覆盖状态/历史，不删除快照，不释放/改写租约
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.RUNNING);
    expect(task.history.executions.length).toBe(0);
    expect(await executor.getPendingSnapshot(taskId)).not.toBeNull();
    const storedLease = await readLease(taskId);
    expect(storedLease?.executionId).not.toBe(foreignActiveLease.executionId);
    expect(storedLease.expiresAt).toBeLessThanOrEqual(Date.now());
  });

  test('P2：任务在重试窗口被删除时终止重试，并清理快照与执行租约', async () => {
    const taskId = 'retry_task_deleted_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // 第一次尝试失败后、重试开始前任务被删除
        await taskService.deleteTask(taskId);
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '不应执行' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('停止重试');
    // 任务已删除：不再执行动作，也不写历史/状态
    expect((await taskService.getTaskById(taskId)).success).toBe(false);
    // 删除任务时已清理执行状态，重试终止后不留孤儿快照与租约
    expect(await executor.getPendingSnapshot(taskId)).toBeNull();
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('P2：任务存在性检查瞬时读取失败时重读一次并继续重试', async () => {
    const taskId = 'retry_task_read_transient_failure';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let failNextTaskRead = false;
    const originalGetStorageData = storageService.getStorageData.bind(storageService);
    jest.spyOn(storageService, 'getStorageData').mockImplementation(async (key: string) => {
      if (failNextTaskRead && key === 'tasks_data') {
        // 只失败一次：重读时应成功
        failNextTaskRead = false;
        return { success: false, error: '模拟瞬时读取失败' };
      }
      return originalGetStorageData(key);
    });

    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        failNextTaskRead = true;
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '重试成功' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    // 重读成功后继续重试，不把瞬时读取失败当作任务删除
    expect(result.success).toBe(true);
    expect(backupSpy).toHaveBeenCalledTimes(2);
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.lastExecution?.success).toBe(true);
  });

  test('P2：续期存储写入失败但租约仍归本执行时，释放租约避免阻塞', async () => {
    const taskId = 'retry_renewal_storage_error_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let failLeaseWrite = false;
    const originalSetStorageData = storageService.setStorageData.bind(storageService);
    jest.spyOn(storageService, 'setStorageData').mockImplementation(async (key: string, data: any) => {
      if (failLeaseWrite && key === leaseKey(taskId)) {
        return { success: false, error: '模拟存储写入失败' };
      }
      return originalSetStorageData(key, data);
    });

    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      // 第一次尝试后让续期写入失败（读取仍成功，可确认租约归属）
      failLeaseWrite = true;
      return {
        success: false,
        timestamp: Date.now(),
        retryable: true,
        error: '网络错误',
      };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('停止重试');
    // 按失败收尾：结果写入历史，启用状态保持 ENABLED
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    expect(task.history.executions.length).toBe(1);
    // 快照清理，且仍归本执行的租约被释放，不阻塞后续执行 120 秒
    expect(await executor.getPendingSnapshot(taskId)).toBeNull();
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('P2：续期读取失败无法确认归属时，不触碰状态/历史/快照', async () => {
    const taskId = 'retry_renewal_storage_read_error_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let failLeaseRead = false;
    const originalGetStorageData = storageService.getStorageData.bind(storageService);
    jest.spyOn(storageService, 'getStorageData').mockImplementation(async (key: string) => {
      if (failLeaseRead && key === leaseKey(taskId)) {
        return { success: false, error: '模拟存储读取失败' };
      }
      return originalGetStorageData(key);
    });

    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      // 第一次尝试后让续期读取失败：无法确认租约是否仍归本执行
      failLeaseRead = true;
      return {
        success: false,
        timestamp: Date.now(),
        retryable: true,
        error: '网络错误',
      };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('无法确认');
    // 归属未知：不改写任务状态/历史，也不删除快照
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.RUNNING);
    expect(task.history.executions.length).toBe(0);
    expect(await executor.getPendingSnapshot(taskId)).not.toBeNull();
  });

  test('验收2：重试前执行租约已失效，停止重试并按失败收尾', async () => {
    const taskId = 'retry_lease_expired_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      // 本次执行尝试后租约到期：模拟重试窗口内租约失效（原执行已失去运行所有权）
      const lease = (await browser.storage.local.get(leaseKey(taskId)))[leaseKey(taskId)];
      await browser.storage.local.set({
        [leaseKey(taskId)]: { ...(lease as object), expiresAt: Date.now() - 1 },
      });
      return {
        success: false,
        timestamp: Date.now(),
        retryable: true,
        error: 'GitHub备份失败: 网络错误',
      };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    // 只执行首次尝试，租约失效后不再发起重试
    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.outcome).toBe(ExecutionOutcome.FAILURE);
    expect(result.error).toContain('停止重试');
    // 按失败收尾：历史只记录最终失败，启用状态保持 ENABLED
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    expect(task.history.executions.length).toBe(1);
    expect(task.history.lastExecution?.outcome).toBe(ExecutionOutcome.FAILURE);
    // 重试链在此终止：执行快照必须清理，不能因外层 finally 跳过快照删除而残留
    expect(await executor.getPendingSnapshot(taskId)).toBeNull();
    const snapshotStorage = await browser.storage.local.get('execution_snapshots');
    expect(
      (snapshotStorage.execution_snapshots as Record<string, unknown> | undefined)?.[taskId]
    ).toBeUndefined();
  });

  test('验收3：结果不确定的执行不会重试，即使结果携带可重试标记', async () => {
    const taskId = 'retry_uncertain_no_retry_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockResolvedValue({
      success: false,
      timestamp: Date.now(),
      outcome: ExecutionOutcome.UNCERTAIN,
      retryable: true, // 干扰项：即使标记可重试，结果不确定也绝不进入重试
      error: '执行超时，结果不确定',
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.outcome).toBe(ExecutionOutcome.UNCERTAIN);
    // 结果不确定不改变启用状态
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
  });

  test('验收4：错误消息包含旧关键词（timeout/network）不再触发重试，判定仅依赖结构化信息', async () => {
    const taskId = 'retry_no_string_matching_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      // 普通错误，消息包含旧字符串匹配关键词：新判定不重试
      throw new Error('GitHub API error: connection timeout - temporarily unavailable');
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.outcome).toBe(ExecutionOutcome.FAILURE);
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
  });

  test('验收1：达到重试上限后停止重试，按失败收尾且历史只记录最终失败', async () => {
    const taskId = 'retry_limit_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 2 });

    // 每次调用返回新的结果对象（避免各重试层共享同一对象引用导致 details 相互覆盖）
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => ({
      success: false,
      timestamp: Date.now(),
      retryable: true,
      error: 'GitHub备份失败: 网络错误',
    }));

    const result = await executor.executeTask(taskId, 0, 'manual');

    // 首次尝试 + 2 次重试 = 3 次，随后按失败收尾
    expect(backupSpy).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
    expect(result.outcome).toBe(ExecutionOutcome.FAILURE);
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    // 重试属于同一任务执行：历史只记录最终失败结果
    expect(task.history.executions.length).toBe(1);
    expect(task.history.lastExecution?.details).toContain('已重试 2 次');
    // 执行结束后租约被释放
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('验收1：重试期间新执行请求被执行租约拒绝（重试延续租约，不释放所有权）', async () => {
    const taskId = 'retry_lease_holds_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 50, maxRetries: 3 });

    const gate = createDeferred();
    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // 首次尝试失败，触发重试（重试延迟期间租约仍被本执行持有）
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: 'GitHub备份失败: 网络错误',
        };
      }
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '备份成功' };
    });

    const executionPromise = executor.executeTask(taskId, 0, 'manual');

    // 等待重试开始（第二次执行尝试），重试期间新执行请求应被拒绝
    await waitFor(() => backupSpy.mock.calls.length >= 2);
    const rejected = await executor.executeTask(taskId);
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe('任务正在执行中');

    gate.resolve();
    const result = await executionPromise;
    expect(result.success).toBe(true);
  });
});

describe('task-executor 任务删除后的执行状态清理', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    jest.restoreAllMocks();
    TaskExecutor.resetForTesting();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const leaseKey = (taskId: string) => `${EXECUTION_LEASE_KEY_PREFIX}${taskId}`;

  const readLease = async (taskId: string): Promise<any> => {
    const result = await browser.storage.local.get(leaseKey(taskId));
    return result[leaseKey(taskId)];
  };

  const buildTask = (id: string): Task => ({
    id,
    name: `清理测试任务 ${id}`,
    status: TaskStatus.ENABLED,
    createdAt: 1,
    updatedAt: 1,
    trigger: createManualTrigger('手动'),
    action: createBackupAction('backup'),
    history: { executions: [] },
  });

  const createBackupTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `清理测试任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('backup'),
    });
  };

  const buildSnapshot = (taskId: string) => ({
    taskId,
    task: buildTask(taskId),
    source: 'manual' as const,
    createdAt: Date.now(),
  });

  test('删除任务时清理该任务的执行快照、执行租约与书签写入租约', async () => {
    const taskId = 'delete_cleanup_task';
    const otherTaskId = 'delete_cleanup_other_task';
    await createBackupTask(taskId);
    await createBackupTask(otherTaskId);

    const now = Date.now();
    await browser.storage.local.set({
      execution_snapshots: {
        [taskId]: buildSnapshot(taskId),
        [otherTaskId]: buildSnapshot(otherTaskId),
      },
      [leaseKey(taskId)]: {
        taskId,
        executionId: 'delete-execution',
        acquiredAt: now,
        expiresAt: now + 120000,
      },
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId,
        executionId: 'delete-execution',
        acquiredAt: now,
        expiresAt: now + 120000,
      },
    });

    const result = await taskService.deleteTask(taskId);

    expect(result.success).toBe(true);
    const stored = await browser.storage.local.get(null);
    const snapshots = stored.execution_snapshots as Record<string, unknown>;
    // 只清理被删除任务的快照，其他任务的快照保留
    expect(snapshots[taskId]).toBeUndefined();
    expect(snapshots[otherTaskId]).toBeDefined();
    expect(stored[leaseKey(taskId)]).toBeUndefined();
    expect(stored[BOOKMARK_WRITE_LEASE_KEY]).toBeUndefined();
  });

  test('删除任务不影响其他任务持有的书签写入租约', async () => {
    const taskId = 'delete_cleanup_keep_write_lease';
    await createBackupTask(taskId);

    const now = Date.now();
    await browser.storage.local.set({
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId: 'other_write_task',
        executionId: 'other-execution',
        acquiredAt: now,
        expiresAt: now + 120000,
      },
    });

    const result = await taskService.deleteTask(taskId);

    expect(result.success).toBe(true);
    const stored = await browser.storage.local.get(BOOKMARK_WRITE_LEASE_KEY);
    expect(stored[BOOKMARK_WRITE_LEASE_KEY]).toEqual(expect.objectContaining({
      taskId: 'other_write_task',
    }));
  });

  test('重试前任务被直接移除时，确认删除后清理残留快照与租约', async () => {
    const taskId = 'retry_task_removed_directly';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // 绕过 deleteTask，直接删除任务存储，模拟旧版本残留或清理失败的孤儿状态
        const stored = await browser.storage.local.get('tasks_data');
        const taskStorage = stored.tasks_data as { tasks: Record<string, Task> };
        delete taskStorage.tasks[taskId];
        await browser.storage.local.set({ tasks_data: taskStorage });
        return {
          success: false,
          timestamp: Date.now(),
          retryable: true,
          error: '网络错误',
        };
      }
      return { success: true, timestamp: Date.now(), details: '不应执行' };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('任务不存在');
    // 重试层确认任务已删除后，清理本次执行残留
    expect(await executor.getPendingSnapshot(taskId)).toBeNull();
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('init 清理已删除任务的过期/缺失执行状态，保留未到期租约', async () => {
    const expiredTaskId = 'orphan_expired_lease';
    const missingLeaseTaskId = 'orphan_missing_lease';
    const activeLeaseTaskId = 'orphan_active_lease';
    const existingTaskId = 'orphan_existing_task';
    await createBackupTask(existingTaskId);

    const now = Date.now();
    await browser.storage.local.set({
      execution_snapshots: {
        [expiredTaskId]: buildSnapshot(expiredTaskId),
        [missingLeaseTaskId]: buildSnapshot(missingLeaseTaskId),
        [activeLeaseTaskId]: buildSnapshot(activeLeaseTaskId),
        [existingTaskId]: buildSnapshot(existingTaskId),
      },
      [leaseKey(expiredTaskId)]: {
        taskId: expiredTaskId,
        executionId: 'expired-execution',
        acquiredAt: now - 200000,
        expiresAt: now - 1000,
      },
      [leaseKey(activeLeaseTaskId)]: {
        taskId: activeLeaseTaskId,
        executionId: 'active-execution',
        acquiredAt: now,
        expiresAt: now + 120000,
      },
      [BOOKMARK_WRITE_LEASE_KEY]: {
        taskId: expiredTaskId,
        executionId: 'expired-execution',
        acquiredAt: now - 200000,
        expiresAt: now - 1000,
      },
    });

    const executor = TaskExecutor.getInstance();
    await executor.init();

    const stored = await browser.storage.local.get(null);
    const snapshots = stored.execution_snapshots as Record<string, unknown>;
    expect(snapshots[expiredTaskId]).toBeUndefined();
    expect(snapshots[missingLeaseTaskId]).toBeUndefined();
    // 未到期租约可能仍由运行中的执行持有：快照与租约都保留
    expect(snapshots[activeLeaseTaskId]).toBeDefined();
    expect(stored[leaseKey(activeLeaseTaskId)]).toBeDefined();
    // 仍然存在的任务不受孤儿清理影响
    expect(snapshots[existingTaskId]).toBeDefined();
    expect(stored[leaseKey(expiredTaskId)]).toBeUndefined();
    expect(stored[BOOKMARK_WRITE_LEASE_KEY]).toBeUndefined();
  });
});

describe('task-executor bug 修复回归', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    jest.restoreAllMocks();
    // 每个测试使用全新实例，避免内存执行状态残留（模拟 SW 重启）
    TaskExecutor.resetForTesting();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const leaseKey = (taskId: string) => `${EXECUTION_LEASE_KEY_PREFIX}${taskId}`;

  const createBackupTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `回归测试任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('backup'),
    });
  };

  const createOrganizeTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `回归测试整理任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createOrganizeAction(),
    });
  };

  const createRestoreTask = async (id: string): Promise<void> => {
    await taskService.createTask({
      id,
      name: `回归测试恢复任务 ${id}`,
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动'),
      action: createBackupAction('restore'),
    });
  };

  const readLease = async (taskId: string): Promise<any> => {
    const result = await browser.storage.local.get(leaseKey(taskId));
    return result[leaseKey(taskId)];
  };

  const readWriteLease = async (): Promise<any> => {
    const result = await browser.storage.local.get(BOOKMARK_WRITE_LEASE_KEY);
    return result[BOOKMARK_WRITE_LEASE_KEY];
  };

  // 执行动作被悬挂：模拟超时后底层操作可能仍在进行
  const hangExecution = (executor: TaskExecutor): jest.SpyInstance => {
    return jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      await new Promise(() => {});
    });
  };

  test('P1-1：执行超时后执行租约保留，阻止同一任务重复执行且不写历史，快照已清理', async () => {
    const taskId = 'regression_timeout_lease_task';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ actionTimeouts: { backup: 50 } });
    hangExecution(executor);

    const result = await executor.executeTask(taskId);
    expect(result.success).toBe(false);
    expect(result.outcome).toBe(ExecutionOutcome.UNCERTAIN);

    // ① 执行历史 1 条且 outcome=uncertain，启用状态保持 ENABLED
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.executions.length).toBe(1);
    expect(task.history.lastExecution?.outcome).toBe(ExecutionOutcome.UNCERTAIN);
    expect(task.status).toBe(TaskStatus.ENABLED);

    // ② 执行租约仍保留在 storage（未在超时收尾时误删）
    const lease = await readLease(taskId);
    expect(lease).toBeTruthy();
    expect(lease.taskId).toBe(taskId);

    // ③ 超时后同一任务的再次执行被拒，且不产生新的历史记录
    const rejected = await executor.executeTask(taskId);
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe('任务正在执行中');
    const afterReject = (await taskService.getTaskById(taskId)).data as Task;
    expect(afterReject.history.executions.length).toBe(1);

    // ④ 执行输入快照已在超时收尾时清理
    expect(await executor.getPendingSnapshot(taskId)).toBeNull();
  });

  test('P1-1：恢复任务超时后书签写入租约保留，阻止其他写入任务', async () => {
    const restoreId = 'regression_timeout_restore';
    const organizeId = 'regression_timeout_organize';
    await createRestoreTask(restoreId);
    await createOrganizeTask(organizeId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ actionTimeouts: { restore: 50 } });
    hangExecution(executor);

    const result = await executor.executeTask(restoreId, 0, 'manual');
    expect(result.outcome).toBe(ExecutionOutcome.UNCERTAIN);

    // ① 超时收尾后写入租约仍保留（持有者为超时的恢复任务）
    const writeLease = await readWriteLease();
    expect(writeLease).toBeTruthy();
    expect(writeLease.taskId).toBe(restoreId);

    // ② 另一写入任务（organize，不同 taskId）被写入租约阻止（手动来源得到明确提示）
    const blocked = await executor.executeTask(organizeId, 0, 'manual');
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe('另一个任务正在修改书签树，请稍后重试');

    // 被拒请求立即释放了自己的执行租约，不残留
    expect(await readLease(organizeId)).toBeUndefined();
  });

  test('P1-2：重试被写入租约阻止后任务恢复 ENABLED（不卡 RUNNING），被拒不写历史', async () => {
    const taskId = 'regression_retry_blocked_organize';
    await createOrganizeTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const organizeSpy = jest.spyOn(executor as any, 'executeOrganizeAction').mockImplementation(async () => {
      // 首次尝试立即失败（可重试的网络错误）；同时预置另一个任务的写入租约，
      // 确保重试路径在发起第二次执行尝试前发现写入租约已被占用
      await browser.storage.local.set({
        [BOOKMARK_WRITE_LEASE_KEY]: {
          taskId: 'other',
          executionId: 'other-lease',
          acquiredAt: Date.now(),
          expiresAt: Date.now() + 120000,
        },
      });
      throw new RetryableError(RetryableErrorCategory.NETWORK, '模拟网络错误');
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    // 重试层被写入租约拒绝：只发起首次尝试，返回带明确提示的失败
    expect(organizeSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('另一个任务正在修改书签树，请稍后重试');

    // 重试层被拒时任务恢复 ENABLED（之前已被置 RUNNING），不永久卡死
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    // 被拒请求不产生执行历史，且执行租约已被释放
    expect(task.history.executions.length).toBe(0);
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('P2：重试入口租约失效时清理执行快照且保留用户的禁用意图', async () => {
    const taskId = 'regression_lease_invalid_snapshot';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      // 执行期间用户主动禁用任务
      await taskService.setTaskStatus(taskId, TaskStatus.DISABLED);
      // 重试窗口内执行租约到期
      const lease = await readLease(taskId);
      await browser.storage.local.set({
        [leaseKey(taskId)]: { ...(lease as object), expiresAt: Date.now() - 1 },
      });
      return {
        success: false,
        timestamp: Date.now(),
        retryable: true,
        error: '网络错误',
      };
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(backupSpy).toHaveBeenCalledTimes(1);
    expect(result.error).toContain('停止重试');
    // 收尾不覆盖用户的禁用意图
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.DISABLED);
    expect(task.history.executions.length).toBe(1);
    // 快照随重试链终止一并清理，不在 storage.local 残留
    expect(await executor.getPendingSnapshot(taskId)).toBeNull();
    const snapshotStorage = await browser.storage.local.get('execution_snapshots');
    expect(
      (snapshotStorage.execution_snapshots as Record<string, unknown> | undefined)?.[taskId]
    ).toBeUndefined();
  });

  test('P2：重试被写入租约阻止时保留用户的禁用意图（不覆盖为 ENABLED）', async () => {
    const taskId = 'regression_retry_blocked_disabled';
    await createOrganizeTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 10, maxRetries: 3 });

    jest.spyOn(executor as any, 'executeOrganizeAction').mockImplementation(async () => {
      // 执行期间用户主动禁用任务，同时预置其他任务的写入租约阻止重试
      await taskService.setTaskStatus(taskId, TaskStatus.DISABLED);
      await browser.storage.local.set({
        [BOOKMARK_WRITE_LEASE_KEY]: {
          taskId: 'other',
          executionId: 'other-lease',
          acquiredAt: Date.now(),
          expiresAt: Date.now() + 120000,
        },
      });
      throw new RetryableError(RetryableErrorCategory.NETWORK, '模拟网络错误');
    });

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(result.success).toBe(false);
    expect(result.error).toBe('另一个任务正在修改书签树，请稍后重试');
    // 重试被拒时恢复状态为 ENABLED，但不覆盖用户的禁用意图
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.DISABLED);
    expect(task.history.executions.length).toBe(0);
    expect(await readLease(taskId)).toBeUndefined();
  });

  test('P3：失败收尾只写入历史并恢复 ENABLED，不写入 FAILED 状态', async () => {
    const taskId = 'regression_failure_status_atomic';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    jest.spyOn(executor as any, 'executeBackupAction').mockResolvedValue({
      success: false,
      timestamp: Date.now(),
      error: '模拟不可重试失败',
    });

    const setStatusSpy = jest.spyOn(taskService, 'setTaskStatus');

    const result = await executor.executeTask(taskId, 0, 'manual');

    expect(result.success).toBe(false);
    // 执行结果只写入历史；收尾只把 RUNNING 恢复为 ENABLED，不写 FAILED
    expect(
      setStatusSpy.mock.calls.filter(([, status]) => status === TaskStatus.FAILED)
    ).toHaveLength(0);
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    expect(task.history.executions.length).toBe(1);
  });

  test('P3：禁用任务失败收尾不打印“状态为 FAILED”', async () => {
    const taskId = 'regression_disabled_failure_log';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      // 执行期间用户禁用任务，随后以不可重试错误失败
      await taskService.setTaskStatus(taskId, TaskStatus.DISABLED);
      return { success: false, timestamp: Date.now(), error: '配置错误' };
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await executor.executeTask(taskId, 0, 'manual');

    const failedStatusLogs = logSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('状态为 FAILED'));
    expect(failedStatusLogs).toHaveLength(0);
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.DISABLED);
  });

  test('P2-3：无快照 + 已到期执行租约，init 恢复 ENABLED 并清理到期租约，不写历史', async () => {
    const taskId = 'regression_nosnapshot_expired';
    await createBackupTask(taskId);
    await taskService.setTaskStatus(taskId, TaskStatus.RUNNING);
    // 预置中断残留的已到期执行租约（无快照：超时收尾时快照已被清理）
    await browser.storage.local.set({
      [leaseKey(taskId)]: {
        taskId,
        executionId: 'stale-execution',
        acquiredAt: Date.now() - 200000,
        expiresAt: Date.now() - 1000,
      },
    });

    TaskExecutor.resetForTesting();
    const executor = TaskExecutor.getInstance();
    await executor.init();

    // 无遗留执行：仅清理 RUNNING 状态残留与到期租约，不写入历史
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    expect(await readLease(taskId)).toBeUndefined();
    expect(task.history.executions.length).toBe(0);
  });

  test('P2-3：无快照 + 未到期执行租约，init 恢复 ENABLED 且租约保留（继续阻止重复执行）', async () => {
    const taskId = 'regression_nosnapshot_active';
    await createBackupTask(taskId);
    await taskService.setTaskStatus(taskId, TaskStatus.RUNNING);
    // 预置未到期执行租约（无快照）
    await browser.storage.local.set({
      [leaseKey(taskId)]: {
        taskId,
        executionId: 'active-stale',
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 120000,
      },
    });

    TaskExecutor.resetForTesting();
    const executor = TaskExecutor.getInstance();
    await executor.init();

    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    // 未到期租约保留，到期前继续阻止同一任务被重复执行
    const lease = await readLease(taskId);
    expect(lease).toBeTruthy();
    expect(lease.executionId).toBe('active-stale');
    expect(task.history.executions.length).toBe(0);
  });

  test('P2-2：重试延迟窗口内执行快照保留（中间层 finally 不误删），最终失败后清理', async () => {
    const taskId = 'regression_retry_snapshot';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    executor.updateConfig({ retryDelay: 200, maxRetries: 1 });

    const gate = createDeferred();
    let callCount = 0;
    const backupSpy = jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new RetryableError(RetryableErrorCategory.NETWORK, '模拟网络错误');
      }
      // 第二次执行尝试挂起，便于在重试窗口内断言快照状态
      await gate.promise;
      throw new RetryableError(RetryableErrorCategory.NETWORK, '模拟网络错误');
    });

    const executionPromise = executor.executeTask(taskId, 0, 'manual');

    // 等待第二次执行尝试开始（已进入重试路径）
    await waitFor(() => backupSpy.mock.calls.length >= 2);

    // 重试窗口内（重试属于同一执行）快照仍存在：未被中间层 finally 删除
    expect(await executor.getPendingSnapshot(taskId)).not.toBeNull();

    gate.resolve();
    const result = await executionPromise;

    // 重试耗尽后按失败收尾：启用状态保持 ENABLED、历史只记录最终失败、快照已清理
    expect(result.success).toBe(false);
    expect(result.outcome).toBe(ExecutionOutcome.FAILURE);
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.status).toBe(TaskStatus.ENABLED);
    expect(task.history.executions.length).toBe(1);
    expect(await executor.getPendingSnapshot(taskId)).toBeNull();
  });

  test('P1-3：同一任务并发执行请求互斥——仅一个成功，另一个被拒，历史只写 1 条', async () => {
    const taskId = 'regression_concurrent_lease';
    await createBackupTask(taskId);

    const executor = TaskExecutor.getInstance();
    const gate = createDeferred();
    jest.spyOn(executor as any, 'executeBackupAction').mockImplementation(async () => {
      await gate.promise;
      return { success: true, timestamp: Date.now(), details: '备份完成' };
    });

    // 两个执行请求同时发出：执行租约互斥保证只有一个被接受。
    // 同步调用顺序决定互斥队列排队顺序：第一个请求获得执行租约，第二个被拒。
    const firstRun = executor.executeTask(taskId, 0, 'manual');
    const secondRun = executor.executeTask(taskId, 0, 'manual');

    // 被拒请求无需等待被接受的执行完成，会立即返回
    const rejected = await secondRun;
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe('任务正在执行中');

    // 放行被接受的执行
    gate.resolve();
    const accepted = await firstRun;
    expect(accepted.success).toBe(true);

    // 被拒请求不产生历史：历史只记录被接受的那一次执行
    const task = (await taskService.getTaskById(taskId)).data as Task;
    expect(task.history.executions.length).toBe(1);
    expect(task.history.lastExecution?.success).toBe(true);
  });
});

describe('task-executor 动作级超时', () => {
  const buildTask = (action: Task['action']): Task => ({
    id: 'timeout_resolution_task',
    name: '动作级超时解析',
    status: TaskStatus.ENABLED,
    createdAt: 0,
    updatedAt: 0,
    trigger: createManualTrigger('手动'),
    action,
    history: { executions: [] },
  });

  test('按动作类型解析到不同的集中定义超时', () => {
    expect(resolveActionTimeout(buildTask(createBackupAction('backup')), DEFAULT_CONFIG))
      .toBe(ACTION_TIMEOUTS.backup);
    expect(resolveActionTimeout(buildTask(createBackupAction('restore')), DEFAULT_CONFIG))
      .toBe(ACTION_TIMEOUTS.restore);
    expect(resolveActionTimeout(buildTask(createPushAction()), DEFAULT_CONFIG))
      .toBe(ACTION_TIMEOUTS.push);
    expect(resolveActionTimeout(buildTask(createSelectivePushAction()), DEFAULT_CONFIG))
      .toBe(ACTION_TIMEOUTS.selectivePush);

    const organizeAction = createOrganizeAction();
    expect(resolveActionTimeout(buildTask(organizeAction), DEFAULT_CONFIG))
      .toBe(ACTION_TIMEOUTS.organize);

    organizeAction.operations = [{ operation: 'validate', filters: { pattern: '*' } }];
    expect(resolveActionTimeout(buildTask(organizeAction), DEFAULT_CONFIG))
      .toBe(ACTION_TIMEOUTS.organizeValidate);
  });

  test('未匹配动作类型时保持默认超时', () => {
    expect(DEFAULT_CONFIG.timeout).toBe(60000);
    expect(resolveActionTimeout(buildTask({ type: 'unknown' } as unknown as Task['action']), DEFAULT_CONFIG))
      .toBe(DEFAULT_CONFIG.timeout);
  });

  test('显式动作级超时覆盖优先于集中定义', () => {
    const config = {
      ...DEFAULT_CONFIG,
      actionTimeouts: { backup: 1000, restore: 2000, organizeValidate: 3000 },
    };

    expect(resolveActionTimeout(buildTask(createBackupAction('backup')), config)).toBe(1000);
    expect(resolveActionTimeout(buildTask(createBackupAction('restore')), config)).toBe(2000);

    const organizeAction = createOrganizeAction();
    organizeAction.operations = [{ operation: 'validate' }];
    expect(resolveActionTimeout(buildTask(organizeAction), config)).toBe(3000);
  });
});

describe('task-executor 超时工具', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('P2：startOperation 同步抛错时清理超时定时器，不产生未处理的超时 rejection', async () => {
    jest.useFakeTimers();
    const syncError = new Error('同步抛错');
    const startOperation = (): Promise<never> => {
      throw syncError;
    };

    await expect(runWithTimeout(startOperation, 1000)).rejects.toThrow('同步抛错');

    // 定时器已在 finally 中清理；若残留，推进时间会产生未处理的 ExecutionTimeoutError
    expect(jest.getTimerCount()).toBe(0);
    expect(() => jest.advanceTimersByTime(5000)).not.toThrow();
  });
});
