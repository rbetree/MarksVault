/**
 * 触发器服务
 * 管理基于事件的触发器
 */

import { Task, TaskStatus, TriggerType, EventType } from '../types/task';
import taskService from './task-service';

class TriggerService {
  private static instance: TriggerService;

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {}

  /**
   * 获取TriggerService实例
   * @returns TriggerService单例
   */
  public static getInstance(): TriggerService {
    if (!TriggerService.instance) {
      TriggerService.instance = new TriggerService();
    }
    return TriggerService.instance;
  }

  /**
   * 初始化触发器服务
   * 在扩展启动时调用
   */
  public async init(): Promise<void> {
    try {
      console.log('初始化触发器服务...');
      
      // 尝试恢复失败的任务
      await this.tryRecoverFailedTasks();
      
      console.log('触发器服务初始化完成');
    } catch (error) {
      console.error('初始化触发器服务失败:', error);
    }
  }

  /**
   * 尝试恢复因特定原因失败的任务
   * 主要针对因GitHub凭据问题而失败的任务
   */
  public async tryRecoverFailedTasks(): Promise<void> {
    try {
      // 获取所有失败状态的任务
      const result = await taskService.getTasksByStatus(TaskStatus.FAILED);
      if (!result.success) {
        console.error('获取失败任务列表失败:', result.error);
        return;
      }

      const failedTasks = result.data as Task[];
      if (failedTasks.length === 0) {
        return; // 没有失败的任务，直接返回
      }

      console.log(`找到 ${failedTasks.length} 个失败状态的任务，尝试恢复...`);
      
      let recoveredCount = 0;
      
      // 检查每个失败的任务，判断是否可以恢复
      for (const task of failedTasks) {
        // 查看最后执行的历史记录
        const lastExecution = task.history.lastExecution;
        
        // 如果没有执行历史，或者最后执行成功，则不需要恢复
        if (!lastExecution || lastExecution.success) {
          continue;
        }
        
        // 检查错误原因
        const errorMessage = lastExecution.error || '';
        
        // 如果是凭据相关错误，不自动恢复，需要用户先更新凭据
        const isCredentialError = errorMessage.includes('GitHub凭据') || 
                                errorMessage.includes('未找到GitHub凭据') ||
                                errorMessage.includes('凭据无效');
        
        if (isCredentialError) {
          console.log(`任务 ${task.id} 因GitHub凭据问题失败，需要用户在同步页面重新授权后才能恢复`);
          continue;
        }
        
        // 其他类型的错误可以尝试自动恢复
        // 例如网络错误、临时服务不可用等
        await taskService.setTaskStatus(task.id, TaskStatus.ENABLED);
        recoveredCount++;
        
        console.log(`已自动恢复任务 ${task.id} 的状态为 ENABLED`);
      }
      
      if (recoveredCount > 0) {
        console.log(`成功恢复了 ${recoveredCount} 个失败的任务`);
      }
    } catch (error) {
      console.error('恢复失败任务时出错:', error);
    }
  }

  /**
   * 处理事件触发
   * @param eventType 事件类型
   * @param eventData 事件数据
   */
  public async handleEventTrigger(eventType: EventType, eventData?: any): Promise<void> {
    try {
      console.log(`处理事件触发: ${eventType}`);
      
      // 获取所有已启用的任务
      const result = await taskService.getTasksByStatus(TaskStatus.ENABLED);
      if (!result.success) {
        console.error('获取已启用任务失败:', result.error);
        return;
      }

      const enabledTasks = result.data as Task[];
      
      // 筛选与事件类型匹配的事件触发器任务
      const matchingTasks = enabledTasks.filter(task => 
        task.trigger.type === TriggerType.EVENT && 
        task.trigger.event === eventType
      );
      
      if (matchingTasks.length === 0) {
        console.log(`没有找到对应事件 ${eventType} 的任务`);
        return;
      }
      
      console.log(`找到 ${matchingTasks.length} 个匹配事件 ${eventType} 的任务, 准备执行...`);
      
      // 导入任务执行器
      const taskExecutor = (await import('./task-executor')).default;
      
      // 执行匹配的任务
      for (const task of matchingTasks) {
        console.log(`开始执行事件触发任务: ${task.name} (${task.id})`);
        
        try {
          const result = await taskExecutor.executeTask(task.id);
          
          if (result.success) {
            console.log(`事件触发任务 ${task.name} (${task.id}) 执行成功: ${result.details || '无详细信息'}`);
          } else {
            console.error(`事件触发任务 ${task.name} (${task.id}) 执行失败: ${result.error || '未知错误'}`);
          }
        } catch (error) {
          console.error(`执行事件触发任务 ${task.name} (${task.id}) 时出错:`, error);
        }
      }
    } catch (error) {
      console.error(`处理事件触发失败: ${eventType}`, error);
    }
  }
}

// 导出单例实例
const triggerService = TriggerService.getInstance();
export default triggerService; 