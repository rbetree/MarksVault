import { useCallback, useEffect, useState } from 'react';
import { getFaviconUrl } from '../../../utils/favicon-service';
import { useFaviconRefresh } from '../shared/FaviconRefreshContext';

/**
 * favicon 加载（无回退）：
 * - Chromium：仅使用 `_favicon`（依赖浏览器缓存）
 * - Firefox：仍由 `getFaviconUrl` 内部决定（通常为 Google favicon 服务）
 */
export const useFavicon = (params: { url?: string; isFolder?: boolean }) => {
  const url = params.url ?? '';
  const isFolder = params.isFolder === true;

  const [iconUrl, setIconUrl] = useState('');
  const [iconError, setIconError] = useState(false);
  const { refreshToken } = useFaviconRefresh();

  // URL 变化时重置
  useEffect(() => {
    setIconError(false);
    if (!url || isFolder) {
      setIconUrl('');
      return;
    }

    const baseIconUrl = getFaviconUrl(url);
    if (!baseIconUrl) {
      setIconUrl('');
      return;
    }

    // 预热完成后，favicon 缓存可能已经写入，但已渲染的 `<img>` 不会自动刷新。
    // 通过注入一个稳定的 cache bust 参数，强制浏览器重新请求一次 `_favicon`。
    const separator = baseIconUrl.includes('?') ? '&' : '?';
    setIconUrl(`${baseIconUrl}${separator}mv_fv=${refreshToken}`);
  }, [url, isFolder, refreshToken]);

  const handleIconError = useCallback(() => {
    setIconError(true);
  }, []);

  return {
    iconUrl,
    iconError,
    handleIconError,
  };
};
