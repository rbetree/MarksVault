// Jest 环境下的 WXT browser mock
// 仅用于单元测试，避免 Jest 无法直接加载 wxt/browser (ESM) 导致的报错。

export const browser = {
  runtime: {
    getURL: (path: string) => `chrome-extension://__jest__${path}`,
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => undefined,
    },
    sync: {
      get: async () => ({}),
      set: async () => undefined,
    },
  },
  tabs: {
    create: async () => undefined,
  },
} as any;

