import { preloadFaviconIcons } from './backup-service-favicon';

const FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

describe('backup-service-favicon Firefox 本地回退', () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let fetchSpy: jest.SpyInstance;

  const bookmarks = [
    { id: '1', title: 'A', url: 'https://a.example.com/page', isFolder: false },
    { id: '2', title: 'B', url: 'https://b.example.com/page', isFolder: false },
  ];

  beforeEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: FIREFOX_UA },
      configurable: true,
    });
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
      return;
    }
    delete (globalThis as { navigator?: Navigator }).navigator;
  });

  test('预加载不发起 fetch，返回空图标映射', async () => {
    const faviconMap = await preloadFaviconIcons(bookmarks);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(faviconMap.size).toBe(0);
  });

  test('注入的 fetchIcon 不会被调用，不向第三方发送域名', async () => {
    const fetchIcon = jest.fn(async () => 'data:image/png;base64,AAA');

    const faviconMap = await preloadFaviconIcons(bookmarks, fetchIcon);

    expect(fetchIcon).not.toHaveBeenCalled();
    expect(faviconMap.size).toBe(0);
  });
});
