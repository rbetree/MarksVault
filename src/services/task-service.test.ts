import { browser } from 'wxt/browser';
import taskService, { SYSTEM_TASK_IDS, isSystemTaskId } from './task-service';
import {
  ActionType,
  TaskStatus,
  TriggerType,
  createBackupAction,
  createManualTrigger,
} from '../types/task';

describe('task-service 系统任务与创建逻辑', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
  });

  test('ensureSystemTasks: 会创建内置系统任务（备份/恢复）', async () => {
    const ensure = await taskService.ensureSystemTasks();
    expect(ensure.success).toBe(true);

    const backupTaskResult = await taskService.getTaskById(SYSTEM_TASK_IDS.BOOKMARKS_BACKUP);
    expect(backupTaskResult.success).toBe(true);
    const backupTask = backupTaskResult.data as any;
    expect(backupTask.id).toBe(SYSTEM_TASK_IDS.BOOKMARKS_BACKUP);
    expect(backupTask.trigger.type).toBe(TriggerType.MANUAL);
    expect(backupTask.action.type).toBe(ActionType.BACKUP);
    expect(backupTask.action.operation).toBe('backup');

    const restoreTaskResult = await taskService.getTaskById(SYSTEM_TASK_IDS.BOOKMARKS_RESTORE);
    expect(restoreTaskResult.success).toBe(true);
    const restoreTask = restoreTaskResult.data as any;
    expect(restoreTask.id).toBe(SYSTEM_TASK_IDS.BOOKMARKS_RESTORE);
    expect(restoreTask.trigger.type).toBe(TriggerType.MANUAL);
    expect(restoreTask.action.type).toBe(ActionType.BACKUP);
    expect(restoreTask.action.operation).toBe('restore');

    expect(isSystemTaskId(backupTask.id)).toBe(true);
    expect(isSystemTaskId(restoreTask.id)).toBe(true);
  });

  test('createTask: 支持保留自定义 id，并在冲突时自动生成新 id', async () => {
    const first = await taskService.createTask({
      id: 'my_custom_id',
      name: '自定义任务',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动触发'),
      action: createBackupAction('backup'),
    });

    expect(first.success).toBe(true);
    expect((first.data as any).id).toBe('my_custom_id');

    const second = await taskService.createTask({
      id: 'my_custom_id',
      name: '重复 id 任务',
      status: TaskStatus.ENABLED,
      trigger: createManualTrigger('手动触发'),
      action: createBackupAction('backup'),
    });

    expect(second.success).toBe(true);
    expect((second.data as any).id).not.toBe('my_custom_id');

    const all = await taskService.getTasksByStatus();
    expect(all.success).toBe(true);
    expect((all.data as any[]).length).toBe(2);
  });
});

