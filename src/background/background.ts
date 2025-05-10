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

// 监听书签事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('书签创建事件触发', bookmark);
  await triggerService.handleEventTrigger(EventType.BOOKMARK_CREATED, { id, bookmark });
});

chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log('书签删除事件触发', removeInfo);
  await triggerService.handleEventTrigger(EventType.BOOKMARK_REMOVED, { id, removeInfo });
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log('书签修改事件触发', changeInfo);
  await triggerService.handleEventTrigger(EventType.BOOKMARK_CHANGED, { id, changeInfo });
});

chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
  console.log('书签移动事件触发', moveInfo);
  await triggerService.handleEventTrigger(EventType.BOOKMARK_MOVED, { id, moveInfo });
});

export {}; 