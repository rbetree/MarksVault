/**
 * 任务执行租约与书签写入租约的存取
 * 租约持久化在 storage.local 中，跨 Service Worker 重启仍然有效
 */

import { browser } from 'wxt/browser';
import { ActionType, BackupAction, Task } from '../types/task';
import storageService from '../utils/storage-service';
import {
  BookmarkWriteLease,
  BOOKMARK_WRITE_LEASE_DURATION,
  BOOKMARK_WRITE_LEASE_KEY,
  ExecutionLease,
  EXECUTION_LEASE_DURATION,
  EXECUTION_LEASE_KEY_PREFIX,
} from './task-executor-types';

/**
 * 生成执行ID
 * 用于区分同一任务的不同任务执行
 */
function generateExecutionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getExecutionLeaseKey(taskId: string): string {
  return `${EXECUTION_LEASE_KEY_PREFIX}${taskId}`;
}

/**
 * 读取执行租约
 * 读取失败与无租约都返回 null，调用方无法区分二者时按失去所有权处理
 * @param taskId 任务ID
 * @returns 执行租约或 null
 */
export async function readExecutionLease(taskId: string): Promise<ExecutionLease | null> {
  const result = await storageService.getStorageData(getExecutionLeaseKey(taskId));
  if (!result.success) {
    return null;
  }
  return (result.data as ExecutionLease | null) ?? null;
}

/**
 * 检查执行租约是否可用（不存在或已到期）
 * 防重复判定以持久化执行租约为准
 * @param taskId 任务ID
 * @returns true 表示无未到期租约，可接受新的执行请求
 */
export async function isExecutionLeaseAvailable(taskId: string): Promise<boolean> {
  const result = await storageService.getStorageData(getExecutionLeaseKey(taskId));
  if (!result.success) {
    // 无法确认租约状态时拒绝执行请求（安全优先）
    return false;
  }
  const lease = result.data as ExecutionLease | null;
  if (!lease) {
    return true;
  }
  // 租约到期表示原任务执行已失去运行所有权
  return lease.expiresAt <= Date.now();
}

/**
 * 获取执行租约
 * 租约可靠保存后执行请求才被接受并形成任务执行
 * @param taskId 任务ID
 * @returns 获取结果与执行ID
 */
export async function acquireExecutionLease(taskId: string): Promise<{ success: boolean; executionId: string }> {
  const now = Date.now();
  const executionId = generateExecutionId();
  const lease: ExecutionLease = {
    taskId,
    executionId,
    acquiredAt: now,
    expiresAt: now + EXECUTION_LEASE_DURATION,
  };
  const saveResult = await storageService.setStorageData(getExecutionLeaseKey(taskId), lease);
  if (!saveResult.success) {
    return { success: false, executionId: '' };
  }
  return { success: true, executionId };
}

/**
 * 释放执行租约
 * 仅释放本执行持有的租约（校验执行ID），避免误删租约到期后新获取的租约
 * @param taskId 任务ID
 * @param executionId 本执行的执行ID
 */
export async function releaseExecutionLease(taskId: string, executionId: string): Promise<void> {
  try {
    const result = await storageService.getStorageData(getExecutionLeaseKey(taskId));
    if (!result.success) {
      return;
    }
    const lease = result.data as ExecutionLease | null;
    if (lease && lease.executionId === executionId) {
      await browser.storage.local.remove(getExecutionLeaseKey(taskId));
    }
  } catch (error) {
    // 释放失败时租约将在到期后自然失效，不会永久阻塞任务
    console.warn(`任务 ${taskId} 释放执行租约失败:`, error);
  }
}

/**
 * 执行租约续期结果
 * status 说明续期失败的具体原因，调用方据此区分"本执行失去所有权"与
 * "其他执行已合法接管"，避免误改任务状态或删除新执行的快照
 */
export type ExecutionLeaseRenewalStatus =
  | 'renewed'        // 续期成功，本执行仍持有租约
  | 'missing'        // 租约不存在
  | 'expired'        // 本执行持有的租约已到期
  | 'taken_over'     // 租约由其他执行持有（无论是否到期）
  | 'storage_error'; // 租约存储读写失败

export interface ExecutionLeaseRenewalResult {
  status: ExecutionLeaseRenewalStatus;
  // 所有结果都携带读取到的租约（若有）：续期成功为续期后的租约，
  // 失败为当前租约，供调用方确认所有权并决定是否释放
  lease: ExecutionLease | null;
}

/**
 * 续期执行租约
 * 重试属于同一任务执行的执行尝试：每次重试尝试前续期，使租约覆盖新增的尝试，
 * 避免多次重试累计耗时超过租约时长，导致合法重试被误判为租约失效。
 * 仅当租约仍由本执行持有且未到期时续期；其他情况返回具体原因
 * @param taskId 任务ID
 * @param executionId 本执行的执行ID
 * @returns 续期结果与当前租约
 */
export async function renewExecutionLease(
  taskId: string,
  executionId: string
): Promise<ExecutionLeaseRenewalResult> {
  const result = await storageService.getStorageData(getExecutionLeaseKey(taskId));
  if (!result.success) {
    return { status: 'storage_error', lease: null };
  }
  const lease = result.data as ExecutionLease | null;
  if (!lease) {
    return { status: 'missing', lease: null };
  }
  if (lease.executionId !== executionId) {
    // 租约不属于本执行：无论是否到期都按已被其他执行接管处理，
    // 原执行不得再触碰其状态与快照
    return { status: 'taken_over', lease };
  }
  if (lease.expiresAt <= Date.now()) {
    return { status: 'expired', lease };
  }

  const renewedLease: ExecutionLease = {
    ...lease,
    expiresAt: Date.now() + EXECUTION_LEASE_DURATION,
  };
  const saveResult = await storageService.setStorageData(getExecutionLeaseKey(taskId), renewedLease);
  if (!saveResult.success) {
    // 读取时已确认租约仍归本执行：携带租约供调用方释放，避免无意义地阻塞后续执行
    return { status: 'storage_error', lease };
  }
  return { status: 'renewed', lease: renewedLease };
}

/**
 * 判断任务操作是否修改书签树
 * 修改书签树的操作 = ORGANIZE 与 BACKUP/restore；
 * 只读/上传操作（BACKUP/backup、PUSH、SELECTIVE_PUSH）不修改书签树，无需获取写入租约
 * @param task 任务对象
 * @returns 是否需要获取书签写入租约
 */
export function isBookmarkWriteAction(task: Task): boolean {
  if (task.action.type === ActionType.ORGANIZE) {
    return true;
  }
  if (task.action.type === ActionType.BACKUP) {
    return (task.action as BackupAction).operation === 'restore';
  }
  return false;
}

/**
 * 检查书签写入租约是否可用（不存在或已到期）
 * @returns true 表示无未到期写入租约，可接受新的写入执行请求
 */
export async function isBookmarkWriteLeaseAvailable(): Promise<boolean> {
  const result = await storageService.getStorageData(BOOKMARK_WRITE_LEASE_KEY);
  if (!result.success) {
    // 无法确认租约状态时拒绝执行请求（安全优先）
    return false;
  }
  const lease = result.data as BookmarkWriteLease | null;
  if (!lease) {
    return true;
  }
  // 租约到期表示原任务执行已失去书签树写入权
  return lease.expiresAt <= Date.now();
}

/**
 * 获取书签写入租约
 * 租约可靠保存后本次执行才拥有书签树独占写入权；
 * 重试属于同一任务执行的执行尝试，重新获取并覆盖原租约
 * @param taskId 持有写入租约的任务ID
 * @param executionId 本次任务执行的执行ID
 * @returns 获取结果
 */
export async function acquireBookmarkWriteLease(taskId: string, executionId: string): Promise<{ success: boolean }> {
  const now = Date.now();
  const lease: BookmarkWriteLease = {
    taskId,
    executionId,
    acquiredAt: now,
    expiresAt: now + BOOKMARK_WRITE_LEASE_DURATION,
  };
  const saveResult = await storageService.setStorageData(BOOKMARK_WRITE_LEASE_KEY, lease);
  if (!saveResult.success) {
    return { success: false };
  }
  return { success: true };
}

/**
 * 释放书签写入租约
 * 仅释放本执行持有的写入租约（校验执行ID），避免误删租约到期后新获取的租约
 * @param executionId 本执行的执行ID
 */
export async function releaseBookmarkWriteLease(executionId: string): Promise<void> {
  try {
    const result = await storageService.getStorageData(BOOKMARK_WRITE_LEASE_KEY);
    if (!result.success) {
      return;
    }
    const lease = result.data as BookmarkWriteLease | null;
    if (lease && lease.executionId === executionId) {
      await browser.storage.local.remove(BOOKMARK_WRITE_LEASE_KEY);
    }
  } catch (error) {
    // 释放失败时租约将在到期后自然失效，不会永久阻塞写入任务
    console.warn('释放书签写入租约失败:', error);
  }
}
