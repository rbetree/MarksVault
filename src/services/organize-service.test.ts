import organizeService from './organize-service';
import bookmarkService, { BookmarkItem } from '../utils/bookmark-service';

jest.mock('../utils/bookmark-service', () => ({
  __esModule: true,
  default: {
    getAllBookmarks: jest.fn(),
    removeBookmark: jest.fn(),
    updateBookmark: jest.fn(),
  },
}));

describe('organize-service 失败处理', () => {
  const mockedBookmarkService = bookmarkService as jest.Mocked<typeof bookmarkService>;
  const mockedFetch = jest.fn();

  const bookmarkTree: BookmarkItem[] = [
    {
      id: 'folder-1',
      title: 'Folder',
      isFolder: true,
      children: [
        {
          id: 'bookmark-1',
          parentId: 'folder-1',
          title: 'Example',
          url: 'https://example.com',
          isFolder: false,
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).fetch = mockedFetch;
    mockedBookmarkService.getAllBookmarks.mockResolvedValue({
      success: true,
      data: bookmarkTree,
    } as any);
    mockedBookmarkService.removeBookmark.mockResolvedValue({ success: true } as any);
    mockedBookmarkService.updateBookmark.mockResolvedValue({
      success: true,
      data: { id: 'bookmark-1' },
    } as any);
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
    } as any);
  });

  test('delete 分支应识别 removeBookmark 返回的失败结果', async () => {
    mockedBookmarkService.removeBookmark.mockResolvedValue({
      success: false,
      error: 'permission denied',
    } as any);

    const [result] = await organizeService.organizeBookmarks([
      {
        operation: 'delete',
        filters: { pattern: 'example.com' },
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.processedCount).toBe(0);
    expect(result.error).toContain('删除失败');
  });

  test('rename 分支应识别 updateBookmark 返回的失败结果', async () => {
    mockedBookmarkService.updateBookmark.mockResolvedValue({
      success: false,
      error: 'readonly',
    } as any);

    const [result] = await organizeService.organizeBookmarks([
      {
        operation: 'rename',
        newName: '{title}-renamed',
        filters: { pattern: 'example.com' },
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.processedCount).toBe(0);
    expect(result.error).toContain('重命名失败');
  });

  test('tag 分支应识别 updateBookmark 返回的失败结果', async () => {
    mockedBookmarkService.updateBookmark.mockResolvedValue({
      success: false,
      error: 'readonly',
    } as any);

    const [result] = await organizeService.organizeBookmarks([
      {
        operation: 'tag',
        newName: 'Important',
        filters: { pattern: 'example.com' },
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.processedCount).toBe(0);
    expect(result.error).toContain('添加标签失败');
  });

  test('validate 分支应基于真实 HTTP 状态返回失败', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as any);

    const [result] = await organizeService.organizeBookmarks([
      {
        operation: 'validate',
        filters: { pattern: 'example.com' },
      },
    ]);

    expect(result.success).toBe(false);
    expect(result.processedCount).toBe(1);
    expect(result.error).toContain('验证失败');
    expect(result.details).toContain('异常 1 个');
  });

  test('validate 分支在 HEAD 失败时应回退 GET(no-cors)', async () => {
    mockedFetch
      .mockRejectedValueOnce(new Error('HEAD blocked'))
      .mockResolvedValueOnce({
        ok: false,
        status: 0,
      } as any);

    const [result] = await organizeService.organizeBookmarks([
      {
        operation: 'validate',
        filters: { pattern: 'example.com' },
      },
    ]);

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(1);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(mockedFetch.mock.calls[0][1].method).toBe('HEAD');
    expect(mockedFetch.mock.calls[1][1].method).toBe('GET');
  });
});
