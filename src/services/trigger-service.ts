/**
 * 触发器服务
 * 管理基于时间的触发器，使用Chrome Alarms API
 */

import { Task, TaskStatus, TimeTrigger, TimeScheduleType, TriggerType } from '../types/task';
import taskService from './task-service';
import { calculateNextTriggerTime, getAlarmInfo } from '../utils/trigger-utils';

// 任务ID前缀，用于创建alarm名称
const TASK_ALARM_PREFIX = 'task_alarm_';

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
      
      // 同步所有启用的任务的alarms
      await this.syncAllTaskAlarms();
      
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
   * 从alarm名称中提取任务ID
   * @param alarmName alarm名称
   * @returns 任务ID或null（如果不是任务alarm）
   */
  public getTaskIdFromAlarmName(alarmName: string): string | null {
    if (alarmName.startsWith(TASK_ALARM_PREFIX)) {
      return alarmName.substring(TASK_ALARM_PREFIX.length);
    }
    return null;
  }

  /**
   * 根据任务创建或更新alarm
   * @param task 任务对象
   * @returns 是否成功创建/更新alarm
   */
  public async createOrUpdateAlarm(task: Task): Promise<boolean> {
    try {
      // 如果任务不是基于时间的触发器，或者任务被禁用，则不创建alarm
      if (task.trigger.type !== TriggerType.TIME || task.status !== TaskStatus.ENABLED) {
        // 如果存在对应的alarm，则删除它
        await this.removeAlarm(task.id);
        return true;
      }

      const timeTrigger = task.trigger as TimeTrigger;
      
      // 获取alarm信息
      const alarmInfo = getAlarmInfo(timeTrigger);
      if (!alarmInfo) {
        console.error(`无法为任务 ${task.id} 创建有效的alarm信息`);
        return false;
      }

      // 创建或更新alarm
      const alarmName = this.getAlarmNameForTask(task.id);
      
      // 先清除可能存在的旧alarm
      await this.removeAlarm(task.id);
      
      // 创建新alarm
      chrome.alarms.create(alarmName, alarmInfo);
      
      // 更新任务的下一次触发时间
      const nextTriggerTime = calculateNextTriggerTime(timeTrigger);
      await taskService.updateTask(task.id, {
        trigger: {
          ...timeTrigger,
          nextTrigger: nextTriggerTime
        } as TimeTrigger
      });

      console.log(`为任务 ${task.id} 创建/更新alarm成功, 下次触发: ${new Date(nextTriggerTime).toLocaleString()}`);
      return true;
    } catch (error) {
      console.error(`为任务 ${task.id} 创建/更新alarm失败:`, error);
      return false;
    }
  }

  /**
   * 删除任务对应的alarm
   * @param taskId 任务ID
   * @returns 是否成功删除alarm
   */
  public async removeAlarm(taskId: string): Promise<boolean> {
    try {
      const alarmName = this.getAlarmNameForTask(taskId);
      await chrome.alarms.clear(alarmName);
      return true;
    } catch (error) {
      console.error(`删除任务 ${taskId} 的alarm失败:`, error);
      return false;
    }
  }

  /**
   * 同步所有已启用任务的alarms
   */
  public async syncAllTaskAlarms(): Promise<void> {
    try {
      // 获取所有已启用的任务
      const result = await taskService.getTasksByStatus(TaskStatus.ENABLED);
      if (!result.success) {
        throw new Error(`获取已启用任务失败: ${result.error}`);
      }

      const enabledTasks = result.data as Task[];
      
      // 清除所有现有的任务alarms
      await this.clearAllTaskAlarms();
      
      // 为每个启用的任务创建alarm
      for (const task of enabledTasks) {
        if (task.trigger.type === TriggerType.TIME) {
          await this.createOrUpdateAlarm(task);
        }
      }
      
      console.log(`同步了 ${enabledTasks.length} 个任务的alarms`);
    } catch (error) {
      console.error('同步任务alarms失败:', error);
    }
  }

  /**
   * 清除所有任务相关的alarms
   */
  private async clearAllTaskAlarms(): Promise<void> {
    try {
      const alarms = await chrome.alarms.getAll();
      for (const alarm of alarms) {
        if (alarm.name.startsWith(TASK_ALARM_PREFIX)) {
          await chrome.alarms.clear(alarm.name);
        }
      }
    } catch (error) {
      console.error('清除所有任务alarms失败:', error);
    }
  }

  /**
   * 获取任务对应的alarm名称
   * @param taskId 任务ID
   * @returns alarm名称
   */
  private getAlarmNameForTask(taskId: string): string {
    return `${TASK_ALARM_PREFIX}${taskId}`;
  }
}

// 导出单例实例
const triggerService = TriggerService.getInstance();
export default triggerService; 