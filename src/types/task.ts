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
  EVENT = 'event',     // 基于事件的触发器
  MANUAL = 'manual'    // 手动触发
}

// 基础触发器接口
export interface BaseTrigger {
  type: TriggerType;   // 触发器类型
  enabled: boolean;    // 触发器是否启用
}

// 事件类型枚举
export enum EventType {
  BROWSER_STARTUP = 'browser_startup',  // 浏览器启动
  BOOKMARK_CHANGED = 'bookmark_changed', // 书签变更（包括创建、删除、修改、移动）
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

/**
 * 手动触发器接口
 * 用于需要用户手动执行的任务，例如选择性推送书签
 */
export interface ManualTrigger extends BaseTrigger {
  type: TriggerType.MANUAL;
  description: string;  // 触发器描述
}

// 触发器联合类型
export type Trigger = EventTrigger | ManualTrigger;

// 任务操作类型枚举
export enum ActionType {
  BACKUP = 'backup',         // 书签备份
  ORGANIZE = 'organize',     // 书签整理
  PUSH = 'push',             // 推送书签
  SELECTIVE_PUSH = 'selective_push', // 选择性推送书签
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

// 推送书签操作接口
export interface PushAction extends BaseAction {
  type: ActionType.PUSH;
  target: 'github';          // 推送目标（目前仅支持GitHub）
  options: {
    repoName: string;        // 目标仓库名称，默认为 'menav'
    folderPath: string;      // 目标文件夹路径，默认为 'bookmarks'
    format: 'html';          // 书签格式（目前仅支持html）
    commitMessage?: string;  // 提交消息
  };
}

/**
 * 书签选择接口
 * 用于表示用户选中的书签或文件夹
 */
export interface BookmarkSelection {
  id: string;                       // 书签或文件夹的唯一ID
  title: string;                    // 书签或文件夹的标题
  type: 'bookmark' | 'folder';      // 类型：书签或文件夹
  url?: string;                     // URL（仅书签有）
  children?: BookmarkSelection[];   // 子项（仅文件夹有）
  customOrder?: number;             // 自定义排序顺序
}

/**
 * 选择性推送书签操作接口
 * 允许用户选择特定的书签或文件夹进行推送
 */
export interface SelectivePushAction extends BaseAction {
  type: ActionType.SELECTIVE_PUSH;
  target: 'github';          // 推送目标（目前仅支持GitHub）
  options: {
    repoName: string;        // 目标仓库名称
    folderPath: string;      // 目标文件夹路径
    format: 'html';          // 书签格式（目前仅支持html）
    commitMessage?: string;  // 提交消息
    selections?: BookmarkSelection[]; // 用户选中的书签或文件夹列表（配置时为空，执行时才选择）
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

// 操作联合类型
export type Action = BackupAction | OrganizeAction | PushAction | SelectivePushAction;

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

/**
 * 创建手动触发器工厂函数
 * @param description 触发器描述，默认为'手动触发'
 * @returns 手动触发器对象
 */
export const createManualTrigger = (description: string = '手动触发'): ManualTrigger => {
  return {
    type: TriggerType.MANUAL,
    enabled: true,
    description
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

// 创建推送书签操作工厂函数
export const createPushAction = (): PushAction => {
  return {
    type: ActionType.PUSH,
    description: '推送书签到指定仓库',
    target: 'github',
    options: {
      repoName: 'menav',
      folderPath: 'bookmarks',
      format: 'html',
      commitMessage: '自动推送书签'
    }
  };
};

/**
 * 创建选择性推送操作工厂函数
 * @param selections 用户选中的书签或文件夹列表，默认为空数组
 * @param repoName 目标仓库名称，默认为'menav'
 * @param folderPath 目标文件夹路径，默认为'bookmarks'
 * @param commitMessage 提交消息，默认为'选择性推送书签'
 * @returns 选择性推送操作对象
 */
export const createSelectivePushAction = (
  repoName: string = 'menav',
  folderPath: string = 'bookmarks',
  commitMessage: string = '选择性推送书签'
): SelectivePushAction => {
  return {
    type: ActionType.SELECTIVE_PUSH,
    description: '选择性推送书签到指定仓库',
    target: 'github',
    options: {
      repoName,
      folderPath,
      format: 'html',
      commitMessage
      // selections字段在执行时才添加，配置时不需要
    }
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