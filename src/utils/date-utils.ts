/**
 * 日期时间工具类
 * 提供统一的日期和时间格式化功能
 */

/**
 * 格式化日期时间为本地字符串
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的日期时间字符串（如：2023-01-01 12:00）
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 格式化相对时间
 * 对于过去的时间，显示"x分钟前"，"x小时前"，"x天前"等
 * 对于将来的时间，显示"x分钟后"，"x小时后"，"x天后"等
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的相对时间字符串
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);
  
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (diff >= 0) {
    // 将来的时间
    if (days > 0) {
      return `${days}天后`;
    } else if (hours > 0) {
      return `${hours}小时后`;
    } else if (minutes > 0) {
      return `${minutes}分钟后`;
    } else {
      return '即将执行';
    }
  } else {
    // 过去的时间
    if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚执行';
    }
  }
};

/**
 * 从时间戳创建简单日期时间格式（年-月-日 时:分）
 * @param timestamp 可选时间戳（毫秒）
 * @returns 格式化后的日期时间字符串，如果未提供时间戳则返回"未指定"
 */
export const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return '未指定';
  
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * 获取执行结果文本（用于任务执行历史）
 * @param timestamp 执行时间戳
 * @param success 是否执行成功
 * @param error 可选的错误信息
 * @returns 格式化后的执行结果文本
 */
export const getExecutionResultText = (timestamp: number, success: boolean, error?: string): string => {
  const dateStr = formatDate(timestamp);
  const result = success ? '成功' : '失败';
  
  return `${dateStr} - ${result}${error ? `: ${error}` : ''}`;
}; 