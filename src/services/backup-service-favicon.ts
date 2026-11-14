import { BookmarkItem } from '../utils/bookmark-service';
import { getFaviconUrl } from '../utils/favicon-service';

const FAVICON_FETCH_TIMEOUT_MS = 5000;
const FAVICON_PREFETCH_CONCURRENCY = 6;

/**
 * 获取图标并转换为 Base64 Data URI (PNG 格式)
 * @param url 网站 URL
 * @returns Base64 编码的 PNG 图标数据或 null
 */
export async function fetchIconAsBase64(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), FAVICON_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const blob = await response.blob();

    // 如果已经是 PNG 格式，直接转换
    if (blob.type === 'image/png') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }

    // 如果不是 PNG，通过 Canvas 转换为 PNG
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);

      img.onload = () => {
        try {
          // 创建 canvas 进行格式转换
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0);

          // 转换为 PNG 格式的 Data URI
          const pngDataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(objectUrl);
          resolve(pngDataUrl);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };

      img.src = objectUrl;
    });
  } catch (error) {
    console.warn('获取图标失败:', error);
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function getFaviconCacheKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

function collectBookmarksWithUrl(items: BookmarkItem[]): BookmarkItem[] {
  const result: BookmarkItem[] = [];

  const walk = (nodes: BookmarkItem[]) => {
    for (const node of nodes) {
      if (!node.isFolder && node.url) {
        result.push(node);
      }

      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(items);
  return result;
}

export async function preloadFaviconIcons(
  bookmarks: BookmarkItem[],
  fetchIcon: (url: string) => Promise<string | null> = fetchIconAsBase64
): Promise<Map<string, string>> {
  const bookmarksWithUrl = collectBookmarksWithUrl(bookmarks);
  if (bookmarksWithUrl.length === 0) {
    return new Map();
  }

  const faviconByKey = new Map<string, string>();
  const faviconUrlByKey = new Map<string, string>();

  for (const bookmark of bookmarksWithUrl) {
    if (!bookmark.url) continue;
    const faviconKey = getFaviconCacheKey(bookmark.url);
    if (faviconUrlByKey.has(faviconKey)) continue;

    const faviconUrl = getFaviconUrl(bookmark.url);
    if (!faviconUrl) continue;
    faviconUrlByKey.set(faviconKey, faviconUrl);
  }

  const faviconKeys = Array.from(faviconUrlByKey.keys());
  let cursor = 0;

  const worker = async () => {
    while (cursor < faviconKeys.length) {
      const faviconKey = faviconKeys[cursor++];
      const faviconUrl = faviconUrlByKey.get(faviconKey);
      if (!faviconUrl) continue;

      try {
        const iconData = await fetchIcon(faviconUrl);
        if (iconData && iconData.startsWith('data:image/')) {
          faviconByKey.set(faviconKey, iconData);
        }
      } catch (error) {
        console.warn('预加载 favicon 失败:', faviconUrl, error);
      }
    }
  };

  const workerCount = Math.min(FAVICON_PREFETCH_CONCURRENCY, faviconKeys.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return faviconByKey;
}
