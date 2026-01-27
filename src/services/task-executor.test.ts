import { browser } from 'wxt/browser';
import taskExecutor from './task-executor';
import taskService from './task-service';
import { createBackupAction, createEventTrigger, EventType, TaskStatus } from '../types/task';

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

