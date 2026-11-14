/**
 * 任务执行快照存储
 * 快照固化执行开始时的任务定义（含执行输入），持久化在 storage.local 中，
 * Service Worker 中断后仍可读取以恢复判定
 */

import { TaskSnapshot } from '../types/task';
import storageService from '../utils/storage-service';
import { Mutex } from './task-executor-mutex';

// 任务快照的 storage.local 存储键
const SNAPSHOTS_KEY = 'execution_snapshots';

export class ExecutionSnapshotStore {
  // 与租约检查-获取共用同一互斥队列，保证快照读-改-写不会与并发执行流程相互覆盖
  constructor(private readonly mutex: Mutex) {}

  /**
   * 读取全部任务快照
   * @returns 任务ID到任务快照的映射，读取失败时返回空对象
   */
  private async getSnapshots(): Promise<Record<string, TaskSnapshot>> {
    try {
      const result = await storageService.getStorageData(SNAPSHOTS_KEY);
      if (!result.success || !result.data) {
        return {};
      }

      const raw = result.data as Record<string, TaskSnapshot>;
      const snapshots: Record<string, TaskSnapshot> = {};
      for (const [taskId, snapshot] of Object.entries(raw)) {
        if (snapshot && snapshot.taskId && snapshot.task) {
          snapshots[taskId] = snapshot;
        }
      }
      return snapshots;
    } catch (error) {
      console.error('读取任务快照失败:', error);
      return {};
    }
  }

  /**
   * 获取指定任务未完成的执行快照
   * 用于 SW 中断后的可恢复判定：快照存在说明该任务有一次已开始但未正常结束的执行，
   * 其执行输入（如选中的书签）仍可从快照读取
   * @param taskId 任务ID
   * @returns 任务快照或 null（无未完成执行）
   */
  async getPending(taskId: string): Promise<TaskSnapshot | null> {
    const snapshots = await this.getSnapshots();
    return snapshots[taskId] ?? null;
  }

  /**
   * 持久化任务快照（含执行输入）
   * 同一任务不可并发执行，因此直接以 taskId 为键保存，覆盖旧快照
   * @param snapshot 任务快照
   */
  async save(snapshot: TaskSnapshot): Promise<void> {
    try {
      // 快照读-改-写纳入互斥：避免并发执行流程的快照读写相互覆盖
      await this.mutex.runExclusive(async () => {
        const result = await storageService.getStorageData(SNAPSHOTS_KEY);
        const snapshots = result.success && result.data
          ? { ...(result.data as Record<string, TaskSnapshot>) }
          : {};
        snapshots[snapshot.taskId] = snapshot;
        await storageService.setStorageData(SNAPSHOTS_KEY, snapshots);
      });
    } catch (error) {
      console.error(`保存任务快照 ${snapshot.taskId} 失败:`, error);
    }
  }

  /**
   * 删除任务快照
   * 任务执行正常结束时调用，使执行输入失效；
   * SW 中断时此方法不会执行，快照保留以便恢复判定
   * 删除失败时自动重试一次（共 2 次尝试），避免瞬时读写冲突导致快照残留
   * @param taskId 任务ID
   */
  async delete(taskId: string): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // 快照读-改-写纳入互斥：避免并发执行流程的快照读写相互覆盖
        await this.mutex.runExclusive(async () => {
          const result = await storageService.getStorageData(SNAPSHOTS_KEY);
          if (!result.success || !result.data) {
            return;
          }
          const snapshots = result.data as Record<string, TaskSnapshot>;
          if (!(taskId in snapshots)) {
            return;
          }
          delete snapshots[taskId];
          await storageService.setStorageData(SNAPSHOTS_KEY, snapshots);
        });
        return;
      } catch (error) {
        // 第一次失败后重试一次；重试仍失败才记录错误
        if (attempt === 1) {
          console.error(`删除任务快照 ${taskId} 失败:`, error);
        }
      }
    }
  }
}
