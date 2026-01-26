import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MarksVault',
    description: '智能管理、整理和安全备份您的书签数据',
    permissions: ['bookmarks', 'storage', 'favicon'],
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
    web_accessible_resources: [
      {
        resources: ['_favicon/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
});

