jest.mock('wxt', () => ({
  defineConfig: (config: unknown) => config,
}));

import wxtConfig from '../../wxt.config';

const BROWSERS = ['chrome', 'edge', 'firefox'] as const;

describe('wxt manifest 权限配置', () => {
  const getManifest = (browser: typeof BROWSERS[number]) => {
    return (wxtConfig as any).manifest({ browser }) as { permissions: string[] };
  };

  test('Chromium 声明 activeTab 且不声明完整 tabs 权限', () => {
    const manifest = getManifest('chrome');

    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).not.toContain('tabs');
  });

  test('Firefox 同样声明 activeTab', () => {
    const manifest = getManifest('firefox');

    expect(manifest.permissions).toContain('activeTab');
  });

  test.each(BROWSERS)('%s manifest 声明通知与定时任务权限，且不引入 tabs', (browser) => {
    const manifest = getManifest(browser);

    expect(manifest.permissions).toContain('notifications');
    expect(manifest.permissions).toContain('alarms');
    expect(manifest.permissions).not.toContain('tabs');
  });
});
