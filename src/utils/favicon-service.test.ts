import { getDomainFromUrl, getFaviconUrl } from './favicon-service';

const FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const CHROMIUM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('favicon-service', () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  const mockUserAgent = (userAgent: string) => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent },
      configurable: true,
    });
  };

  const restoreNavigator = () => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
      return;
    }
    delete (globalThis as { navigator?: Navigator }).navigator;
  };

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreNavigator();
    jest.restoreAllMocks();
  });

  test('getDomainFromUrl: 正常解析域名', () => {
    expect(getDomainFromUrl('https://example.com/path?x=1')).toBe('example.com');
  });

  test('getDomainFromUrl: 处理无效URL', () => {
    expect(getDomainFromUrl('not a url')).toBe('');
  });

  test('getFaviconUrl: Chromium 使用 _favicon 端点（依赖缓存）', () => {
    mockUserAgent(CHROMIUM_UA);

    const url = 'https://example.com/path?x=1';
    const faviconUrl = getFaviconUrl(url);

    expect(faviconUrl).toBe(
      `chrome-extension://__jest__/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`,
    );
    expect(faviconUrl).not.toContain('google.com');
  });

  test('getFaviconUrl: Firefox 返回空字符串，不请求第三方图标服务', () => {
    mockUserAgent(FIREFOX_UA);

    const faviconUrl = getFaviconUrl('https://example.com/path?x=1');

    expect(faviconUrl).toBe('');
    expect(faviconUrl).not.toContain('google.com');
  });

  test('getFaviconUrl: 空 URL 返回空字符串', () => {
    mockUserAgent(CHROMIUM_UA);

    expect(getFaviconUrl('')).toBe('');
  });
});
