/**
 * 遗留执行恢复
 * Service Worker 中断/重启后，按执行租约状态判定遗留执行的结果
 */

import { ExecutionOutcome, TaskExecutionResult, TaskStatus } from '../types/task';
import taskService from './task-service';
import { readExecutionLease, releaseExecutionLease } from './task-executor-lease';
import { setTaskStatusPreservingDisabled } from './task-executor-result';
import { ExecutionSnapshotStore } from './task-executor-snapshot';

/**
 * 恢复遗留执行（SW 中断/重启后）
 * 按执行租约状态判定遗留执行的结果并写入执行历史：
 * - 未到期租约 → "结果不确定"：原执行可能仍有外部副作用，系统无法确认操作是否完成；
 *   未到期租约保留以继续阻止重复执行
 * - 已到期/不存在租约 → "执行中断"：原执行已失去运行所有权，已到期租约一并清理
 * - 无快照 → 无遗留执行（如超时已收尾但状态残留）：不写入历史
 * 恢复完成后清理快照（执行输入已失效）
 * 执行结果只写入执行历史：任务恢复为 ENABLED，不因中断或结果不确定标记失败；
 * 执行期间被用户禁用的任务（DISABLED）保持禁用
 * @param taskId 任务ID
 * @param snapshotStore 任务快照存储
 */
export async function recoverInterruptedExecution(
  taskId: string,
  snapshotStore: ExecutionSnapshotStore
): Promise<void> {
  const snapshot = await snapshotStore.getPending(taskId);
  if (!snapshot) {
    // 无遗留执行：说明原执行已正常收尾（快照在收尾时被清理），仅存在 RUNNING 状态残留。
    // 读取执行租约：若存在且已到期，原执行已失去运行所有权，清理该租约；
    // 未到期或不存在则不管（未到期保留以阻止并发，与 UNCERTAIN 分支一致）
    const lease = await readExecutionLease(taskId);
    if (lease && lease.expiresAt <= Date.now()) {
      await releaseExecutionLease(taskId, lease.executionId);
    }
    await setTaskStatusPreservingDisabled(taskId, TaskStatus.ENABLED);
    return;
  }

  const lease = await readExecutionLease(taskId);
  const leaseActive = !!lease && lease.expiresAt > Date.now();

  if (leaseActive) {
    // 租约未到期：原执行可能仍在进行或刚被中断，存在外部副作用，结果不确定
    const executionResult: TaskExecutionResult = {
      success: false,
      outcome: ExecutionOutcome.UNCERTAIN,
      timestamp: Date.now(),
      source: snapshot.source,
      error: '任务执行结果不确定（扩展后台重启，无法确认操作是否完成）',
      details: '系统无法确认任务操作是否完成，已恢复为"结果不确定"；该结果不会自动重试',
    };
    console.warn(`任务 ${taskId} 存在未到期执行租约，恢复为结果不确定...`);
    await taskService.updateTaskExecutionHistory(taskId, executionResult);
    // 结果不确定不等于失败：任务恢复为 ENABLED（可再次执行）；
    // 未到期租约保留，在到期前继续阻止同一任务被重复执行
    await setTaskStatusPreservingDisabled(taskId, TaskStatus.ENABLED);
  } else {
    // 租约已到期或不存在：原执行已失去运行所有权，执行中断
    const executionResult: TaskExecutionResult = {
      success: false,
      outcome: ExecutionOutcome.INTERRUPTED,
      timestamp: Date.now(),
      source: snapshot.source,
      error: '任务执行中断（扩展后台终止）',
      details: '任务执行因扩展后台终止而停止，无法继续原执行尝试；执行中断不会自动续跑',
    };
    console.warn(`任务 ${taskId} 执行租约已到期，恢复为执行中断...`);
    await taskService.updateTaskExecutionHistory(taskId, executionResult);
    // 执行中断只记录结果，不改变启用状态：任务恢复为 ENABLED，
    // 用户显式禁用则保持 DISABLED
    await setTaskStatusPreservingDisabled(taskId, TaskStatus.ENABLED);
    // 原执行已失去运行所有权，清理已到期租约
    if (lease) {
      await releaseExecutionLease(taskId, lease.executionId);
    }
  }

  // 遗留执行已判定终结，执行输入失效，清理快照
  await snapshotStore.delete(taskId);
}
