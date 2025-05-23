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
  PushAction,
  TaskExecutionResult,
  TriggerType,
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
    // 创建初始执行结果对象
    let executionResult: TaskExecutionResult = {
      success: false,
      timestamp: Date.now(),
      details: ''
    };
    
    // 检查任务是否已在执行中
    if (this.executingTasks.has(taskId)) {
      console.warn(`任务 ${taskId} 正在执行中，跳过...`);
      executionResult.error = '任务正在执行中';
      return executionResult;
    }
    
    // 将任务添加到执行中集合
    this.executingTasks.add(taskId);
    
    const executionStartTime = new Date();
    console.log(`[${executionStartTime.toLocaleString()}] 开始执行任务: ${taskId}${retryCount > 0 ? ` (重试 ${retryCount}/${this.config.maxRetries})` : ''}`);
    
    try {
      // 获取任务详情
      const taskResult = await taskService.getTaskById(taskId);
      
      // 如果找不到任务，返回失败
      if (!taskResult.success) {
        executionResult.error = `获取任务失败: ${taskResult.error}`;
        executionResult.timestamp = Date.now();
        return executionResult;
      }
      
      const task = taskResult.data as Task;
      
      // 任务执行前更新任务状态为RUNNING
      await taskService.setTaskStatus(taskId, TaskStatus.RUNNING);
      
      // 开始计时
      const startTime = Date.now();
      
      // 设置初始执行结果
      executionResult = {
        success: false,
        timestamp: startTime,
        details: ''
      };
      
      // 创建超时Promise
      const timeoutPromise = new Promise<TaskExecutionResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`任务执行超时(${this.config.timeout / 1000}秒)`));
        }, this.config.timeout);
      });
      
      // 创建执行Promise
      const executePromise = (async () => {
        // 根据任务类型执行不同的操作
        switch (task.action.type) {
          case ActionType.BACKUP:
            return await this.executeBackupAction(task);
          case ActionType.ORGANIZE:
            return await this.executeOrganizeAction(task);
          case ActionType.PUSH:
            return await this.executePushAction(task);
          default:
            throw new Error(`不支持的任务类型: ${(task.action as any).type}`);
        }
      })();
      
      // 竞争模式，哪个先完成就用哪个结果
      executionResult = await Promise.race([executePromise, timeoutPromise]);
      
      // 添加执行持续时间
      executionResult.duration = Date.now() - startTime;
      
      // 更新任务执行历史记录
      console.log(`更新任务 ${taskId} 执行历史记录...`);
      await taskService.updateTaskExecutionHistory(taskId, executionResult);
      
      // 恢复任务状态为启用
      console.log(`恢复任务 ${taskId} 状态为 ENABLED`);
      await taskService.setTaskStatus(taskId, TaskStatus.ENABLED);
      
      const executionEndTime = new Date();
      const executionTimeMessage = `开始: ${executionStartTime.toLocaleString()}, 结束: ${executionEndTime.toLocaleString()}, 耗时: ${Math.round((executionEndTime.getTime() - executionStartTime.getTime()) / 1000)}秒`;
      console.log(`任务 ${taskId} 执行完成, 结果: ${executionResult.success ? '成功' : '失败'}, ${executionTimeMessage}`);
      return executionResult;
    } catch (error) {
      // 处理错误，判断是否需要重试
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`任务 ${taskId} 执行出错:`, errorMessage);
      
      // 确保startTime变量存在（在try块中可能未定义）
      const startTime = executionResult.timestamp || Date.now();
      
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
      console.log(`更新任务 ${taskId} 执行历史(失败)...`);
      await taskService.updateTaskExecutionHistory(taskId, executionResult);
      
      // 将任务状态设置为失败
      console.log(`更新任务 ${taskId} 状态为 FAILED`);
      await taskService.setTaskStatus(taskId, TaskStatus.FAILED);
      
      const executionEndTime = new Date();
      const executionTimeMessage = `开始: ${executionStartTime.toLocaleString()}, 结束: ${executionEndTime.toLocaleString()}, 耗时: ${Math.round((executionEndTime.getTime() - executionStartTime.getTime()) / 1000)}秒`;
      console.error(`任务 ${taskId} 执行失败: ${errorMessage}, ${executionTimeMessage}`);
    } finally {
      // 无论结果如何，从执行中任务集合中移除
      this.executingTasks.delete(taskId);
      console.log(`任务 ${taskId} 已从执行队列移除`);
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
    console.log(`执行备份任务: ${task.id}, 操作类型: ${(task.action as BackupAction).operation || 'backup'}`);
    const backupAction = task.action as BackupAction;
    
    try {
      // 获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      
      if (!credentialsResult.success || !credentialsResult.data) {
        console.error(`任务${task.id}执行失败: 未找到GitHub凭据`);
        return {
          success: false,
          timestamp: Date.now(),
          error: '未找到GitHub凭据，请先在同步设置中配置GitHub账号',
          details: '请打开扩展的同步页面，完成GitHub账号授权后再执行此任务'
        };
      }
      
      const credentials = credentialsResult.data;
      
      // 获取GitHub用户名并验证凭据有效性
      let username = 'user'; // 默认占位符
      try {
        console.log(`验证GitHub凭据...`);
        const userResult = await githubService.validateCredentials(credentials);
        username = userResult.login;
        console.log(`GitHub凭据验证成功，用户: ${username}`);
      } catch (error) {
        console.error(`GitHub凭据验证失败:`, error);
        return {
          success: false,
          timestamp: Date.now(),
          error: `GitHub凭据无效或已过期: ${error instanceof Error ? error.message : String(error)}`,
          details: '请重新登录GitHub账号，更新授权信息后再执行此任务'
        };
      }
      
      // 根据操作类型执行不同的操作
      if (backupAction.operation === 'backup' || !backupAction.operation) {
        // 执行备份操作 (上传)
        console.log(`开始执行备份操作，上传书签到GitHub...`);
        const backupResult = await backupService.backupToGitHub(
          credentials,
          username
        );
        
        if (!backupResult.success) {
          console.error(`GitHub备份失败:`, backupResult.error);
          return {
            success: false,
            timestamp: Date.now(),
            error: `GitHub备份失败: ${backupResult.error}`,
            details: '备份过程中发生错误，请检查网络连接和GitHub仓库权限'
          };
        }
        
        console.log(`备份成功完成，书签数:`, backupResult.data?.bookmarksCount);
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
        
        console.log(`开始执行恢复操作，从GitHub下载书签`, 
          useTimestampedFile ? `，使用指定文件: ${timestampedFilePath}` : '，使用最新文件');
          
        const restoreResult = await backupService.restoreFromGitHub(
          credentials,
          username,
          useTimestampedFile,
          timestampedFilePath
        );
        
        if (!restoreResult.success) {
          console.error(`从GitHub恢复失败:`, restoreResult.error);
          return {
            success: false,
            timestamp: Date.now(),
            error: `从GitHub恢复失败: ${restoreResult.error}`,
            details: '恢复过程中发生错误，请检查备份文件是否存在和有效'
          };
        }
        
        console.log(`恢复成功完成，书签数:`, restoreResult.data?.bookmarksCount);
        return {
          success: true,
          timestamp: Date.now(),
          details: `成功从GitHub恢复书签${
            restoreResult.data?.bookmarksCount ? `，恢复了 ${restoreResult.data.bookmarksCount} 个书签` : ''
          }`
        };
      } else {
        console.error(`不支持的备份操作: ${backupAction.operation}`);
        return {
          success: false,
          timestamp: Date.now(),
          error: `不支持的备份操作: ${backupAction.operation}`,
          details: '任务配置错误，请修改任务设置中的操作类型'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`备份/恢复任务执行异常:`, errorMessage);
      
      return {
        success: false,
        timestamp: Date.now(),
        error: `备份/恢复失败: ${errorMessage}`,
        details: '执行过程中发生未预期的错误，请检查控制台日志获取更多信息'
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
   * 执行推送书签操作
   * @param task 任务对象
   * @returns 执行结果
   */
  private async executePushAction(task: Task): Promise<TaskExecutionResult> {
    console.log(`执行推送书签任务: ${task.id}`);
    const pushAction = task.action as PushAction;
    
    try {
      // 获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      
      if (!credentialsResult.success || !credentialsResult.data) {
        console.error(`任务${task.id}执行失败: 未找到GitHub凭据`);
        return {
          success: false,
          timestamp: Date.now(),
          error: '未找到GitHub凭据，请先在同步设置中配置GitHub账号',
          details: '请打开扩展的同步页面，完成GitHub账号授权后再执行此任务'
        };
      }
      
      const credentials = credentialsResult.data;
      
      // 获取GitHub用户名并验证凭据有效性
      let username = 'user'; // 默认占位符
      try {
        console.log(`验证GitHub凭据...`);
        const userResult = await githubService.validateCredentials(credentials);
        username = userResult.login;
        console.log(`GitHub凭据验证成功，用户: ${username}`);
      } catch (error) {
        console.error(`GitHub凭据验证失败:`, error);
        return {
          success: false,
          timestamp: Date.now(),
          error: `GitHub凭据无效或已过期: ${error instanceof Error ? error.message : String(error)}`,
          details: '请重新登录GitHub账号，更新授权信息后再执行此任务'
        };
      }
      
      // 执行推送书签操作
      console.log(`开始执行推送书签操作，目标仓库: ${pushAction.options.repoName}/${pushAction.options.folderPath}...`);
      const pushResult = await backupService.pushBookmarksToGitHub(
        credentials,
        username,
        pushAction.options.repoName,
        pushAction.options.folderPath,
        pushAction.options.commitMessage
      );
      
      if (!pushResult.success) {
        console.error(`推送书签失败:`, pushResult.error);
        return {
          success: false,
          timestamp: Date.now(),
          error: `推送书签失败: ${pushResult.error}`,
          details: '推送过程中发生错误，请检查网络连接和GitHub仓库权限'
        };
      }
      
      console.log(`推送书签成功完成，文件URL:`, pushResult.data?.fileUrl);
      return {
        success: true,
        timestamp: Date.now(),
        details: `成功推送书签到GitHub: ${pushResult.data?.fileUrl || '无文件URL'}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`推送书签任务执行异常:`, errorMessage);
      
      return {
        success: false,
        timestamp: Date.now(),
        error: `推送书签失败: ${errorMessage}`,
        details: '执行过程中发生未预期的错误，请检查控制台日志获取更多信息'
      };
    }
  }

  /**
   * 执行任务的操作部分
   * @param task 任务对象
   * @returns 执行结果
   */
  private async executeTaskAction(task: Task): Promise<TaskExecutionResult> {
    console.log(`执行任务操作: ${task.id}, 类型: ${task.action.type}`);
    
    try {
      switch (task.action.type) {
        case ActionType.BACKUP:
          return await this.executeBackupAction(task);
        case ActionType.ORGANIZE:
          return await this.executeOrganizeAction(task);
        case ActionType.PUSH:
          return await this.executePushAction(task);
        default:
          return {
            success: false,
            timestamp: Date.now(),
            error: `不支持的操作类型: ${(task.action as any).type}`
          };
      }
    } catch (error) {
      console.error(`执行任务操作异常:`, error);
      return {
        success: false,
        timestamp: Date.now(),
        error: `执行失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// 导出单例实例
const taskExecutor = TaskExecutor.getInstance();
export default taskExecutor; 