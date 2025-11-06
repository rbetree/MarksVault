// MarksVault 后台脚本
// 负责处理事件监听和后台任务
import taskService from '../services/task-service';
import triggerService from '../services/trigger-service';
import taskExecutor from '../services/task-executor';
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

// 监听安装事件
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('MarksVault 扩展已安装');
    // 初始化存储
    chrome.storage.local.set({
      settings: {
        isDarkMode: false,
        syncEnabled: false,
      },
      bookmarks: {
        lastUpdated: null,
        customData: {},
      },
      tasks_data: createDefaultTaskStorage() // 初始化任务存储
    });
  } else if (details.reason === 'update') {
    console.log('MarksVault 扩展已更新到版本 ' + chrome.runtime.getManifest().version);
  }
  
  // 使用统一的服务初始化函数
  await initializeServices();
});

// 监听浏览器启动事件
chrome.runtime.onStartup.addListener(async () => {
  console.log('浏览器启动，初始化 MarksVault 服务...');
  
  // 使用统一的服务初始化函数
  await initializeServices();
  
  // 触发浏览器启动事件
  await triggerService.handleEventTrigger(EventType.BROWSER_STARTUP);
});

// 监听书签事件 - 统一触发书签变更事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, bookmark });
});

chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, removeInfo });
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, changeInfo });
});

chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
  await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, moveInfo });
});

// 由于在manifest.json中配置了default_popup，chrome.action.onClicked事件永远不会触发
// 监听扩展图标点击事件的代码已注释掉
// chrome.action.onClicked.addListener(async (tab) => {
//   console.log('扩展图标点击事件触发', tab);
//   await triggerService.handleEventTrigger(EventType.EXTENSION_CLICKED, { tab });
// });

// 监听来自书签选择页面的执行请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_SELECTIVE_PUSH') {
    const { taskId, selections } = message.payload;
    
    // 异步执行选择性推送
    (async () => {
      try {
        console.log('收到选择性推送请求:', { taskId, selectionsCount: selections.length });
        
        // 加载任务数据
        const taskResult = await taskService.getTaskById(taskId);
        if (!taskResult.success || !taskResult.data) {
          sendResponse({ success: false, error: '任务不存在' });
          return;
        }
        
        const task = taskResult.data;
        
        // 创建带有selections的临时任务对象
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
        
        // 使用executeTask执行（它会调用内部的executeSelectivePush）
        const result = await taskExecutor.executeTask(taskWithSelections.id);
        
        if (result.success) {
          console.log('选择性推送成功');
          sendResponse({ success: true });
        } else {
          console.error('选择性推送失败:', result.error);
          sendResponse({ success: false, error: result.error });
        }
      } catch (error) {
        console.error('执行选择性推送时出错:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    })();
    
    // 返回true表示将异步发送响应
    return true;
  }
});

export {};