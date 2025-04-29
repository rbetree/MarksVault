// MarksVault 后台脚本
// 负责处理事件监听和后台任务
import taskService from '../services/task-service';
import triggerService from '../services/trigger-service';
import taskExecutor from '../services/task-executor';
import { createDefaultTaskStorage } from '../types/task';

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
  
  // 初始化任务服务
  await taskService.init();
  
  // 初始化触发器服务
  await triggerService.init();
});

// 监听浏览器启动事件
chrome.runtime.onStartup.addListener(async () => {
  console.log('浏览器启动，初始化 MarksVault 服务...');
  
  // 初始化任务服务
  await taskService.init();
  
  // 初始化触发器服务
  await triggerService.init();
});

/**
 * 监听 Chrome Alarms 事件
 * 当alarm触发时，查找对应的任务并执行
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`Alarm 已触发: ${alarm.name}`);
  
  // 从alarm名称中提取任务ID
  const taskId = triggerService.getTaskIdFromAlarmName(alarm.name);
  if (!taskId) {
    console.error(`无法从alarm名称 ${alarm.name} 中提取任务ID`);
    return;
  }
  
  // 获取任务信息
  const taskResult = await taskService.getTaskById(taskId);
  if (!taskResult.success) {
    console.error(`找不到ID为 ${taskId} 的任务:`, taskResult.error);
    return;
  }
  
  const task = taskResult.data;
  
  // 执行任务
  console.log(`开始执行任务: ${task.name} (${taskId})`);
  await taskExecutor.executeTask(taskId);
  
  // 对于非一次性任务，重新设置alarm
  if (task.trigger.type === 'time' && task.trigger.schedule.type !== 'once') {
    await triggerService.createOrUpdateAlarm(task);
  }
});

// 可以添加更多的事件监听器和后台功能
// 例如：定期同步、处理消息等

export {}; 