import {
    Task,
    TaskStatus,
    TaskStorage,
    TaskExecutionResult,
    createDefaultTask,
  createDefaultTaskStorage,
  TriggerType,
  createManualTrigger,
  createBackupAction,
  BackupAction,
} from '../types/task';
import storageService, { StorageResult } from '../utils/storage-service';
import { clearTaskExecutionState } from './task-execution-state';
import { withLeaseLock } from './lease-lock';
// 导入触发器服务 - 注意避免循环依赖
// 仅在需要使用时动态导入

// 任务存储的键名
const TASKS_STORAGE_KEY = 'tasks_data';

// 内置系统任务（用于“任务页快捷操作”，不展示在任务列表中）
export const SYSTEM_TASK_IDS = {
  BOOKMARKS_BACKUP: 'sys_bookmarks_backup',
  BOOKMARKS_RESTORE: 'sys_bookmarks_restore',
} as const;

const SYSTEM_TASK_ID_SET: ReadonlySet<string> = new Set(Object.values(SYSTEM_TASK_IDS));

export const isSystemTaskId = (taskId: string): boolean => {
  return SYSTEM_TASK_ID_SET.has(taskId);
};

/**
 * 任务存储服务
 * 负责任务的创建、获取、更新、删除以及持久化
 */
class TaskService {
  private static instance: TaskService;
  // 注意：不使用内存缓存，因为 Service Worker 和页面是不同的执行上下文
  // 每次操作都直接从 chrome.storage 读取，确保数据一致性

  // 写互斥队列：串行化"读取任务列表→修改→写回"的完整写流程。
  // MV3 扩展单线程，但 await 会使多个写流程交错，并发收尾互相覆盖会丢失执行历史；
  // 链式队列保证同一时刻只有一个写流程在运行
  private writeMutex: Promise<void> = Promise.resolve();

  /**
   * 在写互斥队列中串行执行临界区
   * 链式队列保证同一时刻只有一个写流程在运行；fn 抛出异常时同样释放互斥，
   * 避免后续写流程永久等待
   * @param fn 需要互斥执行的异步操作
   * @returns fn 的执行结果
   */
  private async withWriteMutex<T>(fn: () => Promise<T>): Promise<T> {
    // 本地队列串行化同一上下文，跨上下文再用 Web Locks 串行化 popup/taskconfig/SW
    return withLeaseLock('marksvault:tasks-write', async () => {
      const prev = this.writeMutex;
      let release!: () => void;
      this.writeMutex = new Promise(r => (release = r));
      await prev;
      try {
        return await fn();
      } finally {
        release();
      }
    });
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private coerceHistory(value: unknown): Task['history'] {
    if (!this.isPlainObject(value)) {
      return { executions: [] };
    }

    const executionsRaw = value['executions'];
    const executions = Array.isArray(executionsRaw)
      ? (executionsRaw as TaskExecutionResult[])
      : [];

    const lastExecutionRaw = value['lastExecution'];
    const lastExecution = this.isPlainObject(lastExecutionRaw)
      ? (lastExecutionRaw as unknown as TaskExecutionResult)
      : undefined;

    return {
      executions,
      ...(lastExecution ? { lastExecution } : {}),
    };
  }

  /**
   * 归一化持久化状态：执行结果不再覆盖启用状态，
   * 旧数据中的 FAILED/COMPLETED 统一迁移为 ENABLED
   */
  private normalizeEnableStatus(status: TaskStatus): TaskStatus {
    return status === TaskStatus.FAILED || status === TaskStatus.COMPLETED
      ? TaskStatus.ENABLED
      : status;
  }

  private coerceTask(value: unknown): { task: Task | null; statusMigrated: boolean } {
    if (!this.isPlainObject(value)) return { task: null, statusMigrated: false };

    const idRaw = value['id'];
    const id = typeof idRaw === 'string' ? idRaw.trim() : '';
    if (!id) return { task: null, statusMigrated: false };

    const now = Date.now();
    const base = createDefaultTask();

    const nameRaw = value['name'];
    const name = typeof nameRaw === 'string' ? nameRaw : base.name;

    const descriptionRaw = value['description'];
    const description = typeof descriptionRaw === 'string' ? descriptionRaw : '';

    const statusRaw = value['status'];
    const parsedStatus =
      typeof statusRaw === 'string' && (Object.values(TaskStatus) as string[]).includes(statusRaw)
        ? (statusRaw as TaskStatus)
        : base.status;
    const status = this.normalizeEnableStatus(parsedStatus);
    const statusMigrated = status !== parsedStatus;

    const createdAtRaw = value['createdAt'];
    const createdAt = typeof createdAtRaw === 'number' && Number.isFinite(createdAtRaw) ? createdAtRaw : now;

    const updatedAtRaw = value['updatedAt'];
    const updatedAt = typeof updatedAtRaw === 'number' && Number.isFinite(updatedAtRaw) ? updatedAtRaw : createdAt;

    const triggerRaw = value['trigger'];
    const trigger =
      this.isPlainObject(triggerRaw) &&
      (triggerRaw['type'] === TriggerType.EVENT || triggerRaw['type'] === TriggerType.MANUAL)
        ? (triggerRaw as unknown as Task['trigger'])
        : base.trigger;

    const actionRaw = value['action'];
    const action = this.isPlainObject(actionRaw) ? (actionRaw as unknown as Task['action']) : base.action;

    const history = this.coerceHistory(value['history']);

    return {
      task: {
        ...base,
        id,
        name,
        description,
        status,
        createdAt,
        updatedAt,
        trigger,
        action,
        history,
      },
      statusMigrated,
    };
  }

  private normalizeTaskStorage(raw: unknown): { taskStorage: TaskStorage; migrated: boolean } {
    const now = Date.now();

    if (!raw) {
      // 空存储不需要写回；读操作写回会在跨页面并发时覆盖刚创建的任务
      return { taskStorage: createDefaultTaskStorage(), migrated: false };
    }

    // 旧数据：Task[]
    if (Array.isArray(raw)) {
      const tasks: Record<string, Task> = {};
      for (const item of raw) {
        const { task } = this.coerceTask(item);
        if (task) {
          tasks[task.id] = task;
        }
      }
      return {
        taskStorage: {
          tasks,
          lastUpdated: now,
        },
        migrated: true,
      };
    }

    // 现行数据：TaskStorage 或缺少 lastUpdated 的 TaskStorage
    if (this.isPlainObject(raw)) {
      const tasksRaw = raw['tasks'];

      if (this.isPlainObject(tasksRaw)) {
        const tasks: Record<string, Task> = {};
        let statusMigrated = false;
        for (const value of Object.values(tasksRaw)) {
          const coerced = this.coerceTask(value);
          if (coerced.task) {
            tasks[coerced.task.id] = coerced.task;
          }
          statusMigrated = statusMigrated || coerced.statusMigrated;
        }

        const lastUpdatedRaw = raw['lastUpdated'];
        const lastUpdated =
          typeof lastUpdatedRaw === 'number' && Number.isFinite(lastUpdatedRaw) ? lastUpdatedRaw : now;

        return {
          taskStorage: {
            tasks,
            lastUpdated,
          },
          migrated: statusMigrated || !(typeof lastUpdatedRaw === 'number' && Number.isFinite(lastUpdatedRaw)),
        };
      }

      // 兜底兼容：可能直接存了 { [taskId]: Task }
      const tasks: Record<string, Task> = {};
      let found = false;
      for (const value of Object.values(raw)) {
        const { task } = this.coerceTask(value);
        if (task) {
          tasks[task.id] = task;
          found = true;
        }
      }
      if (found) {
        return {
          taskStorage: {
            tasks,
            lastUpdated: now,
          },
          migrated: true,
        };
      }
    }

    return { taskStorage: createDefaultTaskStorage(), migrated: true };
  }

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() { }

  /**
   * 获取TaskService实例
   * @returns TaskService单例
   */
  public static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  /**
   * 初始化任务存储
   * 在扩展启动时调用
   */
  public async init(): Promise<void> {
    try {
      const result = await this.getTasks();
      if (!result.success) {
        console.error('初始化任务存储失败:', result.error);
      }
    } catch (error) {
      console.error('初始化任务存储时发生错误:', error);
    }
  }

  /**
   * 确保系统内置任务存在
   * 说明：这些任务用于承载“快捷操作”的统一执行/历史记录，但不会展示在任务列表中。
   */
  public async ensureSystemTasks(): Promise<StorageResult> {
    try {
      return await this.withWriteMutex(async () => {
        const tasksResult = await this.getTasks();
        if (!tasksResult.success) return tasksResult;

        const taskStorage = tasksResult.data as TaskStorage;
        let hasChanges = false;

        const now = Date.now();

        if (!taskStorage.tasks[SYSTEM_TASK_IDS.BOOKMARKS_BACKUP]) {
          const action = createBackupAction('backup') as BackupAction;
          action.description = '立即备份书签到GitHub';
          action.options.commitMessage = '手动备份书签';
          action.options.includeMetadata = true;

          taskStorage.tasks[SYSTEM_TASK_IDS.BOOKMARKS_BACKUP] = {
            id: SYSTEM_TASK_IDS.BOOKMARKS_BACKUP,
            name: '快捷操作：立即备份',
            description: '在任务页快速执行一次书签备份',
            status: TaskStatus.ENABLED,
            createdAt: now,
            updatedAt: now,
            trigger: createManualTrigger('快捷备份'),
            action,
            history: { executions: [] },
          };
          hasChanges = true;
        }

        if (!taskStorage.tasks[SYSTEM_TASK_IDS.BOOKMARKS_RESTORE]) {
          const action = createBackupAction('restore') as BackupAction;
          action.description = '从GitHub恢复书签';
          // 默认不写死 backupFilePath：执行时允许选择或直接使用最新备份
          delete action.options.backupFilePath;

          taskStorage.tasks[SYSTEM_TASK_IDS.BOOKMARKS_RESTORE] = {
            id: SYSTEM_TASK_IDS.BOOKMARKS_RESTORE,
            name: '快捷操作：恢复书签',
            description: '在任务页选择备份并恢复到本地书签（高风险）',
            status: TaskStatus.ENABLED,
            createdAt: now,
            updatedAt: now,
            trigger: createManualTrigger('快捷恢复（危险操作）'),
            action,
            history: { executions: [] },
          };
          hasChanges = true;
        }

        if (!hasChanges) {
          return { success: true, data: { created: false } };
        }

        taskStorage.lastUpdated = Date.now();
        const saveResult = await this.saveTasks(taskStorage);
        if (!saveResult.success) return saveResult;

        return { success: true, data: { created: true } };
      });
    } catch (error) {
      console.error('确保系统任务失败:', error);
      return {
        success: false,
        error: '确保系统任务失败: ' + (error instanceof Error ? error.message : String(error)),
      };
    }
  }

  /**
   * 获取所有任务
   * 每次直接从 chrome.storage 读取，确保跨上下文数据一致
   * @returns 包含所有任务的TaskStorage对象
   */
  public async getTasks(): Promise<StorageResult> {
    try {
      const result = await storageService.getStorageData(TASKS_STORAGE_KEY);

      if (!result.success) {
        return result;
      }

      const { taskStorage, migrated } = this.normalizeTaskStorage(result.data as unknown);
      if (migrated) {
        await this.saveTasks(taskStorage);
      }

      return {
        success: true,
        data: taskStorage,
      };
    } catch (error) {
      console.error('获取任务失败:', error);
      return {
        success: false,
        error: '获取任务失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 根据ID获取特定任务
   * @param taskId 任务ID
   * @returns 任务对象或错误
   */
  public async getTaskById(taskId: string): Promise<StorageResult> {
    try {
      const result = await this.getTasks();

      if (!result.success) {
        return result;
      }

      const taskStorage = result.data as TaskStorage;
      const task = taskStorage.tasks[taskId];

      if (!task) {
        return {
          success: false,
          error: `未找到ID为 ${taskId} 的任务`
        };
      }

      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error(`获取任务 ${taskId} 失败:`, error);
      return {
        success: false,
        error: `获取任务失败: ` + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 根据状态获取任务列表
   * @param status 任务状态，不提供则返回所有任务
   * @returns 符合条件的任务列表
   */
  public async getTasksByStatus(status?: TaskStatus): Promise<StorageResult> {
    try {
      const result = await this.getTasks();

      if (!result.success) {
        return result;
      }

      const taskStorage = result.data as TaskStorage;

      if (!status) {
        // 返回所有任务的数组
        return {
          success: true,
          data: Object.values(taskStorage.tasks)
        };
      }

      // 根据状态过滤任务
      const filteredTasks = Object.values(taskStorage.tasks).filter(
        task => task.status === status
      );

      return {
        success: true,
        data: filteredTasks
      };
    } catch (error) {
      console.error('按状态获取任务失败:', error);
      return {
        success: false,
        error: '按状态获取任务失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 创建新任务
   * @param taskData 可选的任务数据，不提供则创建默认任务
   * @returns 创建的任务对象或错误
   */
  public async createTask(taskData?: Partial<Task>): Promise<StorageResult> {
    try {
      return await this.withWriteMutex(async () => {
        const result = await this.getTasks();

        if (!result.success) {
          return result;
        }

        const taskStorage = result.data as TaskStorage;
        const baseTask = taskData ? { ...createDefaultTask(), ...taskData } : createDefaultTask();

        // 支持外部传入自定义 id（用于系统任务/迁移），否则生成新 id；并保证不与现有任务冲突
        const desiredId = typeof baseTask.id === 'string' ? baseTask.id.trim() : '';
        let taskId = desiredId || `task_${Date.now()}`;
        while (taskStorage.tasks[taskId]) {
          taskId = `task_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        }

        const newTask: Task = {
          ...baseTask,
          id: taskId,
          status: this.normalizeEnableStatus(baseTask.status),
        };

        // 更新存储
        taskStorage.tasks[newTask.id] = newTask;
        taskStorage.lastUpdated = Date.now();

        // 保存到存储
        const saveResult = await this.saveTasks(taskStorage);

        if (!saveResult.success) {
          return saveResult;
        }

        return {
          success: true,
          data: newTask
        };
      });
    } catch (error) {
      console.error('创建任务失败:', error);
      return {
        success: false,
        error: '创建任务失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 更新现有任务
   * @param taskId 任务ID
   * @param taskData 更新的任务数据
   * @returns 更新后的任务对象或错误
   */
  public async updateTask(taskId: string, taskData: Partial<Task>): Promise<StorageResult> {
    return await this.applyTaskUpdates(taskId, taskData, false);
  }

  /**
   * 应用任务更新
   * @param taskId 任务ID
   * @param taskData 更新的任务数据
   * @param allowStatus 是否允许更新状态；仅 setTaskStatus 显式状态变更时为 true
   * @returns 更新后的任务对象或错误
   */
  private async applyTaskUpdates(
    taskId: string,
    taskData: Partial<Task>,
    allowStatus: boolean
  ): Promise<StorageResult> {
    try {
      return await this.withWriteMutex(async () => {
        const result = await this.getTasks();

        if (!result.success) {
          return result;
        }

        const taskStorage = result.data as TaskStorage;

        if (!taskStorage.tasks[taskId]) {
          return {
            success: false,
            error: `未找到ID为 ${taskId} 的任务`
          };
        }

        // 更新任务数据：剥离传入的 history 与 status 字段。
        // UI 编辑保存会传回含旧历史、旧状态的完整任务对象，浅合并会回滚执行期间
        // 已写入的新历史或执行器置位的 RUNNING；状态变更只走 setTaskStatus
        const updates = { ...taskData };
        delete updates.history;
        if (!allowStatus) {
          delete updates.status;
        }
        Object.assign(taskStorage.tasks[taskId], updates);

        // 确保ID不变，更新更新时间
        taskStorage.tasks[taskId].id = taskId;
        taskStorage.tasks[taskId].updatedAt = Date.now();

        taskStorage.lastUpdated = Date.now();

        // 保存到存储
        const saveResult = await this.saveTasks(taskStorage);

        if (!saveResult.success) {
          return saveResult;
        }

        return {
          success: true,
          data: taskStorage.tasks[taskId]
        };
      });
    } catch (error) {
      console.error(`更新任务 ${taskId} 失败:`, error);
      return {
        success: false,
        error: `更新任务失败: ` + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 删除任务
   * @param taskId 任务ID
   * @returns 操作结果
   */
  public async deleteTask(taskId: string): Promise<StorageResult> {
    try {
      return await this.withWriteMutex(async () => {
        const result = await this.getTasks();

        if (!result.success) {
          return result;
        }

        const taskStorage = result.data as TaskStorage;

        if (!taskStorage.tasks[taskId]) {
          return {
            success: false,
            error: `未找到ID为 ${taskId} 的任务`
          };
        }

        // 删除任务
        delete taskStorage.tasks[taskId];
        taskStorage.lastUpdated = Date.now();

        // 保存到存储
        const saveResult = await this.saveTasks(taskStorage);

        if (!saveResult.success) {
          return saveResult;
        }

        // 任务已删除，清理其执行快照、执行租约与书签写入租约，
        // 避免重试窗口删除任务后留下孤儿状态
        await clearTaskExecutionState(taskId);

        return {
          success: true
        };
      });
    } catch (error) {
      console.error(`删除任务 ${taskId} 失败:`, error);
      return {
        success: false,
        error: `删除任务失败: ` + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 启用任务
   * @param taskId 任务ID
   * @returns 启用结果
   */
  public async enableTask(taskId: string): Promise<StorageResult> {
    return await this.setTaskStatus(taskId, TaskStatus.ENABLED);
  }

  /**
   * 禁用任务
   * @param taskId 任务ID
   * @returns 禁用结果
   */
  public async disableTask(taskId: string): Promise<StorageResult> {
    return await this.setTaskStatus(taskId, TaskStatus.DISABLED);
  }

  /**
   * 设置任务状态
   * @param taskId 任务ID
   * @param status 要设置的状态
   * @returns 设置结果
   */
  public async setTaskStatus(taskId: string, status: TaskStatus): Promise<StorageResult> {
    // 状态是执行器与用户显式控制的字段，绕过 updateTask 对表单回传状态的剥离；
    // FAILED/COMPLETED 不再作为持久化启用状态写入，统一归一化为 ENABLED
    return await this.applyTaskUpdates(
      taskId,
      { status: this.normalizeEnableStatus(status) },
      true
    );
  }

  /**
   * 更新任务执行历史
   * @param taskId 任务ID
   * @param executionResult 执行结果
   * @returns 操作结果
   */
  public async updateTaskExecutionHistory(
    taskId: string,
    executionResult: TaskExecutionResult
  ): Promise<StorageResult> {
    try {
      // 在写互斥内完成"读取→修改→写回"：执行历史与状态基于最新存储状态，
      // 避免与其他写流程交错导致历史丢失；不调用 updateTask（其剥离 history 字段），
      // 因此此处独立实现读-改-写，且不会形成互斥嵌套
      return await this.withWriteMutex(async () => {
        const result = await this.getTasks();

        if (!result.success) {
          return result;
        }

        const taskStorage = result.data as TaskStorage;
        const task = taskStorage.tasks[taskId];

        if (!task) {
          return {
            success: false,
            error: `未找到ID为 ${taskId} 的任务`
          };
        }

        // 限制执行历史记录条数，保留最近的20条
        const MAX_HISTORY_ITEMS = 20;
        const executions = [
          executionResult,
          ...task.history.executions.slice(0, MAX_HISTORY_ITEMS - 1)
        ];

        // 启用状态是稳定配置，执行结果只写入历史，不覆盖 status。
        // 执行中的 RUNNING 由执行器收尾恢复为 ENABLED/DISABLED；
        // 用户显式禁用的 DISABLED 不会被任何执行结果改变
        if (!executionResult.success) {
          // 特殊处理：检查是否为GitHub凭据相关错误
          // 只精确匹配凭据缺失/失效的明确消息，避免网络错误消息（如
          // “GitHub凭据验证失败（网络或服务端错误）”仅含“GitHub凭据”子串）被误判为凭据错误
          const isCredentialError = executionResult.error && (
            executionResult.error.includes('未找到GitHub凭据') ||
            executionResult.error.includes('凭据无效或已过期')
          );

          if (isCredentialError) {
            console.warn(`任务 ${taskId} 因GitHub凭据问题失败，需要用户在“概览”页面重新授权`);
          }
        }

        // 仅更新执行历史；启用状态保持不变
        task.history = {
          executions,
          lastExecution: executionResult
        };
        task.updatedAt = Date.now();

        taskStorage.lastUpdated = Date.now();

        const saveResult = await this.saveTasks(taskStorage);
        if (!saveResult.success) {
          return saveResult;
        }

        return {
          success: true
        };
      });
    } catch (error) {
      console.error(`更新任务 ${taskId} 执行历史失败:`, error);
      return {
        success: false,
        error: `更新任务执行历史失败: ` + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 清除所有任务
   * 主要用于测试和重置
   * @returns 操作结果
   */
  public async clearAllTasks(): Promise<StorageResult> {
    try {
      return await this.withWriteMutex(async () => {
        const emptyTaskStorage = createDefaultTaskStorage();

        // 保存到存储
        const saveResult = await this.saveTasks(emptyTaskStorage);

        if (!saveResult.success) {
          return saveResult;
        }

        return {
          success: true
        };
      });
    } catch (error) {
      console.error('清除所有任务失败:', error);
      return {
        success: false,
        error: '清除所有任务失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 保存任务数据到存储
   * @param taskStorage 任务存储对象
   * @returns 操作结果
   * @private
   */
  private async saveTasks(taskStorage: TaskStorage): Promise<StorageResult> {
    try {
      // 直接保存到 chrome.storage，不使用内存缓存
      const saveResult = await storageService.setStorageData(TASKS_STORAGE_KEY, taskStorage);
      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error || '保存任务失败: 存储层返回失败'
        };
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('保存任务失败:', error);
      return {
        success: false,
        error: '保存任务失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
}

/**
 * 导出TaskService单例
 */
const taskService = TaskService.getInstance();
export default taskService; 
