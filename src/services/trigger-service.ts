/**
 * 触发器服务
 * 管理基于事件的触发器
 */

import { Task, TaskStatus, TriggerType, EventType } from '../types/task';
import taskService from './task-service';
import storageService from '../utils/storage-service';
import { isRecentSelfWriteCompletion } from './task-executor-lease';
import { BookmarkWriteLease, BOOKMARK_WRITE_LEASE_KEY } from './task-executor-types';

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
   * 兼容旧数据：旧版本用 FAILED 表示“上次执行失败”，现已由 task-service
   * 在读取时迁移为 ENABLED。此处仅兜底处理绕过规范化写入的遗留 FAILED 任务，
   * 执行结果不再参与启用状态的恢复判定
   */
  public async tryRecoverFailedTasks(): Promise<void> {
    try {
      const result = await taskService.getTasksByStatus(TaskStatus.FAILED);
      if (!result.success) {
        console.error('获取遗留失败任务列表失败:', result.error);
        return;
      }

      const legacyFailedTasks = result.data as Task[];
      for (const task of legacyFailedTasks) {
        const recoverResult = await taskService.setTaskStatus(task.id, TaskStatus.ENABLED);
        if (recoverResult.success) {
          console.log(`已将遗留失败任务 ${task.id} 迁移为 ENABLED`);
        }
      }
    } catch (error) {
      console.error('迁移遗留失败任务时出错:', error);
    }
  }

  /**
   * 读取仍在有效期内的书签写入租约
   * 任务执行整理/恢复时会持续修改书签树，其自身写入产生的 BOOKMARK_CHANGED
   * 事件不应再次触发同一任务；租约只用于识别持有者，不阻止其他任务响应用户操作
   */
  private async getActiveBookmarkWriteLease(): Promise<BookmarkWriteLease | null> {
    try {
      const result = await storageService.getStorageData(BOOKMARK_WRITE_LEASE_KEY);
      if (!result.success || !result.data) {
        return null;
      }

      const lease = result.data as Partial<BookmarkWriteLease>;
      if (
        typeof lease.taskId !== 'string' ||
        typeof lease.expiresAt !== 'number' ||
        lease.expiresAt <= Date.now()
      ) {
        return null;
      }
      return lease as BookmarkWriteLease;
    } catch (error) {
      console.error('读取书签写入租约失败:', error);
      return null;
    }
  }

  /**
   * 处理事件触发
   * @param eventType 事件类型
   * @param eventData 事件数据
   */
  public async handleEventTrigger(eventType: EventType, eventData?: any): Promise<void> {
    try {
      // 获取所有已启用的任务
      const result = await taskService.getTasksByStatus(TaskStatus.ENABLED);
      if (!result.success) {
        console.error('获取已启用任务失败:', result.error);
        return;
      }

      const enabledTasks = result.data as Task[];

      // 书签变更可能由任务自身的整理/恢复写入产生：
      // 写入租约持有者跳过本次 BOOKMARK_CHANGED，避免自触发循环
      const activeWriteLease = eventType === EventType.BOOKMARK_CHANGED
        ? await this.getActiveBookmarkWriteLease()
        : null;

      // 筛选与事件类型匹配的事件触发器任务
      const matchingTasks = enabledTasks.filter(task => {
        if (activeWriteLease?.taskId === task.id) {
          console.log(`任务 ${task.id} 正在写入书签，跳过其自身写入产生的 ${eventType} 事件`);
          return false;
        }
        // 写入租约释放后浏览器仍可能派发迟到的自身写入事件；
        // 仅在短窗口内忽略同一任务，其他任务与用户后续操作不受影响
        if (eventType === EventType.BOOKMARK_CHANGED && isRecentSelfWriteCompletion(task.id)) {
          console.log(`任务 ${task.id} 刚完成书签写入，跳过迟到的 ${eventType} 事件`);
          return false;
        }
        return task.trigger.type === TriggerType.EVENT &&
               task.trigger.event === eventType &&
               this.matchesConditions(task, eventData);
      });
      
      if (matchingTasks.length === 0) {
        return;
      }
      
      console.log(`找到 ${matchingTasks.length} 个匹配事件 ${eventType} 的任务, 准备执行...`);
      
      // 导入任务执行器
      const taskExecutor = (await import('./task-executor')).default;
      
      // 执行匹配的任务
      for (const task of matchingTasks) {
        console.log(`开始执行事件触发任务: ${task.name} (${task.id})`);
        
        // 更新上次触发时间
        if (task.trigger.type === TriggerType.EVENT) {
          task.trigger.lastTriggered = Date.now();
          await taskService.updateTask(task.id, { 
            trigger: task.trigger 
          });
        }
        
        try {
          // 事件自动触发路径：执行来源为 event
          const result = await taskExecutor.executeTask(task.id, 0, 'event');
          
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

  /**
   * 检查任务条件是否与事件数据匹配
   * @param task 任务对象
   * @param eventData 事件数据
   * @returns 是否匹配
   */
  private matchesConditions(task: Task, eventData?: any): boolean {
    // 如果没有事件数据或没有条件，则视为匹配
    if (!eventData || !task.trigger.type || task.trigger.type !== TriggerType.EVENT) {
      return true;
    }
    
    const trigger = task.trigger;
    const conditions = trigger.conditions;
    
    // 如果没有设置条件，则视为匹配
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }
    
    console.log(`检查任务 ${task.id} 的条件是否匹配`, conditions);
    
    // 根据不同事件类型检查不同条件
    switch (trigger.event) {
      // 书签变更事件（包括创建、删除、修改、移动）
      case EventType.BOOKMARK_CHANGED:
        return this.matchBookmarkConditions(conditions, eventData);
      
      // 浏览器和扩展事件
      case EventType.BROWSER_STARTUP:
      case EventType.EXTENSION_CLICKED:
        // 死代码：BROWSER_STARTUP 调用时不携带 eventData（本方法第一行
        // !eventData 即返回 true），EXTENSION_CLICKED 因已配置
        // action.default_popup 永远不会触发，且任务配置 UI 不为这两类事件
        // 设置 conditions，故此分支不可达；保留以防御未来改动
        return true;
      
      default:
        // 未知事件类型默认匹配
        return true;
    }
  }
  
  /**
   * 检查书签条件是否匹配
   * @param conditions 条件配置
   * @param bookmarkData 书签数据
   * @returns 是否匹配
   */
  private matchBookmarkConditions(conditions: Record<string, any>, bookmarkData: any): boolean {
    // 如果没有书签数据，则视为不匹配
    if (!bookmarkData || (!bookmarkData.bookmark && !bookmarkData.removeInfo)) {
      return false;
    }
    
    // 书签删除事件特殊处理
    if (bookmarkData.removeInfo) {
      // 对于删除事件，可能只能检查父文件夹ID
      if (conditions.parentFolder) {
        // 配置了父文件夹条件但删除数据缺少 parentId（浏览器可能不提供）时，
        // 按不匹配处理，避免被误放行
        return !!bookmarkData.removeInfo.parentId &&
               bookmarkData.removeInfo.parentId === conditions.parentFolder;
      }
      // 如果没有指定父文件夹条件，则视为匹配
      return true;
    }
    
    const bookmark = bookmarkData.bookmark;
    let isMatch = true;
    
    // URL匹配：仅当配置了 url 条件时才参与判断。
    // 字段缺失时（如 moved 事件只携带 id/parentId）视为不匹配，
    // 避免“条件已配置但数据无此字段”被误放行
    if (conditions.url) {
      isMatch = isMatch && !!bookmark.url && bookmark.url.includes(conditions.url);
    }
    
    // 标题匹配：同上，changed/moved 事件可能不携带 title 字段
    if (conditions.title) {
      isMatch = isMatch && !!bookmark.title && bookmark.title.includes(conditions.title);
    }
    
    // 父文件夹匹配：同上，changed 事件不携带 parentId 字段
    if (conditions.parentFolder) {
      isMatch = isMatch && !!bookmark.parentId && bookmark.parentId === conditions.parentFolder;
    }
    
    return isMatch;
  }
}

// 导出单例实例
const triggerService = TriggerService.getInstance();
export default triggerService; 
