/**
 * 任务执行引擎
 * 负责执行触发的任务并记录结果
 */

import {
  Task,
  TaskStatus,
  ActionType,
  TaskExecutionResult,
  TaskSnapshot,
  ExecutionSource,
  ExecutionOutcome,
} from '../types/task';
import taskService from './task-service';
import { TaskExecutionConfig, DEFAULT_CONFIG, ExecutionTimeoutError } from './task-executor-types';
import { Mutex } from './task-executor-mutex';
import { ExecutionSnapshotStore } from './task-executor-snapshot';
import {
  acquireBookmarkWriteLease as acquireBookmarkWriteLeaseInStorage,
  acquireExecutionLease as acquireExecutionLeaseInStorage,
  isBookmarkWriteAction,
  isBookmarkWriteLeaseAvailable,
  isExecutionLeaseAvailable,
  readExecutionLease,
  releaseBookmarkWriteLease,
  releaseExecutionLease,
  renewExecutionLease,
} from './task-executor-lease';
import {
  executeBackupAction as runBackupAction,
  executeOrganizeAction as runOrganizeAction,
  executePushAction as runPushAction,
  executeSelectivePush as runSelectivePush,
} from './task-executor-actions';
import {
  finalizeFailureResult,
  isRetryableError,
  setTaskStatusPreservingDisabled,
  shouldRetryExecution,
} from './task-executor-result';
import { recoverInterruptedExecution } from './task-executor-recovery';
import { runWithTimeout } from './task-executor-timeout';

export {
  EXECUTION_LEASE_KEY_PREFIX,
  ExecutionTimeoutError,
  BOOKMARK_WRITE_LEASE_KEY,
} from './task-executor-types';
export type { ExecutionLease, BookmarkWriteLease } from './task-executor-types';

/**
 * 任务执行引擎
 * 负责执行触发的任务并记录执行结果
 */
export class TaskExecutor {
  private static instance: TaskExecutor | undefined;
  private config: TaskExecutionConfig;
  private executingTasks: Set<string> = new Set(); // 记录正在执行的任务ID

  // 互斥队列：串行化租约"检查-获取"与快照读写等临界区。
  // MV3 扩展单线程，但 await 会使多个执行流程交错，必须互斥才能保证原子性
  private readonly mutex = new Mutex();
  private readonly snapshotStore = new ExecutionSnapshotStore(this.mutex);

  /**
   * 私有构造函数，防止直接实例化
   */
  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    console.log('任务执行引擎已初始化');
  }

  /**
   * 在互斥队列中串行执行临界区
   * @param fn 需要互斥执行的异步操作
   * @returns fn 的执行结果
   */
  private async withLeaseMutex<T>(fn: () => Promise<T>): Promise<T> {
    return this.mutex.runExclusive(fn);
  }

  /**
   * 获取指定任务未完成的执行快照
   * 用于 SW 中断后的可恢复判定：快照存在说明该任务有一次已开始但未正常结束的执行，
   * 其执行输入（如选中的书签）仍可从快照读取
   * @param taskId 任务ID
   * @returns 任务快照或 null（无未完成执行）
   */
  public async getPendingSnapshot(taskId: string): Promise<TaskSnapshot | null> {
    return this.snapshotStore.getPending(taskId);
  }

  /**
   * 重置单例（测试辅助）
   * 用于模拟 Service Worker 重启时重建执行引擎实例；生产代码不应调用
   */
  public static resetForTesting(): void {
    TaskExecutor.instance = undefined;
  }

  /**
   * 获取TaskExecutor实例
   * @returns TaskExecutor单例
   */
  public static getInstance(): TaskExecutor {
    if (!TaskExecutor.instance) {
      TaskExecutor.instance = new TaskExecutor();
    }
    return TaskExecutor.instance;
  }

  /**
   * 获取执行租约
   * @param taskId 任务ID
   * @returns 获取结果与执行ID
   */
  private async acquireExecutionLease(taskId: string): Promise<{ success: boolean; executionId: string }> {
    return acquireExecutionLeaseInStorage(taskId);
  }

  /**
   * 获取书签写入租约
   * @param taskId 持有写入租约的任务ID
   * @param executionId 本次任务执行的执行ID
   * @returns 获取结果
   */
  private async acquireBookmarkWriteLease(taskId: string, executionId: string): Promise<{ success: boolean }> {
    return acquireBookmarkWriteLeaseInStorage(taskId, executionId);
  }

  private async executeBackupAction(task: Task): Promise<TaskExecutionResult> {
    return runBackupAction(task);
  }

  private async executeOrganizeAction(task: Task): Promise<TaskExecutionResult> {
    return runOrganizeAction(task);
  }

  private async executePushAction(task: Task): Promise<TaskExecutionResult> {
    return runPushAction(task);
  }

  private async executeSelectivePush(task: Task): Promise<TaskExecutionResult> {
    return runSelectivePush(task);
  }

  /**
   * 更新执行配置
   * @param config 部分或完整的配置对象
   */
  public updateConfig(config: Partial<TaskExecutionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('任务执行引擎配置已更新:', this.config);
  }

  /**
   * 初始化任务执行引擎
   * 对遗留 RUNNING 任务按执行租约状态恢复，取代一律 FAILED 的恢复逻辑：
   * - 存在未到期执行租约 → 恢复为"结果不确定"（原执行可能仍有外部副作用）
   * - 执行租约已到期或不存在 → 恢复为"执行中断"（原执行已失去运行所有权）
   * - 无遗留快照 → 无未正常结束的执行，仅清理 RUNNING 状态残留
   */
  public async init(): Promise<void> {
    try {
      const runningTasksResult = await taskService.getTasksByStatus(TaskStatus.RUNNING);
      if (runningTasksResult.success && runningTasksResult.data.length > 0) {
        const runningTasks = runningTasksResult.data as Task[];
        console.log(`发现 ${runningTasks.length} 个处于RUNNING状态的任务，正在按执行租约状态恢复...`);

        for (const task of runningTasks) {
          await recoverInterruptedExecution(task.id, this.snapshotStore);
        }
      }

      console.log('任务执行引擎初始化完成');
    } catch (error) {
      console.error('任务执行引擎初始化失败:', error);
    }
  }

  /**
   * 执行任务
   * 执行开始时固化任务快照（含执行输入），执行全程使用快照，不实时读取任务定义，
   * 因此首次执行尝试不受任务编辑影响；重试期间任务被删除时会终止重试
   * @param taskId 要执行的任务ID
   * @param retryCount 当前重试次数，默认为0
   * @param source 执行来源，默认为 manual（用户明确发起）
   * @returns 执行结果
   */
  public async executeTask(
    taskId: string,
    retryCount: number = 0,
    source: ExecutionSource = 'manual'
  ): Promise<TaskExecutionResult> {
    return this.executeTaskInternal(taskId, retryCount, source);
  }

  /**
   * 使用提供的任务数据直接执行任务（不从存储重新加载）
   * 主要用于选择性推送等需要运行时数据的任务
   * 传入的任务定义（含执行输入如 selections）随任务快照持久化到 storage.local，
   * SW 中断后仍可读取；执行输入不会写回任务的持久化配置
   * @param task 完整的任务对象（包含运行时数据如 selections）
   * @param retryCount 当前重试次数，默认为0
   * @param source 执行来源，默认为 manual（用户明确发起）
   * @returns 执行结果
   */
  public async executeTaskWithData(
    task: Task,
    retryCount: number = 0,
    source: ExecutionSource = 'manual'
  ): Promise<TaskExecutionResult> {
    return this.executeTaskInternal(task.id, retryCount, source, undefined, task);
  }

  /**
   * 按任务类型执行对应动作
   * @param task 任务对象
   * @returns 执行结果
   */
  private async dispatchAction(task: Task): Promise<TaskExecutionResult> {
    switch (task.action.type) {
      case ActionType.BACKUP:
        return await this.executeBackupAction(task);
      case ActionType.ORGANIZE:
        return await this.executeOrganizeAction(task);
      case ActionType.PUSH:
        return await this.executePushAction(task);
      case ActionType.SELECTIVE_PUSH:
        return await this.executeSelectivePush(task);
      default:
        throw new Error(`不支持的任务类型: ${(task.action as any).type}`);
    }
  }

  /**
   * 执行任务（内部实现）
   * 重试属于同一任务执行的执行尝试：重试时延续执行租约（不覆盖获取新租约），
   * 每次尝试前续期以覆盖新增尝试；租约到期或已被其他执行获取时停止重试
   * @param taskId 要执行的任务ID
   * @param retryCount 当前重试次数
   * @param source 执行来源
   * @param leaseExecutionId 重试时继承的本执行执行租约ID（首次执行为空，由本方法获取）
   * @param providedTask 调用方直接提供的任务定义（含运行时数据）；缺省时从存储加载
   * @param isRetryContinuation 是否为重试链中的后续尝试（用于区分日志中的执行入口）
   * @returns 执行结果
   */
  private async executeTaskInternal(
    taskId: string,
    retryCount: number,
    source: ExecutionSource,
    leaseExecutionId?: string,
    providedTask?: Task,
    isRetryContinuation: boolean = false
  ): Promise<TaskExecutionResult> {
    // 创建初始执行结果对象
    let executionResult: TaskExecutionResult = {
      success: false,
      timestamp: Date.now(),
      details: '',
      source,
    };

    // 执行租约阶段：
    // - 首次执行请求（无继承租约）：检查可用性后获取新租约，租约可靠保存后执行请求才被接受
    // - 重试（继承租约）：每次尝试前续期；租约到期、失效或已被其他执行接管时停止重试。
    //   其他执行接管时只终止本次执行，不改写任务状态/历史，也不删除其快照
    // 检查-获取在互斥中完成：避免并发请求在"检查可用"与"获取租约"之间交错
    // 导致同一任务被重复执行
    let activeLeaseExecutionId: string;
    if (leaseExecutionId === undefined) {
      const leaseAcquired = await this.withLeaseMutex(async (): Promise<
        { success: true; executionId: string } | { success: false; error: string }
      > => {
        if (retryCount === 0) {
          // 检查任务是否已在执行中（内存快速检查）
          if (this.executingTasks.has(taskId)) {
            return { success: false, error: '任务正在执行中' };
          }
          // 存在未到期执行租约时拒绝执行请求，被拒绝的请求不产生执行历史
          if (!(await isExecutionLeaseAvailable(taskId))) {
            return { success: false, error: '任务正在执行中' };
          }
        }

        // 获取执行租约：租约可靠保存后执行请求才被接受
        const lease = await this.acquireExecutionLease(taskId);
        if (!lease.success) {
          return { success: false, error: '获取执行租约失败' };
        }
        return { success: true, executionId: lease.executionId };
      });

      // 获取失败：保持既有拒绝路径（不入历史、不改状态）
      if (!leaseAcquired.success) {
        console.warn(`任务 ${taskId} 拒绝执行请求: ${leaseAcquired.error}`);
        executionResult.error = leaseAcquired.error;
        return executionResult;
      }
      activeLeaseExecutionId = leaseAcquired.executionId;
    } else {
      // 重试前续期执行租约：每次执行尝试都会重新计算有效期，避免多次重试累计耗时
      // 超过租约时长导致合法重试被误判为租约失效。
      // 检查-续期在互斥中完成：避免与并发执行请求的"检查-获取"交错
      const renewal = await this.withLeaseMutex(() => renewExecutionLease(taskId, leaseExecutionId));

      if (renewal.status === 'taken_over') {
        // 其他执行已合法接管：本次执行不得再改写任务状态/历史，
        // 也不得删除快照（快照可能已由新执行重新写入）
        console.warn(`任务 ${taskId} 执行租约已被其他执行接管，停止重试...`);
        executionResult.success = false;
        executionResult.outcome = ExecutionOutcome.FAILURE;
        executionResult.error = '执行租约已被其他执行接管，停止重试';
        executionResult.details = '原执行已失去运行所有权，新的执行已接管该任务，本次执行不再重试';
        executionResult.source = source;
        return executionResult;
      }

      if (renewal.status === 'storage_error' && !renewal.lease) {
        // 存储读取失败，无法确认租约归属：不触碰任务状态/历史/快照，
        // 避免干扰可能已合法接管的新执行；释放仅在本执行仍持有租约时生效
        console.warn(`任务 ${taskId} 续期失败且无法确认租约归属，停止重试...`);
        executionResult.success = false;
        executionResult.outcome = ExecutionOutcome.FAILURE;
        executionResult.error = '无法确认执行租约归属，停止重试';
        executionResult.details = '租约存储读取失败，无法确认本执行是否仍持有运行所有权，停止重试';
        executionResult.source = source;
        await releaseExecutionLease(taskId, leaseExecutionId);
        return executionResult;
      }

      if (renewal.status !== 'renewed') {
        // 清理前二次校验租约：续期失败到清理之间可能有新的执行合法接管，
        // 此时跳过状态覆盖、历史写入与快照删除，避免干扰新执行
        const currentLease = await readExecutionLease(taskId);
        if (
          currentLease
          && currentLease.executionId !== leaseExecutionId
          && currentLease.expiresAt > Date.now()
        ) {
          console.warn(`任务 ${taskId} 清理前发现其他执行已接管，跳过清理...`);
          executionResult.success = false;
          executionResult.outcome = ExecutionOutcome.FAILURE;
          executionResult.error = '执行租约已被其他执行接管，停止重试';
          executionResult.details = '清理前发现其他执行已持有未到期租约，本次执行不修改任务状态与快照';
          executionResult.source = source;
          return executionResult;
        }

        // 租约过期、不存在或续期存储失败（已确认租约归属）：本执行已无法安全继续
        console.warn(`任务 ${taskId} 执行租约已失效，停止重试...`);
        executionResult.success = false;
        executionResult.outcome = ExecutionOutcome.FAILURE;
        executionResult.error = '执行租约已失效，停止重试';
        executionResult.details = '执行租约已到期或失效，原执行已失去运行所有权，停止重试';
        executionResult.source = source;
        await taskService.updateTaskExecutionHistory(taskId, executionResult);
        // 保留用户的禁用意图：执行期间被禁用的任务不因收尾改回 FAILED
        await setTaskStatusPreservingDisabled(taskId, TaskStatus.FAILED);
        // 重试链在此终止，外层 finally 因 retrying 跳过快照删除，必须在此清理，
        // 避免本次执行输入残留在 storage.local
        await this.snapshotStore.delete(taskId);
        // 释放仍归本执行的租约（续期存储失败时租约可能仍有效），
        // 避免重试终止后无意义地阻塞后续执行
        await releaseExecutionLease(taskId, leaseExecutionId);
        return executionResult;
      }

      // 任务存在性检查：重试仍沿用首次固化的任务定义，这里只确认任务未被删除，
      // 不用存储中的配置覆盖快照。读取失败时重读一次，区分瞬时故障；
      // 仍失败时无法可靠区分“已删除”与“读取异常”，保守保留快照与租约交给恢复逻辑
      let taskResult = await taskService.getTaskById(taskId);
      if (!taskResult.success) {
        taskResult = await taskService.getTaskById(taskId);
      }
      if (!taskResult.success) {
        console.warn(`任务 ${taskId} 不存在或无法读取，停止重试...`);
        executionResult.success = false;
        executionResult.outcome = ExecutionOutcome.FAILURE;
        executionResult.error = '任务不存在或无法读取，停止重试';
        executionResult.details = '任务在执行期间被删除或无法读取，本次执行终止且不修改任务状态';
        executionResult.source = source;
        return executionResult;
      }

      activeLeaseExecutionId = leaseExecutionId;
    }

    // 将任务添加到执行中集合
    this.executingTasks.add(taskId);

    const executionStartTime = new Date();
    // 带数据执行与从存储加载执行的日志保持区分，便于排查执行输入来源；
    // 重试链沿用首次固化的任务定义，不属于调用方带数据执行入口
    const executionLabel = providedTask && !isRetryContinuation ? '开始执行任务(带数据):' : '开始执行任务:';
    console.log(`[${executionStartTime.toLocaleString()}] ${executionLabel} ${taskId}${retryCount > 0 ? ` (重试 ${retryCount}/${this.config.maxRetries})` : ''}`);

    // 是否发生执行超时：超时后底层操作可能仍在运行，finally 中保留租约直至自然到期
    let timeoutOccurred = false;

    // 是否持有书签写入租约（finally 中按持有状态释放，避免误删其他任务新获取的租约）
    let writeLeaseHeld = false;

    // 是否进入重试：重试延续执行租约（不重新获取），本层 finally 须跳过执行租约释放，
    // 由重试链最内层在执行收尾时释放，避免 finally 在本层返回值求值后立即释放租约
    let retrying = false;

    // 首次固化的任务定义（含执行输入）：异常路径重试时透传，避免从存储重新加载
    // 丢失本次执行输入；理论上任务加载前不会进入重试，未赋值时回退原有加载行为
    let taskForRetry: Task | undefined;

    try {
      // 获取任务详情：直接提供的任务定义优先，否则从存储加载
      let task: Task;
      if (providedTask) {
        task = providedTask;
      } else {
        const taskResult = await taskService.getTaskById(taskId);

        // 如果找不到任务，返回失败
        if (!taskResult.success) {
          executionResult.error = `获取任务失败: ${taskResult.error}`;
          executionResult.timestamp = Date.now();
          return executionResult;
        }

        task = taskResult.data as Task;
      }
      taskForRetry = task;

      // 书签写入租约：修改书签树的任务（整理、恢复）在每次执行尝试开始时检查并获取，
      // 阻止多个任务同时修改书签树；只读/上传类任务不获取写入租约，可与写入任务并行。
      // 获取顺序：先执行租约（任务执行所有权），后写入租约（书签树独占权）；
      // 被写入租约阻止时拒绝执行请求（不产生执行历史），并立即释放刚获取的执行租约，避免残留
      // 检查-获取在互斥中完成：避免并发写入请求在"检查可用"与"获取租约"之间交错导致双重获取
      if (isBookmarkWriteAction(task)) {
        const writeLeaseResult = await this.withLeaseMutex(async () => {
          if (!(await isBookmarkWriteLeaseAvailable())) {
            return { success: false, denied: true };
          }
          const acquired = await this.acquireBookmarkWriteLease(taskId, activeLeaseExecutionId);
          return { success: acquired.success, denied: false };
        });

        if (!writeLeaseResult.success) {
          // 事件触发跳过本次执行请求；手动触发返回失败并带清晰提示
          const error = writeLeaseResult.denied
            ? (source === 'event'
              ? '另一个任务正在修改书签树，本次执行被跳过'
              : '另一个任务正在修改书签树，请稍后重试')
            : '获取书签写入租约失败';
          console.warn(`任务 ${taskId} 获取书签写入租约失败，拒绝执行请求...`);
          executionResult.error = error;
          // 立即释放刚获取的执行租约，避免残留
          await releaseExecutionLease(taskId, activeLeaseExecutionId);
          // 重试层被拒时任务之前已被置 RUNNING，必须恢复 ENABLED 否则永久卡死；
          // 执行期间被用户禁用的任务保持 DISABLED，不覆盖用户的禁用意图
          if (retryCount > 0) {
            await setTaskStatusPreservingDisabled(taskId, TaskStatus.ENABLED);
          }
          return executionResult;
        }
        writeLeaseHeld = true;
      }

      // 固化任务快照：执行开始时的任务定义（含执行输入），执行全程使用快照，
      // 任务后续被编辑或删除不会影响本次执行
      await this.snapshotStore.save({
        taskId,
        task,
        source,
        createdAt: Date.now(),
      });

      // 任务执行前更新任务状态为RUNNING；执行期间被用户禁用的任务保持 DISABLED，
      // 重试属于同一任务执行，禁用意图只约束后续执行请求
      await setTaskStatusPreservingDisabled(taskId, TaskStatus.RUNNING);

      // 开始计时
      const startTime = Date.now();

      // 设置初始执行结果
      executionResult = {
        success: false,
        timestamp: startTime,
        details: '',
        source,
      };

      // 超时与动作执行竞争：哪个先完成就用哪个结果
      executionResult = await runWithTimeout(
        () => this.dispatchAction(task),
        this.config.timeout
      );

      // 添加执行持续时间
      executionResult.duration = Date.now() - startTime;

      // 记录执行来源（动作执行器返回的结果不包含来源，此处统一补充）
      executionResult.source = source;

      // 结果类型：未显式声明时按 success 推断（兼容动作执行器返回的旧格式结果）
      executionResult.outcome ??= executionResult.success ? ExecutionOutcome.SUCCESS : ExecutionOutcome.FAILURE;

      // 执行成功：更新任务执行历史记录并返回；
      // 执行失败（含可重试的临时性失败）统一走重试判定与失败收尾
      if (executionResult.success) {
        console.log(`更新任务 ${taskId} 执行历史记录...`);
        // 历史+状态为同一次写入：写入失败时任务可能残留 RUNNING，
        // 单独兜底恢复 ENABLED（读取当前状态，DISABLED 保持禁用意图）
        const historyResult = await taskService.updateTaskExecutionHistory(taskId, executionResult);
        if (!historyResult.success) {
          console.error(`任务 ${taskId} 更新执行历史失败:`, historyResult.error);
          await setTaskStatusPreservingDisabled(taskId, TaskStatus.ENABLED);
        }

        const executionEndTime = new Date();
        const executionTimeMessage = `开始: ${executionStartTime.toLocaleString()}, 结束: ${executionEndTime.toLocaleString()}, 耗时: ${Math.round((executionEndTime.getTime() - executionStartTime.getTime()) / 1000)}秒`;
        console.log(`任务 ${taskId} 执行完成, 结果: 成功, ${executionTimeMessage}`);
        return executionResult;
      }

      // 失败结果：补充失败详情（异常路径在 catch 中补充），
      // 结果不确定（UNCERTAIN）保持执行器提供的语义，不在此覆盖
      if (executionResult.outcome !== ExecutionOutcome.UNCERTAIN) {
        executionResult.details = executionResult.details || `执行失败${retryCount > 0 ? `，已重试 ${retryCount} 次` : ''}`;
      }

      // 统一重试判定与失败收尾（结果路径）
      if (shouldRetryExecution(executionResult, retryCount, this.config.maxRetries)) {
        retrying = true;
        return this.retryTask(taskId, retryCount, source, activeLeaseExecutionId, taskForRetry);
      }
      return finalizeFailureResult(executionResult, taskId, executionStartTime);
    } catch (error) {
      // 超时结束的执行：底层操作可能仍在进行（外部副作用不确定），
      // 本次执行结果应为"结果不确定"：不进入重试、不把任务标记为 FAILED，
      // 保持 RUNNING 由租约驱动的恢复逻辑处理
      if (error instanceof ExecutionTimeoutError) {
        // 标记超时：finally 中保留租约直至自然到期，阻止底层仍在运行的操作被并发重入
        timeoutOccurred = true;
        const errorMessage = error.message;
        const startTime = executionResult.timestamp || Date.now();
        executionResult.success = false;
        executionResult.outcome = ExecutionOutcome.UNCERTAIN;
        executionResult.error = errorMessage;
        executionResult.details = `执行超时，结果不确定${retryCount > 0 ? `，已重试 ${retryCount} 次` : ''}`;
        executionResult.duration = Date.now() - startTime;
        executionResult.source = source;
        console.warn(`任务 ${taskId} 执行超时，结果不确定（底层操作可能仍在进行）`);

        // 更新任务历史记录
        await taskService.updateTaskExecutionHistory(taskId, executionResult);
        return executionResult;
      }

      // 处理错误：构造结构化失败结果。
      // 可重试性依据错误类型与状态码判定（isRetryableError），不匹配错误消息字符串
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`任务 ${taskId} 执行出错:`, errorMessage);

      // 确保startTime变量存在（在try块中可能未定义）
      const startTime = executionResult.timestamp || Date.now();
      executionResult.success = false;
      executionResult.outcome = ExecutionOutcome.FAILURE;
      executionResult.error = errorMessage;
      executionResult.details = `执行失败${retryCount > 0 ? `，已重试 ${retryCount} 次` : ''}`;
      executionResult.duration = Date.now() - startTime;
      executionResult.source = source;
      // 结构化可重试性标记：仅临时性失败（网络、限流、服务端错误等）可重试
      executionResult.retryable = isRetryableError(error);

      // 失败收尾与重试判定（异常路径）
      if (shouldRetryExecution(executionResult, retryCount, this.config.maxRetries)) {
        retrying = true;
        return this.retryTask(taskId, retryCount, source, activeLeaseExecutionId, taskForRetry);
      }
      return finalizeFailureResult(executionResult, taskId, executionStartTime);
    } finally {
      if (timeoutOccurred) {
        // 底层操作可能仍在运行：保留执行租约与写入租约直至自然到期（120s），
        // 阻止并发重入/双写；快照照常清理（执行输入失效）
        this.executingTasks.delete(taskId);
        await this.snapshotStore.delete(taskId);
        console.warn(`[TaskExecutor] 执行超时（任务 ${taskId}），保留执行租约与书签写入租约直至到期`);
      } else {
        // 重试时本层不负责移除执行标记：由重试链最内层移除；
        // 若重试期间其他执行已合法接管，避免误删其内存执行标记
        if (!retrying) {
          this.executingTasks.delete(taskId);
        }

        // 清理任务快照：执行正常结束时执行输入失效；
        // retrying 时跳过：快照由重试层重新固化、最内层 finally 删除；
        // 若此处因 SW 中断未执行，快照保留在 storage 中供恢复判定
        if (!retrying) {
          await this.snapshotStore.delete(taskId);
        }

        // 释放书签写入租约：与获取顺序相反，先释放写入租约，再释放执行租约。
        // 写入租约由重试层重新检查并获取（重试属于同一任务执行的执行尝试），本层总是释放
        if (writeLeaseHeld) {
          await releaseBookmarkWriteLease(activeLeaseExecutionId);
        }

        // 释放执行租约：执行结束后租约被释放，后续执行请求可通过。
        // 重试时跳过：重试延续执行租约（不重新获取），由重试链最内层收尾时释放，
        // 避免本层 finally 在返回值求值后立即释放租约导致重试层无租约可用
        if (!retrying) {
          await releaseExecutionLease(taskId, activeLeaseExecutionId);
        }
      }
      console.log(`任务 ${taskId} 已从执行队列移除`);
    }
  }

  /**
   * 发起重试（重试路径）
   * 重试属于同一任务执行的执行尝试：等待重试延迟后递归执行；
   * 递归层入口续期执行租约并检查任务是否仍存在：租约被其他执行接管时静默终止，
   * 任务被删除时清理快照与租约后终止
   * @param taskId 任务ID
   * @param retryCount 当前重试次数
   * @param source 执行来源
   * @param leaseExecutionId 本执行的执行租约ID（重试时延续）
   * @param task 首次固化（含执行输入）的任务定义：重试链始终使用该定义，
   *             重试窗口内编辑任务或执行输入未写回配置都不影响本次执行；
   *             未赋值时回退为从存储加载
   * @returns 执行结果
   */
  private async retryTask(
    taskId: string,
    retryCount: number,
    source: ExecutionSource,
    leaseExecutionId: string,
    task: Task | undefined
  ): Promise<TaskExecutionResult> {
    console.log(`将在 ${this.config.retryDelay / 1000} 秒后重试任务 ${taskId}`);

    // 从执行中任务集合中移除（重试层执行时重新加入）
    this.executingTasks.delete(taskId);

    // 等待重试延迟
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

    // 递归执行下一次执行尝试（保持执行来源不变，延续执行租约，
    // 并透传首次固化的任务定义与执行输入，不从存储重新加载）
    return this.executeTaskInternal(taskId, retryCount + 1, source, leaseExecutionId, task, true);
  }
}

// 导出单例实例
const taskExecutor = TaskExecutor.getInstance();
export default taskExecutor;
