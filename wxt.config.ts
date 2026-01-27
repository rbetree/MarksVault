import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: (env) => {
    // 仅开发模式调整依赖预构建（optimizeDeps）。
    //
    // 背景：在 `wxt` dev（Vite dev server）下，Vite 的 deps optimizer 可能会对
    // `@mui/material` 生成错误的预构建产物，导致运行时出现：
    // `Uncaught TypeError: createTheme_default is not a function`，进而使 popup 白屏。
    // 生产构建（wxt build/zip）不受影响，因此这里只对 `serve` 做 workaround。
    if (env.command !== 'serve') return {};

    return {
      resolve: {
        alias: [
          // 强制把 @mui/system 的深路径导入指向 ESM 版本，避免 dev 下把 CJS 当 ESM 加载导致的
          // “does not provide an export named ...” / “dynamic require ... is not supported”等问题。
          { find: /^@mui\/system$/, replacement: '@mui/system/esm' },
          { find: /^@mui\/system\/(.*)$/, replacement: '@mui/system/esm/$1' },

          // 同理，把 icons-material 的深路径导入指向 ESM 版本，避免 CJS 版本内部 require ESM：
          // e.g. `@mui/icons-material/utils/createSvgIcon.js` require('@mui/material/utils')
          { find: /^@mui\/icons-material$/, replacement: '@mui/icons-material/esm' },
          { find: /^@mui\/icons-material\/(.*)$/, replacement: '@mui/icons-material/esm/$1' },
        ],
      },
      optimizeDeps: {
        // 排除：避免 `@mui/material` 在 dev 下被预构建后出现运行时错误
        //（如 createTheme_default 相关报错）。
        exclude: ['@mui/material'],
        // 注意：不要把 `@mui/icons-material` 排除掉；它的 `esm/index.js` 会 re-export
        // 全量图标，若不经预构建可能导致 dev 下瞬间打开大量文件，触发 Windows 的 EMFILE。
        // 强制包含：MUI/Emotion 链路里有 CJS 依赖，若未被扫描到会在浏览器里以 ESM 方式加载失败
        // （例如：hoist-non-react-statics 默认导出缺失）。
        include: ['hoist-non-react-statics', 'react-is', 'prop-types'],
      },
    };
  },
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
