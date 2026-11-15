/**
 * 任务动作执行的超时控制
 */

import { ActionType, Task, TaskExecutionResult } from '../types/task';
import {
  ACTION_TIMEOUTS,
  ActionTimeoutKey,
  ExecutionTimeoutError,
  TaskExecutionConfig,
} from './task-executor-types';

/**
 * 按任务动作解析单次执行超时
 * 动作未匹配到具体类型时回退到配置中的默认超时，显式动作级覆盖优先于集中定义
 * @param task 任务对象
 * @param config 执行配置
 * @returns 单次动作执行超时（毫秒）
 */
export function resolveActionTimeout(task: Task, config: TaskExecutionConfig): number {
  const action = task.action;
  let timeoutKey: ActionTimeoutKey | undefined;

  switch (action.type) {
    case ActionType.BACKUP:
      timeoutKey = action.operation === 'restore' ? 'restore' : 'backup';
      break;
    case ActionType.PUSH:
      timeoutKey = 'push';
      break;
    case ActionType.SELECTIVE_PUSH:
      timeoutKey = 'selectivePush';
      break;
    case ActionType.ORGANIZE:
      timeoutKey = Array.isArray(action.operations)
        && action.operations.some(operation => operation.operation === 'validate')
        ? 'organizeValidate'
        : 'organize';
      break;
  }

  if (!timeoutKey) {
    return config.timeout;
  }

  return config.actionTimeouts?.[timeoutKey] ?? ACTION_TIMEOUTS[timeoutKey];
}

/**
 * 在超时限制内等待动作执行结果
 * 超时后底层操作可能仍在运行，抛出 ExecutionTimeoutError 交由调用方按"结果不确定"收尾；
 * 定时器无论结果如何都会被清理，避免后台悬挂
 * @param startOperation 动作执行入口，超时定时器创建后调用
 * @param timeoutMs 超时时间（毫秒）
 * @returns 动作执行结果
 */
export async function runWithTimeout(
  startOperation: () => Promise<TaskExecutionResult>,
  timeoutMs: number
): Promise<TaskExecutionResult> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<TaskExecutionResult>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ExecutionTimeoutError(`任务执行超时(${timeoutMs / 1000}秒)`));
    }, timeoutMs);
  });

  try {
    // 在 try 内启动：startOperation 同步抛错时同样清理定时器，避免产生
    // 未处理的超时 rejection
    const operationPromise = startOperation();
    return await Promise.race([operationPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
}
