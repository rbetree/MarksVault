// Jest 环境下的 WXT browser mock
// 仅用于单元测试，避免 Jest 无法直接加载 wxt/browser (ESM) 导致的报错。

type Store = Record<string, any>;

const localStore: Store = {};
const syncStore: Store = {};

const createStorageArea = (store: Store) => {
  return {
    get: async (keys?: string | string[] | null) => {
      // 兼容 chrome.storage.*.get(null) -> 全量
      if (keys === null || keys === undefined) {
        return { ...store };
      }

      if (Array.isArray(keys)) {
        const result: Store = {};
        keys.forEach((k) => {
          result[k] = store[k];
        });
        return result;
      }

      return { [keys]: store[keys] };
    },
    set: async (items: Store) => {
      Object.entries(items).forEach(([k, v]) => {
        store[k] = v;
      });
    },
    remove: async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((k) => {
        delete store[k];
      });
    },
    clear: async () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
};

// 简化版事件系统（足够让 add/removeListener 不报错）
const createOnChanged = () => {
  const listeners = new Set<any>();
  return {
    addListener: (listener: any) => listeners.add(listener),
    removeListener: (listener: any) => listeners.delete(listener),
    // 测试中一般不需要触发；保留以便扩展
    _emit: (changes: any, areaName: string) => {
      listeners.forEach((fn) => fn(changes, areaName));
    },
  };
};

export const browser = {
  runtime: {
    getURL: (path: string) => `chrome-extension://__jest__${path}`,
  },
  storage: {
    local: createStorageArea(localStore),
    sync: createStorageArea(syncStore),
    onChanged: createOnChanged(),
  },
  tabs: {
    create: async () => undefined,
  },
  bookmarks: {
    getTree: async () => [],
    getChildren: async () => [],
    getSubTree: async () => [],
    get: async () => [],
    create: async () => ({ id: '0', title: '', url: '' }),
    update: async () => ({ id: '0', title: '', url: '' }),
    remove: async () => undefined,
    move: async () => ({ id: '0' }),
  },
} as any;

