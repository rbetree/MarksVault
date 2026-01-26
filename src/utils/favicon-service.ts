/**
 * 网站图标服务 - 用于获取和处理网站图标(favicon)
 */

import { browser } from 'wxt/browser';

/**
 * 从URL获取域名
 * @param url 完整URL
 * @returns 域名部分
 */
export const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('无效的URL:', url);
    return '';
  }
};

/**
 * 获取网站图标URL
 * @param url 网站URL
 * @returns 图标URL
 */
export const getFaviconUrl = (url: string): string => {
  try {
    // 检查URL是否有效
    if (!url) return '';
    
    // 优先使用浏览器内置的 _favicon（需要 manifest 中声明 favicon 权限与 web_accessible_resources）
    // 使用 runtime.getURL 构建 URL，避免硬编码 chrome-extension://（Firefox 为 moz-extension://）
    // 注意：部分浏览器可能不支持 _favicon 端点，此时会回退到 Google favicon 服务
    return browser.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
  } catch (error) {
    console.error('获取图标URL失败:', error);
    
    // 如果Chrome API失败，回退到Google的favicon服务
    try {
      const domain = getDomainFromUrl(url);
      if (!domain) return '';
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return '';
    }
  }
};

/**
 * 获取网站主题色(未来可以扩展)
 * @param url 网站URL
 * @returns Promise<string> 返回颜色代码
 */
export const getWebsiteThemeColor = async (url: string): Promise<string> => {
  // 这里可以实现获取网站主题色的逻辑
  // 默认返回一个占位色
  return '#f0f0f0';
};

/**
 * 检查图标是否有效
 * @param iconUrl 图标URL
 * @returns Promise<boolean> 是否有效
 */
export const isValidFavicon = async (iconUrl: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = iconUrl;
  });
};

const faviconService = {
  getFaviconUrl,
  getDomainFromUrl,
  getWebsiteThemeColor,
  isValidFavicon
};

export default faviconService; 
