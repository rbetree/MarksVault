/**
 * 触发器工具函数
 * 提供时间计算和Chrome Alarms API相关的辅助功能
 */

import { TimeTrigger, TimeScheduleType } from '../types/task';

/**
 * 计算触发器的下一次触发时间
 * @param trigger 时间触发器
 * @returns 下一次触发的时间戳（毫秒）
 */
export function calculateNextTriggerTime(trigger: TimeTrigger): number {
  const now = Date.now();
  
  switch (trigger.schedule.type) {
    case TimeScheduleType.ONCE:
      return trigger.schedule.when || now;
      
    case TimeScheduleType.INTERVAL:
      // 计算间隔毫秒数
      const intervalMs = (trigger.schedule.intervalMinutes || 60) * 60 * 1000;
      return now + intervalMs;
      
    case TimeScheduleType.DAILY:
      return getNextDailyTime(
        trigger.schedule.hour || 0,
        trigger.schedule.minute || 0
      );
      
    case TimeScheduleType.WEEKLY:
      return getNextWeeklyTime(
        trigger.schedule.dayOfWeek || 0,
        trigger.schedule.hour || 0,
        trigger.schedule.minute || 0
      );
      
    case TimeScheduleType.MONTHLY:
      return getNextMonthlyTime(
        trigger.schedule.dayOfMonth || 1,
        trigger.schedule.hour || 0,
        trigger.schedule.minute || 0
      );
      
    default:
      console.error('未知的时间调度类型:', trigger.schedule.type);
      return now + 24 * 60 * 60 * 1000; // 默认为24小时后
  }
}

/**
 * 获取下一个每日触发时间
 * @param hour 小时 (0-23)
 * @param minute 分钟 (0-59)
 * @returns 下一次触发的时间戳（毫秒）
 */
function getNextDailyTime(hour: number, minute: number): number {
  const now = new Date();
  const targetTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );
  
  // 如果目标时间已经过去，则设置为明天的同一时间
  if (targetTime.getTime() <= now.getTime()) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  return targetTime.getTime();
}

/**
 * 获取下一个每周触发时间
 * @param dayOfWeek 星期几 (0-6，0为周日)
 * @param hour 小时 (0-23)
 * @param minute 分钟 (0-59)
 * @returns 下一次触发的时间戳（毫秒）
 */
function getNextWeeklyTime(dayOfWeek: number, hour: number, minute: number): number {
  const now = new Date();
  const targetTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );
  
  // 计算目标日期与当前日期的差距
  const currentDayOfWeek = now.getDay();
  let daysToAdd = dayOfWeek - currentDayOfWeek;
  
  // 如果今天是目标日期但时间已过，或者目标日期在本周已过，则设置为下周
  if ((daysToAdd === 0 && targetTime.getTime() <= now.getTime()) || daysToAdd < 0) {
    daysToAdd += 7;
  }
  
  targetTime.setDate(targetTime.getDate() + daysToAdd);
  return targetTime.getTime();
}

/**
 * 获取下一个每月触发时间
 * @param dayOfMonth 月中日期 (1-31)
 * @param hour 小时 (0-23)
 * @param minute 分钟 (0-59)
 * @returns 下一次触发的时间戳（毫秒）
 */
function getNextMonthlyTime(dayOfMonth: number, hour: number, minute: number): number {
  const now = new Date();
  
  // 创建目标时间
  const targetTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.min(dayOfMonth, getDaysInMonth(now.getFullYear(), now.getMonth())),
    hour,
    minute,
    0,
    0
  );
  
  // 如果目标时间已经过去，则设置为下个月的同一天
  if (targetTime.getTime() <= now.getTime()) {
    targetTime.setMonth(targetTime.getMonth() + 1);
    // 确保日期有效（处理月份天数不同的情况）
    targetTime.setDate(Math.min(dayOfMonth, getDaysInMonth(targetTime.getFullYear(), targetTime.getMonth())));
  }
  
  return targetTime.getTime();
}

/**
 * 获取指定月份的天数
 * @param year 年份
 * @param month 月份 (0-11)
 * @returns 天数
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 根据触发器生成Chrome Alarm信息
 * @param trigger 时间触发器
 * @returns Chrome Alarm信息对象，如果无法生成则返回null
 */
export function getAlarmInfo(trigger: TimeTrigger): chrome.alarms.AlarmCreateInfo | null {
  try {
    switch (trigger.schedule.type) {
      case TimeScheduleType.ONCE:
        // 一次性触发
        if (!trigger.schedule.when) {
          console.error('ONCE类型的触发器必须指定when字段');
          return null;
        }
        return {
          when: trigger.schedule.when
        };
        
      case TimeScheduleType.INTERVAL:
        // 固定时间间隔触发
        if (!trigger.schedule.intervalMinutes || trigger.schedule.intervalMinutes < 1) {
          console.error('INTERVAL类型的触发器必须指定大于等于1的intervalMinutes字段');
          return null;
        }
        return {
          periodInMinutes: trigger.schedule.intervalMinutes
        };
        
      case TimeScheduleType.DAILY:
      case TimeScheduleType.WEEKLY:
      case TimeScheduleType.MONTHLY:
        // 这些周期性触发器需要计算下一次触发时间，并作为一次性alarm设置
        // 在alarm触发时，会重新计算下一次的时间并设置新的alarm
        const nextTrigger = calculateNextTriggerTime(trigger);
        return {
          when: nextTrigger
        };
        
      default:
        console.error('未知的时间调度类型:', trigger.schedule.type);
        return null;
    }
  } catch (error) {
    console.error('生成Alarm信息时出错:', error);
    return null;
  }
}

/**
 * 格式化时间戳为可读字符串
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化的时间字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * 验证触发器配置是否有效
 * @param trigger 时间触发器
 * @returns 是否有效
 */
export function validateTimeTrigger(trigger: TimeTrigger): boolean {
  try {
    switch (trigger.schedule.type) {
      case TimeScheduleType.ONCE:
        return !!trigger.schedule.when && trigger.schedule.when > Date.now();
        
      case TimeScheduleType.INTERVAL:
        return !!trigger.schedule.intervalMinutes && trigger.schedule.intervalMinutes >= 1;
        
      case TimeScheduleType.DAILY:
        return (
          typeof trigger.schedule.hour === 'number' && 
          typeof trigger.schedule.minute === 'number' &&
          trigger.schedule.hour >= 0 && trigger.schedule.hour <= 23 &&
          trigger.schedule.minute >= 0 && trigger.schedule.minute <= 59
        );
        
      case TimeScheduleType.WEEKLY:
        return (
          typeof trigger.schedule.dayOfWeek === 'number' &&
          typeof trigger.schedule.hour === 'number' && 
          typeof trigger.schedule.minute === 'number' &&
          trigger.schedule.dayOfWeek >= 0 && trigger.schedule.dayOfWeek <= 6 &&
          trigger.schedule.hour >= 0 && trigger.schedule.hour <= 23 &&
          trigger.schedule.minute >= 0 && trigger.schedule.minute <= 59
        );
        
      case TimeScheduleType.MONTHLY:
        return (
          typeof trigger.schedule.dayOfMonth === 'number' &&
          typeof trigger.schedule.hour === 'number' && 
          typeof trigger.schedule.minute === 'number' &&
          trigger.schedule.dayOfMonth >= 1 && trigger.schedule.dayOfMonth <= 31 &&
          trigger.schedule.hour >= 0 && trigger.schedule.hour <= 23 &&
          trigger.schedule.minute >= 0 && trigger.schedule.minute <= 59
        );
        
      default:
        return false;
    }
  } catch (error) {
    console.error('验证触发器配置时出错:', error);
    return false;
  }
} 