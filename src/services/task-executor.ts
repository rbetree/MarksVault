/**
 * 任务执行引擎
 * 负责执行触发的任务并记录结果
 */

import { 
  Task, 
  TaskStatus, 
  ActionType, 
  BackupAction, 
  OrganizeAction,
  CustomAction,
  TaskExecutionResult,
  TriggerType
} from '../types/task';
import taskService from './task-service';
import backupService from './backup-service';
import organizeService from './organize-service';
import storageService from '../utils/storage-service';
import bookmarkService from '../utils/bookmark-service';
import githubService from './github-service';

// 任务执行配置
interface TaskExecutionConfig {
  maxRetries: number;         // 最大重试次数
  retryDelay: number;         // 重试延迟(毫秒)
  timeout: number;            // 执行超时时间(毫秒)
  maxHistoryLength: number;   // 执行历史记录最大长度
}

// 默认配置
const DEFAULT_CONFIG: TaskExecutionConfig = {
  maxRetries: 3,              // 默认最多重试3次
  retryDelay: 2000,           // 默认重试延迟2秒
  timeout: 60000,             // 默认超时1分钟
  maxHistoryLength: 50        // 默认保留50条执行记录
};

/**
 * 任务执行引擎
 * 负责执行触发的任务并记录执行结果
 */
class TaskExecutor {
  private static instance: TaskExecutor;
  private config: TaskExecutionConfig;
  private executingTasks: Set<string> = new Set(); // 记录正在执行的任务ID
  
  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    console.log('任务执行引擎已初始化');
  }
  
  /**
   * 获取TaskExecutor实例
   * @returns TaskExecutor单例
   */
  public static getInstance(): TaskExecutor {
    if (!TaskExecutor.instance) {
      TaskExecutor.instance = new TaskExecutor();
    }
    return TaskExecutor.instance;
  }

  /**
   * 更新执行配置
   * @param config 部分或完整的配置对象
   */
  public updateConfig(config: Partial<TaskExecutionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('任务执行引擎配置已更新:', this.config);
  }
  
  /**
   * 初始化任务执行引擎
   */
  public async init(): Promise<void> {
    try {
      // 检查是否有处于RUNNING状态的任务，这可能是由于之前的执行被异常中断
      // 恢复这些任务的状态为ENABLED或FAILED
      const runningTasksResult = await taskService.getTasksByStatus(TaskStatus.RUNNING);
      if (runningTasksResult.success && runningTasksResult.data.length > 0) {
        const runningTasks = runningTasksResult.data as Task[];
        console.log(`发现 ${runningTasks.length} 个处于RUNNING状态的任务，正在恢复状态...`);
        
        for (const task of runningTasks) {
          // 创建失败的执行记录
          const executionResult: TaskExecutionResult = {
            success: false,
            timestamp: Date.now(),
            error: '任务执行被中断(可能是由于浏览器关闭或扩展重新加载)',
            details: '自动恢复状态为FAILED'
          };
          
          // 更新任务历史记录
          await taskService.updateTaskExecutionHistory(task.id, executionResult);
          
          // 将任务状态设置为FAILED
          await taskService.setTaskStatus(task.id, TaskStatus.FAILED);
        }
      }
      
      console.log('任务执行引擎初始化完成');
    } catch (error) {
      console.error('任务执行引擎初始化失败:', error);
    }
  }
  
  /**
   * 执行任务
   * @param taskId 要执行的任务ID
   * @param retryCount 当前重试次数，默认为0
   * @returns 执行结果
   */
  public async executeTask(taskId: string, retryCount: number = 0): Promise<TaskExecutionResult> {
    console.log(`开始执行任务: ${taskId}${retryCount > 0 ? ` (重试 ${retryCount}/${this.config.maxRetries})` : ''}`);
    
    // 检查任务是否已在执行中
    if (this.executingTasks.has(taskId)) {
      return {
        success: false,
        timestamp: Date.now(),
        error: '任务已在执行中，不能重复执行',
        details: '防止任务重复执行'
      };
    }
    
    // 将任务标记为执行中
    this.executingTasks.add(taskId);
    
    const startTime = Date.now();
    let executionResult: TaskExecutionResult = {
      success: false,
      timestamp: startTime,
      details: '',
      error: ''
    };
    
    // 创建超时处理
    const timeoutPromise = new Promise<TaskExecutionResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`任务执行超时(${this.config.timeout / 1000}秒)`));
      }, this.config.timeout);
    });
    
    try {
      // 获取任务
      const taskResult = await taskService.getTaskById(taskId);
      if (!taskResult.success) {
        throw new Error(`获取任务失败: ${taskResult.error}`);
      }
      
      const task = taskResult.data as Task;
      
      // 检查任务是否启用
      if (task.status !== TaskStatus.ENABLED && task.status !== TaskStatus.FAILED) {
        throw new Error(`任务当前状态为${task.status}，无法执行`);
      }
      
      // 将任务状态设置为执行中
      await taskService.setTaskStatus(taskId, TaskStatus.RUNNING);
      
      // 使用Promise.race来实现超时处理
      const executePromise = (async () => {
        // 根据任务类型执行操作
        switch (task.action.type) {
          case ActionType.BACKUP:
            return await this.executeBackupAction(task);
          case ActionType.ORGANIZE:
            return await this.executeOrganizeAction(task);
          case ActionType.CUSTOM:
            return await this.executeCustomAction(task);
          default:
            throw new Error(`不支持的任务类型: ${(task.action as { type: string }).type}`);
        }
      })();
      
      // 使用Promise.race实现超时控制
      executionResult = await Promise.race([executePromise, timeoutPromise]);
      
      // 记录执行时长
      executionResult.duration = Date.now() - startTime;
      
      // 更新任务历史记录
      await taskService.updateTaskExecutionHistory(taskId, executionResult);
      
      // 判断任务是否为一次性任务
      if (executionResult.success && 
          task.trigger && 
          typeof task.trigger === 'object' && 
          'type' in task.trigger &&
          task.trigger.type === TriggerType.TIME && 
          'schedule' in task.trigger &&
          task.trigger.schedule && 
          typeof task.trigger.schedule === 'object' &&
          'type' in task.trigger.schedule &&
          task.trigger.schedule.type === 'once') {
        // 如果是一次性任务并成功执行，则将状态设置为已完成
        await taskService.setTaskStatus(taskId, TaskStatus.COMPLETED);
      } else {
        // 恢复任务状态为启用
        await taskService.setTaskStatus(taskId, TaskStatus.ENABLED);
      }
      
      console.log(`任务 ${taskId} 执行完成, 结果: ${executionResult.success ? '成功' : '失败'}`);
      return executionResult;
    } catch (error) {
      // 处理错误，判断是否需要重试
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`任务 ${taskId} 执行出错:`, errorMessage);
      
      // 如果错误是由于超时或可重试的原因，尝试重试
      if (retryCount < this.config.maxRetries && this.isRetryableError(error)) {
        console.log(`将在 ${this.config.retryDelay/1000} 秒后重试任务 ${taskId}`);
        
        // 从执行中任务集合中移除
        this.executingTasks.delete(taskId);
        
        // 等待重试延迟
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        
        // 重试任务
        return this.executeTask(taskId, retryCount + 1);
      }
      
      // 记录错误信息
      executionResult.success = false;
      executionResult.error = errorMessage;
      executionResult.details = `执行失败${retryCount > 0 ? `，已重试 ${retryCount} 次` : ''}`;
      executionResult.duration = Date.now() - startTime;
      
      // 更新任务历史记录
      await taskService.updateTaskExecutionHistory(taskId, executionResult);
      
      // 将任务状态设置为失败
      await taskService.setTaskStatus(taskId, TaskStatus.FAILED);
      
      console.error(`任务 ${taskId} 执行失败:`, error);
    } finally {
      // 无论结果如何，从执行中任务集合中移除
      this.executingTasks.delete(taskId);
    }
    
    return executionResult;
  }
  
  /**
   * 检查错误是否可重试
   * @param error 错误对象
   * @returns 是否可重试
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 不可重试的错误类型
    const nonRetryableErrors = [
      '任务当前未启用',
      '获取任务失败',
      '不支持的任务类型',
      '未找到GitHub凭据'
    ];
    
    // 检查是否包含不可重试的错误信息
    for (const pattern of nonRetryableErrors) {
      if (errorMessage.includes(pattern)) {
        return false;
      }
    }
    
    // 可重试的错误通常是网络或临时性错误
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'temporarily',
      'temporary',
      'rate limit',
      'busy',
      'overloaded'
    ];
    
    // 检查是否包含可重试的错误信息
    for (const pattern of retryableErrors) {
      if (errorMessage.toLowerCase().includes(pattern)) {
        return true;
      }
    }
    
    // 默认情况下，认为大多数错误都是不可重试的
    return false;
  }
  
  /**
   * 执行备份操作
   * @param task 任务对象
   * @returns 执行结果
   */
  private async executeBackupAction(task: Task): Promise<TaskExecutionResult> {
    console.log(`执行备份任务: ${task.id}`);
    const backupAction = task.action as BackupAction;
    
    try {
      // 获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      
      if (!credentialsResult.success || !credentialsResult.data) {
        throw new Error('未找到GitHub凭据，请先在同步设置中配置');
      }
      
      const credentials = credentialsResult.data;
      
      // 获取GitHub用户名
      let username = 'user'; // 默认占位符
      try {
        const userResult = await githubService.validateCredentials(credentials);
        username = userResult.login;
      } catch (error) {
        console.warn('无法获取GitHub用户名，使用默认值');
      }
      
      // 根据操作类型执行不同的操作
      if (backupAction.operation === 'backup' || !backupAction.operation) {
        // 执行备份操作 (上传)
        const backupResult = await backupService.backupToGitHub(
          credentials,
          username
        );
        
        if (!backupResult.success) {
          throw new Error(`GitHub备份失败: ${backupResult.error}`);
        }
        
        return {
          success: true,
          timestamp: Date.now(),
          details: `成功备份书签到GitHub: ${backupResult.data?.fileUrl || '无文件URL'}${
            backupResult.data?.bookmarksCount ? `，包含 ${backupResult.data.bookmarksCount} 个书签` : ''
          }`
        };
      } else if (backupAction.operation === 'restore') {
        // 执行恢复操作 (下载)
        const useTimestampedFile = !!backupAction.options?.backupFilePath;
        const timestampedFilePath = backupAction.options?.backupFilePath;
        
        const restoreResult = await backupService.restoreFromGitHub(
          credentials,
          username,
          useTimestampedFile,
          timestampedFilePath
        );
        
        if (!restoreResult.success) {
          throw new Error(`从GitHub恢复失败: ${restoreResult.error}`);
        }
        
        return {
          success: true,
          timestamp: Date.now(),
          details: `成功从GitHub恢复书签${
            restoreResult.data?.bookmarksCount ? `，恢复了 ${restoreResult.data.bookmarksCount} 个书签` : ''
          }`
        };
      } else {
        throw new Error(`不支持的备份操作: ${backupAction.operation}`);
      }
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: `备份/恢复失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * 执行整理操作
   * @param task 任务对象
   * @returns 执行结果
   */
  private async executeOrganizeAction(task: Task): Promise<TaskExecutionResult> {
    console.log(`执行整理任务: ${task.id}`);
    const organizeAction = task.action as OrganizeAction;
    
    try {
      // 验证操作数组是否有效
      if (!organizeAction.operations || !Array.isArray(organizeAction.operations) || organizeAction.operations.length === 0) {
        throw new Error('整理操作数组为空或无效');
      }
      
      // 使用organizeService执行书签整理操作
      const results = await organizeService.organizeBookmarks(organizeAction.operations);
      
      // 汇总处理结果
      let successCount = 0;
      let failureCount = 0;
      let processedBookmarksCount = 0;
      let details: string[] = [];
      
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        processedBookmarksCount += result.processedCount;
        details.push(result.details);
      });
      
      // 生成总结果
      const allOperationsSucceeded = failureCount === 0;
      return {
        success: allOperationsSucceeded,
        timestamp: Date.now(),
        details: `执行了 ${organizeAction.operations.length} 个整理操作，成功 ${successCount} 个，失败 ${failureCount} 个，处理了 ${processedBookmarksCount} 个书签。详情: ${details.join(' | ')}`,
        error: allOperationsSucceeded ? undefined : `${failureCount} 个操作失败，请检查详情`
      };
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: `整理失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * 执行自定义操作
   * @param task 任务对象
   * @returns 执行结果
   */
  private async executeCustomAction(task: Task): Promise<TaskExecutionResult> {
    console.log(`执行自定义任务: ${task.id}`);
    const customAction = task.action as CustomAction;
    
    try {
      // 验证自定义配置
      if (!customAction.config) {
        throw new Error('自定义操作缺少配置');
      }
      
      // 获取操作类型
      const operationType = customAction.config.operationType || 'unknown';
      
      // 根据操作类型执行对应的处理逻辑
      switch (operationType) {
        case 'logBookmarks':
          // 模拟记录书签总数的操作
          const bookmarksResult = await bookmarkService.getAllBookmarks();
          if (!bookmarksResult.success) {
            throw new Error(`获取书签失败: ${bookmarksResult.error}`);
          }
          
          const totalBookmarks = bookmarksResult.data.length;
          return {
            success: true,
            timestamp: Date.now(),
            details: `成功记录当前书签状态：共有 ${totalBookmarks} 个书签`
          };
          
        default:
          // 对于未知的操作类型，返回一个通用的成功结果
          return {
            success: true,
            timestamp: Date.now(),
            details: `执行了自定义操作 ${operationType}，配置: ${JSON.stringify(customAction.config)}`
          };
      }
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: `自定义操作失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// 导出单例实例
const taskExecutor = TaskExecutor.getInstance();
export default taskExecutor; 