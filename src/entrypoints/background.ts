// MarksVault 后台脚本
// 负责处理事件监听和后台任务
import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

import taskExecutor from '../services/task-executor';
import taskService from '../services/task-service';
import triggerService from '../services/trigger-service';
import backupService from '../services/backup-service';
import notificationService, { BACKUP_REMINDER_ALARM_NAME } from '../services/notification-service';
import { warmupBookmarkFavicons } from '../services/favicon-warmup-service';
import {
  releaseBookmarkWriteLease,
  tryAcquireBookmarkWriteLease,
} from '../services/task-executor-lease';
import { ActionType, createDefaultTaskStorage, EventType, Task } from '../types/task';
import { ACTION_TIMEOUTS, resolveExecutionLeaseDuration } from '../services/task-executor-types';

// 回滚入口不是任务执行，使用固定伪任务ID持有书签写入租约，与任务写入互斥
const PENDING_RESTORE_ROLLBACK_LEASE_TASK_ID = 'pending_restore_rollback';

function generateRollbackExecutionId(): string {
  return `rollback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 初始化所有后台服务
 */
async function initializeServices() {
  console.log('正在初始化 MarksVault 服务...');

  // 初始化任务服务
  await taskService.init();
  console.log('任务服务初始化完成');

  // 初始化任务执行引擎
  await taskExecutor.init();
  console.log('任务执行引擎初始化完成');

  // 初始化触发器服务
  await triggerService.init();
  console.log('触发器服务初始化完成');

  console.log('MarksVault 服务初始化完成');
}

let servicesInitPromise: Promise<void> | null = null;

/**
 * 确保后台服务在当前 Service Worker 生命周期内完成初始化。
 *
 * 背景：MV3 的 Service Worker 会被系统频繁回收/重启，不能只依赖 onStartup/onInstalled。
 * 任何事件回调在执行核心逻辑前，都应先确保依赖服务已完成初始化。
 */
async function ensureServicesInitialized() {
  if (!servicesInitPromise) {
    servicesInitPromise = initializeServices().catch((error) => {
      // 初始化失败后允许后续事件重试，避免在当前 SW 生命周期内永久卡死。
      servicesInitPromise = null;
      throw error;
    });
  }
  await servicesInitPromise;
}

async function ensureServicesInitializedOrLog(context: string): Promise<boolean> {
  try {
    await ensureServicesInitialized();
    return true;
  } catch (error) {
    console.error(`[${context}] 服务初始化失败，本次事件跳过:`, error);
    return false;
  }
}

export async function ensureServicesInitializedForTesting(): Promise<void> {
  await ensureServicesInitialized();
}

export function resetServicesInitStateForTesting(): void {
  servicesInitPromise = null;
}

export default defineBackground({
  type: 'module',
  main() {
    // 每日备份检查：alarm 在安装/启动时确保存在，Service Worker 重启后仍会触发
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== BACKUP_REMINDER_ALARM_NAME) return;
      void notificationService.checkBackupReminder().catch((error) => {
        console.error('[alarms.onAlarm] 备份提醒检查失败:', error);
      });
    });

    // 监听安装事件
    browser.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        console.log('MarksVault 扩展已安装');
        // 初始化存储
        await browser.storage.local.set({
          settings: {
            isDarkMode: false,
            syncEnabled: false,
          },
          bookmarks: {
            lastUpdated: null,
            customData: {},
          },
          tasks_data: createDefaultTaskStorage(), // 初始化任务存储
        });
      } else if (details.reason === 'update') {
        console.log(
          'MarksVault 扩展已更新到版本 ' + browser.runtime.getManifest().version,
        );
      }

      // 安装/更新后确保每日备份检查定时任务存在
      await notificationService.ensureBackupReminderAlarm();

      // 使用统一的服务初始化函数
      await ensureServicesInitializedOrLog('onInstalled');
    });

    // 监听浏览器启动事件
    browser.runtime.onStartup.addListener(async () => {
      console.log('浏览器启动，初始化 MarksVault 服务...');

      // 确保每日备份检查定时任务存在
      await notificationService.ensureBackupReminderAlarm();

      // 使用统一的服务初始化函数
      if (!await ensureServicesInitializedOrLog('onStartup')) {
        return;
      }

      // 触发浏览器启动事件
      await triggerService.handleEventTrigger(EventType.BROWSER_STARTUP);
    });

    // 监听书签事件 - 统一触发书签变更事件
    browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
      if (!await ensureServicesInitializedOrLog('bookmarks.onCreated')) {
        return;
      }
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, bookmark });
      await notificationService.notifyBookmarkChanges();
    });

    browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
      if (!await ensureServicesInitializedOrLog('bookmarks.onRemoved')) {
        return;
      }
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, removeInfo });
      await notificationService.notifyBookmarkChanges();
    });

    browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
      if (!await ensureServicesInitializedOrLog('bookmarks.onChanged')) {
        return;
      }
      // 附带最小 bookmark 对象（title/url 为变更后的新值），
      // 供 trigger-service 的条件匹配使用（仅识别 bookmarkData.bookmark）
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, {
        id,
        changeInfo,
        bookmark: { id, title: changeInfo.title, url: changeInfo.url },
      });
      await notificationService.notifyBookmarkChanges();
    });

    browser.bookmarks.onMoved.addListener(async (id, moveInfo) => {
      if (!await ensureServicesInitializedOrLog('bookmarks.onMoved')) {
        return;
      }
      // 附带最小 bookmark 对象（parentId 为移动后的新父文件夹），
      // 供 trigger-service 的条件匹配使用（仅识别 bookmarkData.bookmark）
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, {
        id,
        moveInfo,
        bookmark: { id, parentId: moveInfo.parentId },
      });
      await notificationService.notifyBookmarkChanges();
    });

    // 由于在 manifest 中配置了 action.default_popup，chrome.action.onClicked 事件永远不会触发
    // 监听扩展图标点击事件的代码已注释掉
    // chrome.action.onClicked.addListener(async (tab) => {
    //   console.log('扩展图标点击事件触发', tab);
    //   await triggerService.handleEventTrigger(EventType.EXTENSION_CLICKED, { tab });
    // });

    // 监听来自页面的消息（Chrome 需要 sendResponse + return true 才能异步响应）
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message?.type) return;

      const respondError = (error: unknown) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      };

      if (message.type === 'EXECUTE_SELECTIVE_PUSH') {
        void (async () => {
          if (!await ensureServicesInitializedOrLog('runtime.onMessage:EXECUTE_SELECTIVE_PUSH')) {
            return { success: false, error: '后台服务尚未准备就绪，请稍后重试' };
          }

          const taskId = message?.payload?.taskId as unknown;
          const selections = message?.payload?.selections as unknown;

          // 数据校验
          if (!taskId || typeof taskId !== 'string') {
            return { success: false, error: '无效的任务ID' };
          }
          if (!Array.isArray(selections) || selections.length === 0) {
            return { success: false, error: '未选择任何书签' };
          }

          console.log('收到选择性推送请求:', { taskId, selectionsCount: selections.length });

          // 加载任务数据
          const taskResult = await taskService.getTaskById(taskId);
          if (!taskResult.success || !taskResult.data) {
            return { success: false, error: '任务不存在' };
          }

          const task = taskResult.data;

          // 安全校验：仅允许选择性推送类型的任务通过该通道执行，
          // 防止 restore 等其他操作绕过 UI 二次确认覆盖书签树
          if (task.action.type !== ActionType.SELECTIVE_PUSH) {
            return { success: false, error: '仅支持选择性推送任务' };
          }

          // 最小形状校验：每个选择项必须是带字符串 id 的对象（容忍缺 title/type）
          const isValidSelection = (item: unknown): boolean =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as { id?: unknown }).id === 'string';
          if (!selections.every(isValidSelection)) {
            return { success: false, error: '选择数据无效' };
          }

          // 创建带有 selections 的临时任务对象
          const taskWithSelections = {
            ...task,
            action: {
              ...task.action,
              options: {
                ...task.action.options,
                selections,
              },
            },
          };

          // 使用 executeTaskWithData 执行，直接传入包含 selections 的任务对象
          // 用户从 UI 明确发起，执行来源为 manual
          const result = await taskExecutor.executeTaskWithData(taskWithSelections, 0, 'manual');
          await notificationService.notifySyncStatus(task, result);

          if (result.success) return { success: true };

          console.error('选择性推送失败:', result.error);
          return { success: false, error: result.error };
        })()
          .then((response) => sendResponse(response))
          .catch(respondError);

        return true;
      }

      if (message.type === 'EXECUTE_TASK_WITH_DATA') {
        void (async () => {
          if (!await ensureServicesInitializedOrLog('runtime.onMessage:EXECUTE_TASK_WITH_DATA')) {
            return { success: false, error: '后台服务尚未准备就绪，请稍后重试' };
          }

          const taskId = message?.payload?.taskId as unknown;
          const backupFilePath = message?.payload?.backupFilePath as unknown;

          if (!taskId || typeof taskId !== 'string') {
            return { success: false, error: '无效的任务ID' };
          }
          if (backupFilePath !== undefined && typeof backupFilePath !== 'string') {
            return { success: false, error: '无效的备份文件路径' };
          }

          // 任务配置从存储读取，运行时只覆盖恢复来源（最新备份或指定文件），
          // 避免调用方伪造触发器等任务定义
          const taskResult = await taskService.getTaskById(taskId);
          if (!taskResult.success || !taskResult.data) {
            return { success: false, error: '任务不存在' };
          }

          const task = taskResult.data as Task;
          if (task.action.type !== ActionType.BACKUP || task.action.operation !== 'restore') {
            return { success: false, error: '仅支持恢复书签任务' };
          }

          const options = { ...task.action.options };
          const selectedPath = typeof backupFilePath === 'string' ? backupFilePath.trim() : '';
          if (selectedPath) {
            options.backupFilePath = selectedPath;
          } else {
            // 选择“最新备份”时显式移除旧路径，避免持久化配置中的残留路径覆盖本次选择
            delete options.backupFilePath;
          }

          const taskToExecute: Task = {
            ...task,
            action: {
              ...task.action,
              options,
            },
          };

          console.log('收到恢复任务执行请求:', { taskId, useSelectedPath: !!selectedPath });

          // 用户从二次确认对话框明确发起，执行来源为 manual
          const result = await taskExecutor.executeTaskWithData(taskToExecute, 0, 'manual');
          await notificationService.notifySyncStatus(taskToExecute, result);

          return { success: result.success, error: result.error };
        })()
          .then((response) => sendResponse(response))
          .catch(respondError);

        return true;
      }

      if (message.type === 'RESTORE_PENDING_BOOKMARK_BACKUP') {
        void (async () => {
          if (!await ensureServicesInitializedOrLog('runtime.onMessage:RESTORE_PENDING_BOOKMARK_BACKUP')) {
            return { success: false, error: '后台服务尚未准备就绪，请稍后重试' };
          }

          // 回滚会重建书签栏，必须与任务写入互斥：先检查并获取书签写入租约
          const executionId = generateRollbackExecutionId();
          // 回滚与恢复同样重建书签树，写入租约按恢复动作超时设置，避免大书签树中途失去租约
          const lease = await tryAcquireBookmarkWriteLease(
            PENDING_RESTORE_ROLLBACK_LEASE_TASK_ID,
            executionId,
            resolveExecutionLeaseDuration(ACTION_TIMEOUTS.restore)
          );
          if (!lease.success) {
            return {
              success: false,
              error: lease.denied
                ? '另一个任务正在修改书签树，请稍后重试'
                : '获取书签写入租约失败',
            };
          }

          try {
            const result = await backupService.restorePendingBookmarkBackup();
            return {
              success: result.success,
              data: result.data,
              error: result.error,
            };
          } finally {
            // 成功或失败都必须释放写入租约；释放失败时租约将在到期后自然失效
            await releaseBookmarkWriteLease(executionId);
          }
        })()
          .then((response) => sendResponse(response))
          .catch(respondError);

        return true;
      }

      if (message.type === 'EXECUTE_TASK') {
        void (async () => {
          if (!await ensureServicesInitializedOrLog('runtime.onMessage:EXECUTE_TASK')) {
            return { success: false, error: '后台服务尚未准备就绪，请稍后重试' };
          }

          // 规范消息使用 payload.taskId；兼容早期快捷备份发送的顶层 taskId
          const taskId = (message?.payload?.taskId ?? message?.taskId) as unknown;

          // 数据校验
          if (!taskId || typeof taskId !== 'string') {
            return { success: false, error: '无效的任务ID' };
          }

          // 校验任务存在
          const taskResult = await taskService.getTaskById(taskId);
          if (!taskResult.success || !taskResult.data) {
            return { success: false, error: '任务不存在' };
          }
          const task = taskResult.data as Task;

          console.log('收到手动执行任务请求:', { taskId });

          // 用户从 UI 明确发起，执行来源为 manual
          const result = await taskExecutor.executeTask(taskId, 0, 'manual');
          await notificationService.notifySyncStatus(task, result);

          return { success: result.success, error: result.error };
        })()
          .then((response) => sendResponse(response))
          .catch(respondError);

        return true;
      }

      if (message.type === 'WARMUP_BOOKMARK_FAVICONS') {
        void (async () => {
          // 该操作不依赖任务系统，但仍尽量在服务就绪后执行，以保持后台行为一致
          const ready = await ensureServicesInitializedOrLog('runtime.onMessage:WARMUP_BOOKMARK_FAVICONS');
          if (!ready) {
            return { success: false, error: '扩展服务尚未就绪，请稍后重试' };
          }

          const scope = message?.payload?.scope as unknown;
          const scopeValue = scope === 'all' ? 'all' : 'bookmark_bar';

          const result = await warmupBookmarkFavicons({
            scope: scopeValue,
          });

          return { success: result.success, data: result, error: result.error };
        })()
          .then((response) => sendResponse(response))
          .catch(respondError);

        return true;
      }

      return;
    });
  },
});
