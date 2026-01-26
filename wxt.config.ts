import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: (env) => {
    const isFirefox = env.browser === 'firefox';

    return {
      name: 'MarksVault',
      description: '智能管理、整理和安全备份您的书签数据',
      // Firefox 不支持 Chromium 的 `_favicon` 端点，也不需要 `favicon` 权限，避免 AMO 审核噪音
      permissions: ['bookmarks', 'storage', ...(isFirefox ? [] : ['favicon'])],
      host_permissions: ['https://api.github.com/*'],
      action: {
        default_icon: {
          16: 'assets/icons/logo/icon16.png',
          48: 'assets/icons/logo/icon48.png',
          128: 'assets/icons/logo/icon128.png',
        },
      },
      options_page: 'popup.html#settings',
      icons: {
        16: 'assets/icons/logo/icon16.png',
        48: 'assets/icons/logo/icon48.png',
        128: 'assets/icons/logo/icon128.png',
      },
      ...(isFirefox
        ? {}
        : {
            // `_favicon/*` 只在 Chromium 生效
            web_accessible_resources: [
              {
                resources: ['_favicon/*'],
                matches: ['<all_urls>'],
              },
            ],
          }),
    };
  },
});
