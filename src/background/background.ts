// MarksVault 后台脚本
// 负责处理事件监听和后台任务
import taskService from '../services/task-service';
import triggerService from '../services/trigger-service';
import taskExecutor from '../services/task-executor';
import { createDefaultTaskStorage } from '../types/task';

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
});

/**
 * 监听 Chrome Alarms 事件
 * 当alarm触发时，查找对应的任务并执行
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`Alarm 已触发: ${alarm.name}, 时间: ${new Date().toLocaleString()}`);
  
  try {
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
    
    // 检查任务状态
    if (task.status !== 'enabled' && task.status !== 'failed') {
      console.warn(`任务 ${task.id} (${task.name}) 当前状态为 ${task.status}，跳过执行`);
      return;
    }
    
    // 记录执行时间和任务信息
    console.log(`开始执行任务: ${task.name} (${taskId}), 类型: ${task.action.type}, 触发器: ${task.trigger.type}`);
    
    // 执行任务
    try {
      const result = await taskExecutor.executeTask(taskId);
      
      if (result.success) {
        console.log(`任务 ${task.name} (${taskId}) 执行成功: ${result.details || '无详细信息'}`);
      } else {
        console.error(`任务 ${task.name} (${taskId}) 执行失败: ${result.error || '未知错误'}`);
        // 失败原因详情
        if (result.details) {
          console.error(`失败详情: ${result.details}`);
        }
      }
    } catch (executionError) {
      console.error(`任务 ${task.name} (${taskId}) 执行异常:`, executionError);
    }
    
    try {
      // 无论任务是否执行成功，对于非一次性任务，都需要重新设置alarm
      if (task.trigger.type === 'time' && task.trigger.schedule.type !== 'once') {
        await triggerService.createOrUpdateAlarm(task);
        
        // 获取更新后的任务信息，显示下次执行时间
        const updatedTaskResult = await taskService.getTaskById(taskId);
        if (updatedTaskResult.success && 
            updatedTaskResult.data.trigger.type === 'time' && 
            'nextTrigger' in updatedTaskResult.data.trigger) {
          const nextTrigger = updatedTaskResult.data.trigger.nextTrigger;
          console.log(`任务 ${task.name} (${taskId}) 下次执行时间: ${new Date(nextTrigger).toLocaleString()}`);
        }
      } else if (task.trigger.type === 'time' && task.trigger.schedule.type === 'once') {
        console.log(`一次性任务 ${task.name} (${taskId}) 执行完毕，不再安排后续执行`);
      }
    } catch (alarmError) {
      console.error(`重新设置任务 ${task.id} (${task.name}) 的alarm失败:`, alarmError);
    }
  } catch (error) {
    console.error(`处理alarm事件时发生异常:`, error);
  }
});

// 可以添加更多的事件监听器和后台功能
// 例如：定期同步、处理消息等

export {}; 