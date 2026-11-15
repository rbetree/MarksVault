/**
 * 任务执行引擎的类型、默认配置与租约常量
 */

// 任务执行配置
export interface TaskExecutionConfig {
  maxRetries: number;         // 最大重试次数
  retryDelay: number;         // 重试延迟(毫秒)
  timeout: number;            // 默认执行超时时间(毫秒)，用于未匹配动作类型
  maxHistoryLength: number;   // 执行历史记录最大长度
  // 动作级超时覆盖：缺省时使用 ACTION_TIMEOUTS，主要供测试或特殊部署调整
  actionTimeouts?: Partial<Record<ActionTimeoutKey, number>>;
}

/**
 * 动作级执行超时（毫秒）
 * 不同动作的网络往返与书签树重建耗时差异较大，按动作类型集中定义，避免统一 60 秒截断长任务。
 * organizeValidate 指包含 URL 验证的整理任务：逐条网络探测耗时明显高于纯本地整理。
 */
export const ACTION_TIMEOUTS = {
  backup: 120000,           // 备份上传
  restore: 300000,          // 恢复下载并重建书签树
  push: 180000,             // 推送书签到 GitHub
  selectivePush: 180000,    // 选择性推送
  organize: 120000,         // 本地整理书签
  organizeValidate: 300000, // 整理并验证书签 URL
} as const;

export type ActionTimeoutKey = keyof typeof ACTION_TIMEOUTS;

// 默认配置
export const DEFAULT_CONFIG: TaskExecutionConfig = {
  maxRetries: 3,              // 默认最多重试3次
  retryDelay: 2000,           // 默认重试延迟2秒
  timeout: 60000,             // 默认超时1分钟
  maxHistoryLength: 50        // 默认保留50条执行记录
};

/**
 * 执行租约
 * 一项任务在限定时间内已有任务执行负责运行的声明，用于阻止同一任务被重复执行。
 * 租约到期表示原任务执行已失去运行所有权。
 */
export interface ExecutionLease {
  taskId: string;        // 任务ID
  executionId: string;   // 执行ID（本次任务执行的唯一标识）
  acquiredAt: number;    // 获取时间（毫秒时间戳）
  expiresAt: number;     // 到期时间（毫秒时间戳）
}

// 执行租约在 storage.local 中的存储键前缀（每个任务一个独立键，避免跨任务写入互相覆盖）
export const EXECUTION_LEASE_KEY_PREFIX = 'execution_lease:';

// 执行快照在 storage.local 中的存储键
export const EXECUTION_SNAPSHOTS_KEY = 'execution_snapshots';

// 执行租约时长：2倍执行超时（120秒），为原执行留足余量；到期后原执行失去运行所有权
export const EXECUTION_LEASE_DURATION = DEFAULT_CONFIG.timeout * 2;

/**
 * 执行超时错误
 * 用于结构化识别超时结束的执行：超时后底层操作可能仍在进行（外部副作用不确定），
 * 结果应为"结果不确定"，不得进入按错误消息匹配的重试判定
 */
export class ExecutionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionTimeoutError';
  }
}

/**
 * 书签写入租约
 * 一次任务执行在限定时间内独占修改本地书签树的声明。它允许只读或上传操作并行，
 * 但阻止多个任务同时修改书签树。租约到期表示原任务执行已失去书签树写入权。
 */
export interface BookmarkWriteLease {
  taskId: string;        // 持有写入租约的任务ID
  executionId: string;   // 持有写入租约的任务执行ID
  acquiredAt: number;    // 获取时间（毫秒时间戳）
  expiresAt: number;     // 到期时间（毫秒时间戳）
}

// 书签写入租约在 storage.local 中的存储键（全局唯一：所有写入任务共用同一互斥声明）
export const BOOKMARK_WRITE_LEASE_KEY = 'bookmark_write_lease';

// 书签写入租约时长：与执行租约一致为 2倍执行超时（120秒），为原执行留足余量；
// SW 中断时此方法不会执行释放，租约在到期后自然失效，不会永久阻塞写入任务
export const BOOKMARK_WRITE_LEASE_DURATION = DEFAULT_CONFIG.timeout * 2;
