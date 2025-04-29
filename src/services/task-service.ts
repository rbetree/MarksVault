import { 
  Task, 
  TaskStatus, 
  TaskStorage, 
  TaskExecutionResult,
  createDefaultTask,
  createDefaultTaskStorage
} from '../types/task';
import storageService, { StorageResult } from '../utils/storage-service';
// 导入触发器服务 - 注意避免循环依赖
// 仅在需要使用时动态导入

// 任务存储的键名
const TASKS_STORAGE_KEY = 'tasks_data';

/**
 * 任务存储服务
 * 负责任务的创建、获取、更新、删除以及持久化
 */
class TaskService {
  private static instance: TaskService;
  private cachedTasks: TaskStorage | null = null;
  
  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {}
  
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
   * 获取所有任务
   * @returns 包含所有任务的TaskStorage对象
   */
  public async getTasks(): Promise<StorageResult> {
    try {
      if (this.cachedTasks) {
        return {
          success: true,
          data: this.cachedTasks
        };
      }
      
      const result = await storageService.getStorageData(TASKS_STORAGE_KEY);
      
      if (result.success) {
        // 如果storage中没有数据，则初始化一个默认的任务存储
        if (!result.data) {
          const defaultTaskStorage = createDefaultTaskStorage();
          await this.saveTasks(defaultTaskStorage);
          this.cachedTasks = defaultTaskStorage;
          return {
            success: true,
            data: defaultTaskStorage
          };
        }
        
        this.cachedTasks = result.data as TaskStorage;
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
      const newTask = taskData 
        ? { ...createDefaultTask(), ...taskData, id: `task_${Date.now()}` }
        : createDefaultTask();
      
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
      
      // 保存任务原状态
      const oldStatus = taskStorage.tasks[taskId].status;
      
      // 更新任务数据和时间戳
      taskStorage.tasks[taskId] = {
        ...taskStorage.tasks[taskId],
        ...taskData,
        updatedAt: Date.now()
      };
      
      // 检查是否影响到触发器，如果是则更新对应的alarm
      const shouldUpdateTrigger = 
        taskData.trigger !== undefined || 
        (taskData.status !== undefined && taskData.status !== oldStatus);
      
      taskStorage.lastUpdated = Date.now();
      
      // 保存到存储
      const saveResult = await this.saveTasks(taskStorage);
      
      if (!saveResult.success) {
        return saveResult;
      }
      
      // 如果需要，更新触发器
      if (shouldUpdateTrigger) {
        // 动态导入触发器服务，避免循环依赖
        const triggerService = (await import('./trigger-service')).default;
        
        const currentTask = taskStorage.tasks[taskId];
        
        if (currentTask.status === TaskStatus.ENABLED && currentTask.trigger.type === 'time') {
          await triggerService.createOrUpdateAlarm(currentTask);
        } else {
          await triggerService.removeAlarm(taskId);
        }
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
    const result = await this.setTaskStatus(taskId, TaskStatus.ENABLED);
    
    if (result.success) {
      // 动态导入触发器服务，避免循环依赖
      const triggerService = (await import('./trigger-service')).default;
      
      // 获取任务并更新alarm
      const taskResult = await this.getTaskById(taskId);
      if (taskResult.success) {
        await triggerService.createOrUpdateAlarm(taskResult.data as Task);
      }
    }
    
    return result;
  }
  
  /**
   * 禁用任务
   * @param taskId 任务ID
   * @returns 禁用结果
   */
  public async disableTask(taskId: string): Promise<StorageResult> {
    const result = await this.setTaskStatus(taskId, TaskStatus.DISABLED);
    
    if (result.success) {
      // 动态导入触发器服务，避免循环依赖
      const triggerService = (await import('./trigger-service')).default;
      
      // 移除对应的alarm
      await triggerService.removeAlarm(taskId);
    }
    
    return result;
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
      
      // 使用类型保护
      if (executionResult.success && 
          task.trigger && 
          typeof task.trigger === 'object' && 
          'type' in task.trigger && 
          task.trigger.type === 'time' && 
          'schedule' in task.trigger && 
          task.trigger.schedule.type === 'once') {
        newStatus = TaskStatus.COMPLETED;
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
      // 更新缓存
      this.cachedTasks = taskStorage;
      
      // 保存到持久化存储
      await storageService.setStorageData(TASKS_STORAGE_KEY, taskStorage);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('保存任务失败:', error);
      this.cachedTasks = null; // 清除缓存，强制下次重新加载
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