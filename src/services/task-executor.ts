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
  TaskExecutionResult,
  TriggerType
} from '../types/task';
import taskService from './task-service';
import backupService from './backup-service';
// 其他可能需要的服务导入...

class TaskExecutor {
  private static instance: TaskExecutor;
  
  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {}
  
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
   * 执行任务
   * @param taskId 要执行的任务ID
   * @returns 执行结果
   */
  public async executeTask(taskId: string): Promise<TaskExecutionResult> {
    console.log(`开始执行任务: ${taskId}`);
    
    const startTime = Date.now();
    let executionResult: TaskExecutionResult = {
      success: false,
      timestamp: startTime,
      details: '',
      error: ''
    };
    
    try {
      // 获取任务
      const taskResult = await taskService.getTaskById(taskId);
      if (!taskResult.success) {
        throw new Error(`获取任务失败: ${taskResult.error}`);
      }
      
      const task = taskResult.data as Task;
      
      // 检查任务是否启用
      if (task.status !== TaskStatus.ENABLED) {
        throw new Error(`任务当前未启用，无法执行`);
      }
      
      // 将任务状态设置为执行中
      await taskService.setTaskStatus(taskId, TaskStatus.RUNNING);
      
      // 根据任务类型执行操作
      switch (task.action.type) {
        case ActionType.BACKUP:
          executionResult = await this.executeBackupAction(task);
          break;
        case ActionType.ORGANIZE:
          executionResult = await this.executeOrganizeAction(task);
          break;
        case ActionType.CUSTOM:
          executionResult = await this.executeCustomAction(task);
          break;
        default:
          throw new Error(`不支持的任务类型: ${(task.action as { type: string }).type}`);
      }
      
      // 记录执行时长
      executionResult.duration = Date.now() - startTime;
      
      // 更新任务历史记录
      await taskService.updateTaskExecutionHistory(taskId, executionResult);
      
      // 判断任务是否为一次性任务
      // 使用类型断言确保TypeScript能理解task.trigger的结构
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
      // 记录错误信息
      executionResult.success = false;
      executionResult.error = error instanceof Error ? error.message : String(error);
      executionResult.duration = Date.now() - startTime;
      
      // 更新任务历史记录
      await taskService.updateTaskExecutionHistory(taskId, executionResult);
      
      // 将任务状态设置为失败
      await taskService.setTaskStatus(taskId, TaskStatus.FAILED);
      
      console.error(`任务 ${taskId} 执行失败:`, error);
      return executionResult;
    }
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
      // 执行备份操作
      if (backupAction.target === 'github') {
        // 获取GitHub凭据
        const storageService = (await import('../utils/storage-service')).default;
        const credentialsResult = await storageService.getGitHubCredentials();
        
        if (!credentialsResult.success || !credentialsResult.data) {
          throw new Error('未找到GitHub凭据，请先在同步设置中配置');
        }
        
        const credentials = credentialsResult.data;
        // 使用GitHub API需要用户名，从token中提取或使用默认值
        // GitHub个人访问令牌通常不包含用户名信息，因此使用'user'作为占位符
        // 实际操作中，可能需要通过单独的接口获取用户名或预先存储
        const username = 'user'; // 此处使用placeholder
        
        // 调用备份服务进行GitHub备份
        // 注意：备份选项如commitMessage在此不传递，需要在backup-service中处理
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
          details: `成功备份书签到GitHub: ${backupResult.data?.commitUrl || '无提交URL'}`
        };
      } else {
        throw new Error(`不支持的备份目标: ${backupAction.target}`);
      }
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: `备份失败: ${error instanceof Error ? error.message : String(error)}`
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
      // 由于整理功能可能尚未完成，这里先返回一个模拟结果
      // TODO: 实现实际的书签整理功能
      return {
        success: true,
        timestamp: Date.now(),
        details: `[模拟] 成功执行了 ${organizeAction.operations.length} 个整理操作`
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
    
    try {
      // 由于自定义操作是预留的扩展点，这里先返回一个模拟结果
      // TODO: 实现实际的自定义操作处理逻辑
      return {
        success: true,
        timestamp: Date.now(),
        details: `[模拟] 成功执行了自定义操作`
      };
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