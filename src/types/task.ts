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
  EVENT = 'event'      // 基于事件的触发器
}

// 基础触发器接口
export interface BaseTrigger {
  type: TriggerType;   // 触发器类型
  enabled: boolean;    // 触发器是否启用
}

// 事件类型枚举
export enum EventType {
  BROWSER_STARTUP = 'browser_startup',  // 浏览器启动
  BOOKMARK_CREATED = 'bookmark_created', // 书签创建
  BOOKMARK_REMOVED = 'bookmark_removed', // 书签删除
  BOOKMARK_CHANGED = 'bookmark_changed', // 书签修改
  BOOKMARK_MOVED = 'bookmark_moved',     // 书签移动
  EXTENSION_CLICKED = 'extension_clicked' // 扩展图标点击 - 已废弃，由于manifest.json中配置了default_popup，此事件永远不会触发
}

// 事件触发器接口
export interface EventTrigger extends BaseTrigger {
  type: TriggerType.EVENT;
  event: EventType;             // 事件类型
  conditions?: {                // 可选的条件过滤
    url?: string;               // URL匹配模式
    title?: string;             // 标题匹配
    parentFolder?: string;      // 父文件夹ID (适用于书签事件)
    [key: string]: any;         // 其他条件过滤键值对
  };
  lastTriggered?: number;       // 上次触发时间戳
}

// 触发器联合类型
export type Trigger = EventTrigger;

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
  operation: 'backup' | 'restore';  // 备份操作类型（上传/恢复）
  target: 'github';          // 备份目标（目前仅支持GitHub）
  options: {
    commitMessage?: string;  // 提交消息
    includeMetadata?: boolean; // 是否包含元数据
    backupFilePath?: string;  // 用于恢复操作时指定备份文件路径
  };
}

// 书签整理操作接口
export interface OrganizeAction extends BaseAction {
  type: ActionType.ORGANIZE;
  operations: Array<{
    operation: 'move' | 'delete' | 'rename' | 'validate' | 'tag'; // 整理操作类型
    filters?: {              // 筛选条件
      pattern?: string;      // URL或标题匹配模式
      folder?: string;       // 指定文件夹ID
      olderThan?: number;    // 早于指定天数
      newerThan?: number;    // 晚于指定天数
    };
    target?: string;         // 目标文件夹ID（用于移动操作）
    newName?: string;        // 新名称（用于重命名或标签操作）
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
    status: TaskStatus.ENABLED,
    createdAt: now,
    updatedAt: now,
    trigger: createEventTrigger(EventType.BROWSER_STARTUP),
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

// 创建事件触发器工厂函数
export const createEventTrigger = (eventType: EventType, conditions?: Record<string, any>): EventTrigger => {
  return {
    type: TriggerType.EVENT,
    enabled: true,
    event: eventType,
    conditions
  };
};

// 创建备份操作工厂函数
export const createBackupAction = (operation: 'backup' | 'restore' = 'backup'): BackupAction => {
  return {
    type: ActionType.BACKUP,
    operation,
    description: operation === 'backup' ? '备份书签到GitHub' : '从GitHub恢复书签',
    target: 'github',
    options: {
      commitMessage: operation === 'backup' ? '自动备份书签' : '',
      includeMetadata: true,
      backupFilePath: operation === 'restore' ? '' : undefined
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
        operation: 'move',  // 更改为UI中常用的操作类型
        filters: {
          pattern: ''  // 默认使用空匹配模式
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