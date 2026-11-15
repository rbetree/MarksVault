/**
 * 任务执行结果处理
 * 负责失败收尾、重试判定与任务状态恢复
 */

import { ExecutionOutcome, TaskExecutionResult, TaskStatus } from '../types/task';
import taskService from './task-service';
import { isRetryableGitHubError } from './github-service';
import { ExecutionTimeoutError } from './task-executor-types';

/**
 * 按当前状态恢复执行期状态（恢复与收尾专用）
 * 启用状态是稳定配置，执行结果不覆盖：当前状态为 DISABLED（用户主动禁用）时
 * 保持禁用，仅由调用方负责写入执行历史；其他情况恢复为预期状态（通常为 ENABLED），
 * 避免执行收尾静默改变用户的启用/禁用意图
 * @param taskId 任务ID
 * @param status 预期状态（仅当前状态非 DISABLED 时生效）
 */
export async function setTaskStatusPreservingDisabled(taskId: string, status: TaskStatus): Promise<void> {
  try {
    const taskResult = await taskService.getTaskById(taskId);
    if (!taskResult.success) {
      console.error(`任务 ${taskId} 更新状态失败: 无法读取任务当前状态`);
      return;
    }
    const currentStatus = (taskResult.data as { status: TaskStatus }).status;
    if (currentStatus === TaskStatus.DISABLED) {
      console.warn(`任务 ${taskId} 已被用户禁用，保持 DISABLED，不覆盖为 ${status}`);
      return;
    }
    if (currentStatus === status) {
      return;
    }
    await taskService.setTaskStatus(taskId, status);
  } catch (error) {
    console.error(`任务 ${taskId} 更新状态为 ${status} 失败:`, error);
  }
}

/**
 * 失败结果收尾（结果路径与异常路径共用）
 * 执行结果只记录到执行历史；启用状态是稳定配置，不因失败、中断或
 * 结果不确定而改变。执行期间的 RUNNING 在收尾时恢复为 ENABLED，
 * 用户显式禁用的 DISABLED 保持不变。
 * @param executionResult 失败的执行结果
 * @param taskId 任务ID
 * @param executionStartTime 本次执行尝试的开始时间
 * @returns 执行结果
 */
export async function finalizeFailureResult(
  executionResult: TaskExecutionResult,
  taskId: string,
  executionStartTime: Date
): Promise<TaskExecutionResult> {
  console.log(`更新任务 ${taskId} 执行历史(失败)...`);
  const historyResult = await taskService.updateTaskExecutionHistory(taskId, executionResult);
  if (!historyResult.success) {
    console.error(`任务 ${taskId} 更新执行历史(失败)失败:`, historyResult.error);
  }

  // 执行结果不改变启用状态：仅把执行期 RUNNING 恢复为 ENABLED，
  // 用户执行期间禁用的任务保持 DISABLED
  await setTaskStatusPreservingDisabled(taskId, TaskStatus.ENABLED);

  if (executionResult.outcome === ExecutionOutcome.UNCERTAIN) {
    console.warn(`任务 ${taskId} 执行结果不确定，结果已写入执行历史，启用状态保持不变`);
  } else {
    console.warn(`任务 ${taskId} 执行失败，结果已写入执行历史，启用状态保持不变`);
  }

  const executionEndTime = new Date();
  const executionTimeMessage = `开始: ${executionStartTime.toLocaleString()}, 结束: ${executionEndTime.toLocaleString()}, 耗时: ${Math.round((executionEndTime.getTime() - executionStartTime.getTime()) / 1000)}秒`;
  console.error(`任务 ${taskId} 执行失败: ${executionResult.error}, ${executionTimeMessage}`);
  return executionResult;
}

/**
 * 判断执行结果是否应进入重试
 * 重试判定仅依据结构化信息，不匹配错误消息字符串：
 * - 未达到重试上限（retryCount < maxRetries）
 * - 执行失败（success=false）
 * - 结果不确定（UNCERTAIN：系统无法确认任务操作是否完成）不得自动重试
 * - 结果携带可重试性标记（retryable=true：网络、限流等临时性失败）
 * @param result 执行结果
 * @param retryCount 当前重试次数
 * @param maxRetries 最大重试次数
 * @returns 是否进入重试
 */
export function shouldRetryExecution(
  result: TaskExecutionResult,
  retryCount: number,
  maxRetries: number
): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }
  if (result.success) {
    return false;
  }
  // 结果不确定：不得自动重试
  if (result.outcome === ExecutionOutcome.UNCERTAIN) {
    return false;
  }
  // 结构化可重试性标记：仅临时性失败可重试
  return result.retryable === true;
}

/**
 * 结构化判定错误是否可重试（不匹配错误消息字符串）
 * - RetryableError：明确标记为临时性失败（网络、限流、服务端错误）→ 可重试
 * - GitHubApiError：按状态码判定（429 限流、5xx 服务端错误）→ 可重试；
 *   其余状态码（如 401 凭据错误）→ 不可重试
 * - ExecutionTimeoutError：超时属于"结果不确定"，由超时分支拦截处理，永不进入重试
 * - 其余错误默认不可重试（凭据缺失、配置错误、未启用等）
 * @param error 错误对象
 * @returns 是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ExecutionTimeoutError) {
    return false;
  }
  return isRetryableGitHubError(error);
}
