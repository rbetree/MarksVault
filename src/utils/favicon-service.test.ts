import { getDomainFromUrl, getFaviconUrl } from './favicon-service';

describe('favicon-service', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getDomainFromUrl: 正常解析域名', () => {
    expect(getDomainFromUrl('https://example.com/path?x=1')).toBe('example.com');
  });

  test('getDomainFromUrl: 处理无效URL', () => {
    expect(getDomainFromUrl('not a url')).toBe('');
  });

  test('getFaviconUrl: Chromium 使用 _favicon 端点（依赖缓存）', () => {
    const url = 'https://example.com/path?x=1';
    expect(getFaviconUrl(url)).toBe(
      `chrome-extension://__jest__/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`,
    );
  });

  test('getFaviconUrl: 空 URL 返回空字符串', () => {
    expect(getFaviconUrl('')).toBe('');
  });
});
