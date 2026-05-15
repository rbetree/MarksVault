import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface FaviconRefreshContextValue {
  /**
   * 用于触发 favicon 重新请求的版本号（递增即可）。
   * 典型场景：预热完成后，让已渲染的 `<img src="_favicon/...">` 强制刷新一次。
   */
  refreshToken: number;
  bumpRefreshToken: () => void;
}

const FaviconRefreshContext = createContext<FaviconRefreshContextValue | null>(null);

export const FaviconRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshToken, setRefreshToken] = useState(0);

  const bumpRefreshToken = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const value = useMemo<FaviconRefreshContextValue>(() => {
    return { refreshToken, bumpRefreshToken };
  }, [refreshToken, bumpRefreshToken]);

  return <FaviconRefreshContext.Provider value={value}>{children}</FaviconRefreshContext.Provider>;
};

export const useFaviconRefresh = (): FaviconRefreshContextValue => {
  const ctx = useContext(FaviconRefreshContext);
  if (!ctx) {
    throw new Error('useFaviconRefresh 必须在 <FaviconRefreshProvider> 内使用');
  }
  return ctx;
};

