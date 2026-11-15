/**
 * 租约跨上下文互斥
 * popup、taskconfig 与 Service Worker 各自加载独立模块实例，本地 Mutex 只能串行化
 * 同一上下文；租约的检查-获取、续期、延长与释放通过 Web Locks API 按名称跨上下文串行。
 * 环境不支持 navigator.locks 时退回按名称区分的本地 Mutex，保证 Jest 与旧环境可用。
 * 锁只覆盖短临界区，不包裹任务动作执行。
 */

import { Mutex } from './task-executor-mutex';

export const BOOKMARK_WRITE_LEASE_LOCK_NAME = 'marksvault:bookmark-write-lease';

const EXECUTION_LEASE_LOCK_PREFIX = 'marksvault:execution-lease:';

/**
 * 执行租约锁名称
 * 每个任务一把锁：不同任务的执行请求互不阻塞
 * @param taskId 任务ID
 * @returns Web Locks 锁名
 */
export function getExecutionLeaseLockName(taskId: string): string {
  return `${EXECUTION_LEASE_LOCK_PREFIX}${taskId}`;
}

interface LocalLockEntry {
  mutex: Mutex;
  pending: number;
}

const localLocks = new Map<string, LocalLockEntry>();

/**
 * 回退路径：按锁名复用本地 Mutex
 * pending 归零后删除条目，避免已删除任务的锁名长期占用内存
 */
async function withLocalLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  let entry = localLocks.get(name);
  if (!entry) {
    entry = { mutex: new Mutex(), pending: 0 };
    localLocks.set(name, entry);
  }
  entry.pending++;

  try {
    return await entry.mutex.runExclusive(fn);
  } finally {
    entry.pending--;
    if (entry.pending === 0) {
      localLocks.delete(name);
    }
  }
}

function getLockManager(): LockManager | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const locks = navigator.locks;
  return locks && typeof locks.request === 'function' ? locks : null;
}

/**
 * 在指定名称的互斥锁内执行临界区
 * @param name 锁名；同一名称的临界区跨上下文串行
 * @param fn 短临界区：租约检查、读写与释放
 * @returns fn 的执行结果
 */
export async function withLeaseLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = getLockManager();
  if (locks) {
    return locks.request(name, { mode: 'exclusive' }, () => fn()) as Promise<T>;
  }
  return withLocalLock(name, fn);
}
