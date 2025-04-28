/**
 * 任务数据结构定义
 * 用于自动化任务功能
 */

// 任务状态枚举
export enum TaskStatus {
  ENABLED = 'enabled',   // 已启用，等待执行
  DISABLED = 'disabled', // 已禁用，不会执行
  RUNNING = 'running',   // 正在执行
  COMPLETED = 'completed', // 执行完成（一次性任务）
  FAILED = 'failed'      // A状态，上次执行失败
}

// 触发器类型枚举
export enum TriggerType {
  TIME = 'time',       // 基于时间的触发器（使用Alarms API）
  EVENT = 'event'      // 基于事件的触发器
}

// 基础触发器接口
export interface BaseTrigger {
  type: TriggerType;   // 触发器类型
  enabled: boolean;    // 触发器是否启用
}

// 时间触发器类型枚举
export enum TimeScheduleType {
  ONCE = 'once',           // 一次性
  INTERVAL = 'interval',   // 固定时间间隔
  DAILY = 'daily',         // 每天特定时间
  WEEKLY = 'weekly',       // 每周特定时间
  MONTHLY = 'monthly'      // 每月特定时间
}

// 事件类型枚举
export enum EventType {
  BROWSER_STARTUP = 'browser_startup',  // 浏览器启动
  BOOKMARK_CREATED = 'bookmark_created', // 书签创建
  BOOKMARK_REMOVED = 'bookmark_removed', // 书签删除
  BOOKMARK_CHANGED = 'bookmark_changed', // 书签修改
  BOOKMARK_MOVED = 'bookmark_moved'      // 书签移动
}

// 时间触发器接口
export interface TimeTrigger extends BaseTrigger {
  type: TriggerType.TIME;
  schedule: {
    type: TimeScheduleType;
    // 对于ONCE类型
    when?: number;              // 触发时间戳（毫秒）
    // 对于INTERVAL类型
    intervalMinutes?: number;   // 间隔分钟数
    // 对于DAILY/WEEKLY/MONTHLY类型
    hour?: number;              // 小时 (0-23)
    minute?: number;            // 分钟 (0-59)
    // 对于WEEKLY类型
    dayOfWeek?: number;         // 星期几 (0-6，0为周日)
    // 对于MONTHLY类型
    dayOfMonth?: number;        // 月中日期 (1-31)
  };
  lastTriggered?: number;       // 上次触发时间戳
  nextTrigger?: number;         // 下次预计触发时间戳
}

// 事件触发器接口
export interface EventTrigger extends BaseTrigger {
  type: TriggerType.EVENT;
  event: EventType;             // 事件类型
  conditions?: {                // 可选的条件过滤
    [key: string]: any;         // 条件过滤键值对
  };
  lastTriggered?: number;       // 上次触发时间戳
}

// 触发器联合类型
export type Trigger = TimeTrigger | EventTrigger;

// 任务操作类型枚举
export enum ActionType {
  BACKUP = 'backup',         // 书签备份
  ORGANIZE = 'organize',     // 书签整理
  CUSTOM = 'custom'          // 自定义操作（预留扩展）
}

// 基础操作接口
export interface BaseAction {
  type: ActionType;          // 操作类型
  description: string;       // 操作描述
}

// 备份操作接口
export interface BackupAction extends BaseAction {
  type: ActionType.BACKUP;
  target: 'github';          // 备份目标（目前仅支持GitHub）
  options: {
    commitMessage?: string;  // 提交消息
    includeMetadata?: boolean; // 是否包含元数据
  };
}

// 书签整理操作接口
export interface OrganizeAction extends BaseAction {
  type: ActionType.ORGANIZE;
  operations: Array<{
    operation: 'move' | 'delete' | 'rename' | 'validate'; // 整理操作类型
    filters?: {              // 筛选条件
      pattern?: string;      // URL或标题匹配模式
      folder?: string;       // 指定文件夹ID
      olderThan?: number;    // 早于指定天数
      newerThan?: number;    // 晚于指定天数
    };
    target?: string;         // 目标文件夹ID（用于移动操作）
    newName?: string;        // 新名称（用于重命名操作）
  }>;
}

// 自定义操作接口（预留扩展）
export interface CustomAction extends BaseAction {
  type: ActionType.CUSTOM;
  config: any;              // 自定义配置
}

// 操作联合类型
export type Action = BackupAction | OrganizeAction | CustomAction;

// 任务执行结果接口
export interface TaskExecutionResult {
  success: boolean;         // 执行是否成功
  timestamp: number;        // 执行时间戳
  duration?: number;        // 执行持续时间（毫秒）
  details?: string;         // 执行详情
  error?: string;           // 错误信息（如果失败）
}

// 任务执行历史记录接口
export interface TaskExecutionHistory {
  executions: TaskExecutionResult[]; // 执行结果数组
  lastExecution?: TaskExecutionResult; // 最后一次执行结果
}

// 任务接口
export interface Task {
  id: string;               // 任务唯一ID
  name: string;             // 任务名称
  description?: string;     // 任务描述
  status: TaskStatus;       // 任务状态
  createdAt: number;        // 创建时间戳
  updatedAt: number;        // 更新时间戳
  trigger: Trigger;         // 触发器
  action: Action;           // 任务操作
  history: TaskExecutionHistory; // 执行历史
}

// 创建默认任务工厂函数
export const createDefaultTask = (): Task => {
  const now = Date.now();
  return {
    id: `task_${now}`,
    name: '新建任务',
    description: '',
    status: TaskStatus.DISABLED,
    createdAt: now,
    updatedAt: now,
    trigger: {
      type: TriggerType.TIME,
      enabled: true,
      schedule: {
        type: TimeScheduleType.DAILY,
        hour: 9,
        minute: 0
      }
    } as TimeTrigger,
    action: {
      type: ActionType.BACKUP,
      description: '备份书签到GitHub',
      target: 'github',
      options: {
        commitMessage: '自动备份书签',
        includeMetadata: true
      }
    } as BackupAction,
    history: {
      executions: []
    }
  };
};

// 创建时间触发器工厂函数
export const createTimeTrigger = (scheduleType: TimeScheduleType): TimeTrigger => {
  const trigger: TimeTrigger = {
    type: TriggerType.TIME,
    enabled: true,
    schedule: {
      type: scheduleType
    }
  };
  
  // 根据不同的调度类型设置默认值
  switch (scheduleType) {
    case TimeScheduleType.ONCE:
      trigger.schedule.when = Date.now() + 3600000; // 默认1小时后
      break;
    case TimeScheduleType.INTERVAL:
      trigger.schedule.intervalMinutes = 1440; // 默认24小时
      break;
    case TimeScheduleType.DAILY:
      trigger.schedule.hour = 9;
      trigger.schedule.minute = 0;
      break;
    case TimeScheduleType.WEEKLY:
      trigger.schedule.dayOfWeek = 1; // 周一
      trigger.schedule.hour = 9;
      trigger.schedule.minute = 0;
      break;
    case TimeScheduleType.MONTHLY:
      trigger.schedule.dayOfMonth = 1; // 每月1日
      trigger.schedule.hour = 9;
      trigger.schedule.minute = 0;
      break;
  }
  
  return trigger;
};

// 创建事件触发器工厂函数
export const createEventTrigger = (eventType: EventType): EventTrigger => {
  return {
    type: TriggerType.EVENT,
    enabled: true,
    event: eventType
  };
};

// 创建备份操作工厂函数
export const createBackupAction = (): BackupAction => {
  return {
    type: ActionType.BACKUP,
    description: '备份书签到GitHub',
    target: 'github',
    options: {
      commitMessage: '自动备份书签',
      includeMetadata: true
    }
  };
};

// 创建整理操作工厂函数
export const createOrganizeAction = (): OrganizeAction => {
  return {
    type: ActionType.ORGANIZE,
    description: '整理书签',
    operations: [
      {
        operation: 'validate',
        filters: {
          olderThan: 30 // 默认检查30天以上的书签
        }
      }
    ]
  };
};

// 任务存储结构
export interface TaskStorage {
  tasks: { [taskId: string]: Task }; // 任务ID到任务对象的映射
  lastUpdated: number;               // 最后更新时间戳
}

// 创建默认任务存储
export const createDefaultTaskStorage = (): TaskStorage => {
  return {
    tasks: {},
    lastUpdated: Date.now()
  };
}; 