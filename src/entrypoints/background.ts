// MarksVault 后台脚本
// 负责处理事件监听和后台任务
import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

import taskExecutor from '../services/task-executor';
import taskService from '../services/task-service';
import triggerService from '../services/trigger-service';
import { createDefaultTaskStorage, EventType } from '../types/task';

/**
 * 初始化所有后台服务
 */
async function initializeServices() {
  try {
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
  } catch (error) {
    console.error('服务初始化失败:', error);
  }
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
    servicesInitPromise = initializeServices();
  }
  await servicesInitPromise;
}

export default defineBackground({
  type: 'module',
  main() {
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

      // 使用统一的服务初始化函数
      await ensureServicesInitialized();
    });

    // 监听浏览器启动事件
    browser.runtime.onStartup.addListener(async () => {
      console.log('浏览器启动，初始化 MarksVault 服务...');

      // 使用统一的服务初始化函数
      await ensureServicesInitialized();

      // 触发浏览器启动事件
      await triggerService.handleEventTrigger(EventType.BROWSER_STARTUP);
    });

    // 监听书签事件 - 统一触发书签变更事件
    browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
      await ensureServicesInitialized();
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, bookmark });
    });

    browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
      await ensureServicesInitialized();
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, removeInfo });
    });

    browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
      await ensureServicesInitialized();
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, changeInfo });
    });

    browser.bookmarks.onMoved.addListener(async (id, moveInfo) => {
      await ensureServicesInitialized();
      await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, moveInfo });
    });

    // 由于在 manifest 中配置了 action.default_popup，chrome.action.onClicked 事件永远不会触发
    // 监听扩展图标点击事件的代码已注释掉
    // chrome.action.onClicked.addListener(async (tab) => {
    //   console.log('扩展图标点击事件触发', tab);
    //   await triggerService.handleEventTrigger(EventType.EXTENSION_CLICKED, { tab });
    // });

    // 监听来自书签选择页面的执行请求
    browser.runtime.onMessage.addListener(async (message) => {
      if (message?.type !== 'EXECUTE_SELECTIVE_PUSH') return;

      await ensureServicesInitialized();

      const taskId = message?.payload?.taskId as unknown;
      const selections = message?.payload?.selections as unknown;

      try {
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
        const result = await taskExecutor.executeTaskWithData(taskWithSelections);

        if (result.success) return { success: true };

        console.error('选择性推送失败:', result.error);
        return { success: false, error: result.error };
      } catch (error) {
        console.error('执行选择性推送时出错:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        };
      }
    });
  },
});
