/**
 * 任务执行状态清理
 * 任务删除后清理该任务的执行快照、执行租约与书签写入租约；
 * Service Worker 启动时兜底清理已删除任务遗留的执行状态
 */

import { browser } from 'wxt/browser';
import { TaskSnapshot } from '../types/task';
import storageService from '../utils/storage-service';
import {
  BookmarkWriteLease,
  BOOKMARK_WRITE_LEASE_KEY,
  EXECUTION_LEASE_KEY_PREFIX,
  EXECUTION_SNAPSHOTS_KEY,
} from './task-executor-types';

function getExecutionLeaseKey(taskId: string): string {
  return `${EXECUTION_LEASE_KEY_PREFIX}${taskId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLeaseActive(lease: unknown, now: number): boolean {
  return isRecord(lease)
    && typeof lease['expiresAt'] === 'number'
    && lease['expiresAt'] > now;
}

/**
 * 读取全部执行快照
 * @returns 快照映射；读取失败返回 null（调用方不得用空对象覆盖存储）
 */
async function readSnapshots(): Promise<Record<string, TaskSnapshot> | null> {
  const result = await storageService.getStorageData(EXECUTION_SNAPSHOTS_KEY);
  if (!result.success) {
    return null;
  }
  if (!isRecord(result.data)) {
    return {};
  }
  return { ...(result.data as Record<string, TaskSnapshot>) };
}

/**
 * 删除指定任务的执行快照
 * @param taskIds 需要删除快照的任务ID集合
 */
async function removeSnapshotEntries(taskIds: ReadonlySet<string>): Promise<void> {
  if (taskIds.size === 0) {
    return;
  }

  const snapshots = await readSnapshots();
  if (!snapshots) {
    // 读取失败时保留原快照，避免用不完整数据覆盖其他任务的状态
    return;
  }

  let changed = false;
  for (const taskId of taskIds) {
    if (taskId in snapshots) {
      delete snapshots[taskId];
      changed = true;
    }
  }

  if (changed) {
    await storageService.setStorageData(EXECUTION_SNAPSHOTS_KEY, snapshots);
  }
}

/**
 * 清理单个任务的执行状态
 * 任务删除后调用：删除执行快照、该任务的执行租约，
 * 以及仍由该任务持有的书签写入租约
 * @param taskId 已删除的任务ID
 */
export async function clearTaskExecutionState(taskId: string): Promise<void> {
  try {
    const keysToRemove = [getExecutionLeaseKey(taskId)];

    const writeLeaseResult = await storageService.getStorageData(BOOKMARK_WRITE_LEASE_KEY);
    if (writeLeaseResult.success) {
      const writeLease = writeLeaseResult.data as BookmarkWriteLease | null;
      if (writeLease?.taskId === taskId) {
        keysToRemove.push(BOOKMARK_WRITE_LEASE_KEY);
      }
    }

    await removeSnapshotEntries(new Set([taskId]));
    await browser.storage.local.remove(keysToRemove);
  } catch (error) {
    // 清理失败不影响任务删除结果；残留状态由下次启动的孤儿清理兜底
    console.error(`清理任务 ${taskId} 执行状态失败:`, error);
  }
}

/**
 * 清理已删除任务的遗留执行状态
 * 只清理确定已失去所有权的状态：任务不存在，且执行租约已到期或不存在；
 * 未到期租约可能仍被运行中的执行持有，保留到自然到期
 * @param existingTaskIds 当前存在的任务ID集合
 */
export async function cleanupOrphanedExecutionState(
  existingTaskIds: ReadonlySet<string>
): Promise<void> {
  try {
    const allData = await browser.storage.local.get(null) as Record<string, unknown>;
    const now = Date.now();
    const leaseKeysToRemove: string[] = [];
    const orphanTaskIds = new Set<string>();

    for (const [key, value] of Object.entries(allData)) {
      if (!key.startsWith(EXECUTION_LEASE_KEY_PREFIX)) {
        continue;
      }
      const taskId = key.slice(EXECUTION_LEASE_KEY_PREFIX.length);
      if (!taskId || existingTaskIds.has(taskId)) {
        continue;
      }
      if (isLeaseActive(value, now)) {
        continue;
      }
      orphanTaskIds.add(taskId);
      leaseKeysToRemove.push(key);
    }

    const snapshotsRaw = allData[EXECUTION_SNAPSHOTS_KEY];
    if (isRecord(snapshotsRaw)) {
      for (const taskId of Object.keys(snapshotsRaw)) {
        if (existingTaskIds.has(taskId)) {
          continue;
        }
        const lease = allData[getExecutionLeaseKey(taskId)];
        if (!isLeaseActive(lease, now)) {
          orphanTaskIds.add(taskId);
        }
      }
    }

    await removeSnapshotEntries(orphanTaskIds);
    if (leaseKeysToRemove.length > 0) {
      await browser.storage.local.remove(leaseKeysToRemove);
    }

    const writeLease = allData[BOOKMARK_WRITE_LEASE_KEY];
    if (isRecord(writeLease) && typeof writeLease['taskId'] === 'string') {
      const lease = writeLease as unknown as BookmarkWriteLease;
      if (!existingTaskIds.has(lease.taskId) && !isLeaseActive(lease, now)) {
        await browser.storage.local.remove(BOOKMARK_WRITE_LEASE_KEY);
      }
    }
  } catch (error) {
    console.error('清理孤儿任务执行状态失败:', error);
  }
}
