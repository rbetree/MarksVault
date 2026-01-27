import {
  Task,
  TaskStatus,
  TaskStorage,
  TaskExecutionResult,
  createDefaultTask,
  createDefaultTaskStorage,
  createManualTrigger,
  createBackupAction,
  BackupAction,
} from '../types/task';
import storageService, { StorageResult } from '../utils/storage-service';
// 导入触发器服务 - 注意避免循环依赖
// 仅在需要使用时动态导入

// 任务存储的键名
const TASKS_STORAGE_KEY = 'tasks_data';

// 内置系统任务（用于“任务页快捷操作”，不展示在任务列表中）
export const SYSTEM_TASK_IDS = {
  BOOKMARKS_BACKUP: 'sys_bookmarks_backup',
  BOOKMARKS_RESTORE: 'sys_bookmarks_restore',
} as const;

export const isSystemTaskId = (taskId: string): boolean => {
  return Object.values(SYSTEM_TASK_IDS).includes(taskId as any);
};

/**
 * 任务存储服务
 * 负责任务的创建、获取、更新、删除以及持久化
 */
class TaskService {
  private static instance: TaskService;
  // 注意：不使用内存缓存，因为 Service Worker 和页面是不同的执行上下文
  // 每次操作都直接从 chrome.storage 读取，确保数据一致性

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

      if (result.success) {
        // 如果storage中没有数据，则初始化一个默认的任务存储
        if (!result.data) {
          const defaultTaskStorage = createDefaultTaskStorage();
          await this.saveTasks(defaultTaskStorage);
          return {
            success: true,
            data: defaultTaskStorage
          };
        }
        return result;
      }

      return result;
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

      const newTask: Task = { ...baseTask, id: taskId };

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
    try {
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

      // 记录旧状态，用于检测状态变化
      const oldStatus = taskStorage.tasks[taskId].status;

      // 更新任务数据
      Object.assign(taskStorage.tasks[taskId], taskData);

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

      return {
        success: true
      };
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
    return await this.updateTask(taskId, { status });
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
      const result = await this.getTaskById(taskId);

      if (!result.success) {
        return result;
      }

      const task = result.data as Task;

      // 限制执行历史记录条数，保留最近的20条
      const MAX_HISTORY_ITEMS = 20;
      const executions = [
        executionResult,
        ...task.history.executions.slice(0, MAX_HISTORY_ITEMS - 1)
      ];

      // 确定任务状态
      let newStatus = task.status;

      if (executionResult.success) {
        // 成功执行的情况，回到启用状态
        newStatus = TaskStatus.ENABLED;
        console.log(`任务 ${taskId} 执行成功，状态更新为 ENABLED`);
      } else {
        // 失败执行的处理
        newStatus = TaskStatus.FAILED;

        // 特殊处理：检查是否为GitHub凭据相关错误
        const isCredentialError = executionResult.error && (
          executionResult.error.includes('GitHub凭据') ||
          executionResult.error.includes('未找到GitHub凭据') ||
          executionResult.error.includes('凭据无效或已过期')
        );

        if (isCredentialError) {
          console.warn(`任务 ${taskId} 因GitHub凭据问题失败，需要用户在“概览”页面重新授权`);
        }
      }

      // 更新任务历史
      return this.updateTask(taskId, {
        history: {
          executions,
          lastExecution: executionResult
        },
        status: newStatus
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
      const emptyTaskStorage = createDefaultTaskStorage();

      // 保存到存储
      const saveResult = await this.saveTasks(emptyTaskStorage);

      if (!saveResult.success) {
        return saveResult;
      }

      return {
        success: true
      };
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
      await storageService.setStorageData(TASKS_STORAGE_KEY, taskStorage);

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
