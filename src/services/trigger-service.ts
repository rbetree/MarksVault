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
      await this.syncAllTaskAlarms();
    } catch (error) {
      console.error('初始化触发器服务失败:', error);
    }
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

  /**
   * 从alarm名称提取任务ID
   * @param alarmName alarm名称
   * @returns 任务ID
   */
  public getTaskIdFromAlarmName(alarmName: string): string | null {
    if (!alarmName.startsWith(TASK_ALARM_PREFIX)) {
      return null;
    }
    return alarmName.substring(TASK_ALARM_PREFIX.length);
  }
}

// 导出单例实例
const triggerService = TriggerService.getInstance();
export default triggerService; 