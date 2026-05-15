import bookmarkService, { type BookmarkItem, findBookmarkBar } from '../utils/bookmark-service';
import { getFaviconUrl } from '../utils/favicon-service';
import { browser } from 'wxt/browser';

export type FaviconWarmupScope = 'bookmark_bar' | 'all';

export interface FaviconWarmupOptions {
  scope?: FaviconWarmupScope;
  maxDomains?: number;
  concurrency?: number;
  timeoutMs?: number;
  /**
   * 单个页面最小停留时间（毫秒）。
   * 背景：部分网站的 favicon 写入/落盘可能滞后于 tab 的 update 事件；过早关闭可能导致缓存未写入。
   */
  minStayMs?: number;
}

export interface FaviconWarmupResult {
  success: boolean;
  attempted: number;
  warmed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  error?: string;
}

const DEFAULT_OPTIONS: Required<FaviconWarmupOptions> = {
  scope: 'bookmark_bar',
  maxDomains: 150,
  concurrency: 6,
  timeoutMs: 4000,
  minStayMs: 1200,
};

const collectBookmarkUrls = (nodes: BookmarkItem[]): string[] => {
  const urls: string[] = [];

  const walk = (items: BookmarkItem[]) => {
    for (const item of items) {
      if (!item.isFolder && item.url) {
        urls.push(item.url);
      }
      if (item.children && item.children.length > 0) {
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return urls;
};

const dedupeByPageUrl = (urls: string[], maxUrls: number): string[] => {
  const byUrl = new Map<string, string>();

  for (const url of urls) {
    if (!url || typeof url !== 'string') continue;
    const trimmed = url.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      // 只对 http(s) 网站做预热；chrome://、file:// 等不走该流程
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;

      // 注意：不要移除 hash。
      // 原生书签栏的 favicon 关联在 Chromium 内部可能仍按“完整 URL”做映射，
      // 过度归一化会导致“访问过但书签栏仍无图标”的错觉。
      const normalized = parsed.toString();
      if (!normalized) continue;
      if (byUrl.has(normalized)) continue;
      byUrl.set(normalized, normalized);
      if (byUrl.size >= maxUrls) break;
    } catch {
      // ignore invalid URL
    }
  }

  return Array.from(byUrl.values());
};

const isFirefoxRuntime = (): boolean => {
  return typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
};

const waitForTabComplete = async (tabId: number, timeoutMs: number): Promise<boolean> => {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      try {
        browser.tabs.onUpdated.removeListener(onUpdated);
      } catch {
        // ignore
      }
      resolve(ok);
    };

    const onUpdated = (updatedTabId: number, changeInfo: any, tab?: any) => {
      if (updatedTabId !== tabId) return;

      const status = typeof changeInfo?.status === 'string' ? changeInfo.status : tab?.status;
      if (status === 'complete') {
        finish(true);
      }
    };

    try {
      browser.tabs.onUpdated.addListener(onUpdated);
    } catch {
      // ignore：若 API 不可用，则只能靠超时兜底
    }

    timeoutHandle = setTimeout(() => finish(false), timeoutMs);
  });
};

const fetchWithTimeout = async (
  url: string,
  options: { timeoutMs: number },
): Promise<Response | null> => {
  if (typeof fetch !== 'function') return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const handle = setTimeout(() => controller?.abort(), Math.max(0, options.timeoutMs));

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller?.signal,
    });
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(handle);
  }
};

const probeFaviconCache = async (pageUrl: string, timeoutMs: number): Promise<boolean> => {
  const iconUrl = getFaviconUrl(pageUrl);
  if (!iconUrl || !iconUrl.includes('_favicon/?')) return false;

  const separator = iconUrl.includes('?') ? '&' : '?';
  const probeUrl = `${iconUrl}${separator}mv_probe=${Date.now()}`;
  const response = await fetchWithTimeout(probeUrl, { timeoutMs });
  if (!response || !response.ok) return false;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('image/')) return false;

  try {
    // 读取 body，确保请求真正完成（避免极端情况下被中途取消）。
    await response.arrayBuffer();
  } catch {
    // ignore
  }

  return true;
};

const visitUrlInBackground = async (
  url: string,
  options: { timeoutMs: number; minStayMs: number; windowId?: number; active?: boolean },
): Promise<boolean> => {
  let tabId: number | undefined;
  try {
    const tab = await browser.tabs.create({
      url,
      active: options.active ?? false,
      ...(typeof options.windowId === 'number' ? { windowId: options.windowId } : {}),
    });

    tabId = tab?.id;
    if (typeof tabId !== 'number') return false;

    // 避免被 Chrome 立即丢弃（大量后台 tab 时更常见）
    try {
      await browser.tabs.update(tabId, { autoDiscardable: false });
    } catch {
      // ignore
    }

    const completed = await waitForTabComplete(tabId, options.timeoutMs);
    // 页面 complete 后再多停留一段时间，确保 favicon 写入/落盘。
    const stayMs = Math.max(0, options.minStayMs);
    if (completed && stayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, stayMs));
    }

    // 以 `_favicon` 作为最终验收标准：只要这里能取到图标，popup 列表就能显示。
    const warmed = await probeFaviconCache(url, Math.min(2000, Math.max(500, options.timeoutMs)));
    return warmed;
  } catch {
    return false;
  } finally {
    if (typeof tabId === 'number') {
      try {
        await browser.tabs.remove(tabId);
      } catch {
        // ignore
      }
    }
  }
};

/**
 * 预热书签 favicon（Chromium 优先）
 *
 * 目的：解决“恢复书签后必须手动打开网址才会出现图标”的体验问题。
 * 策略：按书签 URL 去重后，在后台短暂访问这些页面，从而触发 Chromium 抓取并写入 favicon 缓存。
 *
 * 注意：
 * - 该过程会产生真实的网络访问（等价于在后台打开网页），可能写入浏览历史/触发站点统计。
 * - 仅用于 Chromium 的 favicon 缓存预热；Firefox 仍会跳过（attempted=0 / skipped>0）。
 */
export const warmupBookmarkFavicons = async (
  options?: FaviconWarmupOptions,
): Promise<FaviconWarmupResult> => {
  const start = Date.now();
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...(options || {}) };

  try {
    const scope = resolvedOptions.scope;

    let nodesToScan: BookmarkItem[] = [];
    if (scope === 'bookmark_bar') {
      const rootsResult = await bookmarkService.getBookmarkRoots();
      if (!rootsResult.success || !rootsResult.data) {
        return {
          success: false,
          attempted: 0,
          warmed: 0,
          failed: 0,
          skipped: 0,
          durationMs: Date.now() - start,
          error: rootsResult.error || '获取书签根失败',
        };
      }

      const roots = rootsResult.data as BookmarkItem[];
      const bar = findBookmarkBar(roots);
      nodesToScan = bar?.children ?? [];
    } else {
      const allResult = await bookmarkService.getAllBookmarks();
      if (!allResult.success || !allResult.data) {
        return {
          success: false,
          attempted: 0,
          warmed: 0,
          failed: 0,
          skipped: 0,
          durationMs: Date.now() - start,
          error: allResult.error || '获取书签失败',
        };
      }

      nodesToScan = allResult.data as BookmarkItem[];
    }

    const rawUrls = collectBookmarkUrls(nodesToScan);
    // 这里沿用 maxDomains 这个字段名（历史原因），实际含义是“最多预热多少个 URL”
    const pageUrls = dedupeByPageUrl(rawUrls, resolvedOptions.maxDomains);

    if (pageUrls.length === 0) {
      return {
        success: true,
        attempted: 0,
        warmed: 0,
        failed: 0,
        skipped: 0,
        durationMs: Date.now() - start,
      };
    }

    // Firefox 直接跳过：该浏览器不支持 Chromium 的 `_favicon` 缓存机制
    if (isFirefoxRuntime()) {
      return {
        success: true,
        attempted: 0,
        warmed: 0,
        failed: 0,
        skipped: pageUrls.length,
        durationMs: Date.now() - start,
      };
    }

    // Chromium：仅对会走 `_favicon` 的站点执行预热（约束：只使用 Chromium favicon 缓存）
    const visitTargets: string[] = [];
    let skipped = 0;
    for (const pageUrl of pageUrls) {
      const iconUrl = getFaviconUrl(pageUrl);
      if (!iconUrl || !iconUrl.includes('_favicon/?')) {
        skipped++;
        continue;
      }
      visitTargets.push(pageUrl);
    }

    if (visitTargets.length === 0) {
      return {
        success: true,
        attempted: 0,
        warmed: 0,
        failed: 0,
        skipped,
        durationMs: Date.now() - start,
      };
    }

    // 在一个最小化窗口中批量打开后台标签页，避免打扰用户当前窗口
    let warmupWindowId: number | undefined;
    try {
      const warmupWindow = await browser.windows.create({
        url: 'about:blank',
        focused: false,
        state: 'minimized',
      });
      if (typeof warmupWindow?.id === 'number') {
        warmupWindowId = warmupWindow.id;
      }
    } catch {
      // ignore：若创建窗口失败则使用默认窗口
    }

    let cursor = 0;
    let warmed = 0;
    let failed = 0;

    const worker = async () => {
      while (cursor < visitTargets.length) {
        const target = visitTargets[cursor++];
        const ok = await visitUrlInBackground(target, {
          timeoutMs: resolvedOptions.timeoutMs,
          minStayMs: resolvedOptions.minStayMs,
          ...(typeof warmupWindowId === 'number' ? { windowId: warmupWindowId } : {}),
          // 若能放在预热窗口中，则把 tab 设为 active（窗口未聚焦，用户无感，但加载优先级更高）。
          active: typeof warmupWindowId === 'number',
        });
        if (ok) warmed += 1;
        else failed += 1;
      }
    };

    const workerCount = Math.min(resolvedOptions.concurrency, visitTargets.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (typeof warmupWindowId === 'number') {
      try {
        await browser.windows.remove(warmupWindowId);
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      attempted: visitTargets.length,
      warmed,
      failed,
      skipped,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      attempted: 0,
      warmed: 0,
      failed: 0,
      skipped: 0,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default {
  warmupBookmarkFavicons,
};
