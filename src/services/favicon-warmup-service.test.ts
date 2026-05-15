import { warmupBookmarkFavicons } from './favicon-warmup-service';
import bookmarkService, { findBookmarkBar } from '../utils/bookmark-service';
import { getFaviconUrl } from '../utils/favicon-service';
import { browser } from 'wxt/browser';

jest.mock('../utils/bookmark-service', () => ({
  __esModule: true,
  findBookmarkBar: jest.fn(),
  default: {
    getBookmarkRoots: jest.fn(),
    getAllBookmarks: jest.fn(),
  },
}));

jest.mock('../utils/favicon-service', () => ({
  __esModule: true,
  getFaviconUrl: jest.fn(),
}));

describe('favicon-warmup-service', () => {
  const mockedBookmark = bookmarkService as jest.Mocked<typeof bookmarkService>;
  const mockedFindBookmarkBar = findBookmarkBar as jest.MockedFunction<typeof findBookmarkBar>;
  const mockedGetFaviconUrl = getFaviconUrl as jest.MockedFunction<typeof getFaviconUrl>;
  let fetchSpy: jest.SpyInstance | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    const browserAny = browser as any;
    browserAny.tabs.create = jest.fn().mockResolvedValue(undefined);
    browserAny.tabs.update = jest.fn().mockResolvedValue(undefined);
    browserAny.tabs.remove = jest.fn().mockResolvedValue(undefined);
    browserAny.windows.create = jest.fn().mockResolvedValue({ id: 1 });
    browserAny.windows.remove = jest.fn().mockResolvedValue(undefined);

    // 预热流程会 probe `_favicon`，测试中统一 mock 成成功的图片响应
    fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = null;
  });

  test('roots 失败时返回失败结果', async () => {
    mockedBookmark.getBookmarkRoots.mockResolvedValue({ success: false, error: 'boom' } as any);

    const result = await warmupBookmarkFavicons({ scope: 'bookmark_bar' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
    expect(result.failed).toBe(0);
  });

  test('非 Chromium _favicon 时会跳过（attempted=0）', async () => {
    mockedBookmark.getBookmarkRoots.mockResolvedValue({
      success: true,
      data: [
        { id: '1', title: 'Bookmarks Bar', isFolder: true, children: [
          { id: 'b1', title: 'A', isFolder: false, url: 'https://example.com/a' },
          { id: 'b2', title: 'B', isFolder: false, url: 'https://other.com/b' },
        ]},
      ],
    } as any);
    mockedFindBookmarkBar.mockReturnValue({
      id: '1',
      title: 'Bookmarks Bar',
      isFolder: true,
      children: [
        { id: 'b1', title: 'A', isFolder: false, url: 'https://example.com/a' },
        { id: 'b2', title: 'B', isFolder: false, url: 'https://other.com/b' },
      ],
    } as any);

    mockedGetFaviconUrl.mockImplementation((pageUrl: string) => {
      return `https://www.google.com/s2/favicons?domain=${new URL(pageUrl).hostname}&sz=64`;
    });

    const result = await warmupBookmarkFavicons({ scope: 'bookmark_bar', maxDomains: 10 });

    expect(result.success).toBe(true);
    expect(result.attempted).toBe(0);
    expect(result.warmed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(2);
    expect(browser.tabs.create).not.toHaveBeenCalled();
  });

  test('按 URL 去重并后台访问页面以触发预热', async () => {
    mockedBookmark.getBookmarkRoots.mockResolvedValue({
      success: true,
      data: [
        { id: '1', title: 'Bookmarks Bar', isFolder: true, children: [
          { id: 'b1', title: 'A', isFolder: false, url: 'https://example.com/a' },
          { id: 'b2', title: 'B', isFolder: false, url: 'https://example.com/b' },
          { id: 'b3', title: 'C', isFolder: false, url: 'https://other.com/c' },
        ]},
      ],
    } as any);
    mockedFindBookmarkBar.mockReturnValue({
      id: '1',
      title: 'Bookmarks Bar',
      isFolder: true,
      children: [
        { id: 'b1', title: 'A', isFolder: false, url: 'https://example.com/a' },
        { id: 'b2', title: 'B', isFolder: false, url: 'https://example.com/b' },
        { id: 'b3', title: 'C', isFolder: false, url: 'https://other.com/c' },
      ],
    } as any);

    mockedGetFaviconUrl.mockImplementation((pageUrl: string) => {
      return `chrome-extension://__jest__/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
    });

    const createdTabIds: number[] = [];
    ((browser as any).tabs.create as jest.Mock).mockImplementation(async (data: any) => {
      const id = 100 + createdTabIds.length;
      createdTabIds.push(id);
      // 等 listener 注册后再 emit，模拟页面加载完成
      setTimeout(() => (browser.tabs.onUpdated as any)._emit(id, { status: 'complete' }), 0);
      return { id, ...data } as any;
    });

    const result = await warmupBookmarkFavicons({
      scope: 'bookmark_bar',
      maxDomains: 10,
      concurrency: 3,
      timeoutMs: 1000,
      minStayMs: 0,
    });

    expect(result.success).toBe(true);
    // example.com/a + example.com/b + other.com/c
    expect(result.attempted).toBe(3);
    expect(result.warmed).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(browser.tabs.create).toHaveBeenCalledTimes(3);
    expect(browser.tabs.remove).toHaveBeenCalledTimes(3);
    // 过滤阶段与 probe 阶段各会调用一次
    expect(mockedGetFaviconUrl).toHaveBeenCalledTimes(6);
  });
});
