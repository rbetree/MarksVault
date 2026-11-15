import backupService from './backup-service';
import githubService, { GitHubApiError } from './github-service';
import storageService from '../utils/storage-service';
import bookmarkService from '../utils/bookmark-service';
import { getFaviconUrl } from '../utils/favicon-service';
import { browser } from 'wxt/browser';
import { BackupType } from './backup-service-config';
import {
  buildPushFilePath,
  buildTimestampedBackupFilePath,
  isTimestampedBookmarksBackupFile,
  parseBackupTimestamp,
  parseBookmarksBackupTimestamp,
  parseSettingsBackupTimestamp,
  resolveBookmarksRestoreFilePath,
  resolveLatestBookmarksBackupFilePath,
  resolveSettingsRestoreFilePath
} from './backup-service-paths';
import { preloadFaviconIcons } from './backup-service-favicon';
import { createHtmlBookmarkData } from './backup-service-html';

jest.mock('./github-service', () => ({
  __esModule: true,
  default: {
    repoExists: jest.fn(),
    getRepositoryFiles: jest.fn(),
    getFileContent: jest.fn(),
    createRepo: jest.fn(),
    createOrUpdateFile: jest.fn(),
    deleteFile: jest.fn(),
    validateCredentials: jest.fn(),
  },
  // 测试中的错误均为普通错误（配置/文件错误），结构化判定返回不可重试
  isRetryableGitHubError: jest.fn(() => false),
  GitHubApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'GitHubApiError';
      this.status = status;
    }
  },
  RetryableError: class extends Error {
    category: string;
    constructor(category: string, message: string) {
      super(message);
      this.name = 'RetryableError';
      this.category = category;
    }
  },
}));

jest.mock('../utils/storage-service', () => ({
  __esModule: true,
  default: {
    saveBackupStatus: jest.fn(),
    getBackupStatus: jest.fn(),
    setStorageData: jest.fn(),
    getStorageData: jest.fn(),
    getSettings: jest.fn(),
    getGitHubCredentials: jest.fn(),
    getBackupStatsCache: jest.fn(),
    saveBackupStatsCache: jest.fn(),
    isBackupStatsCacheValid: jest.fn(),
    exportConfig: jest.fn(),
    importConfig: jest.fn(),
    saveSettings: jest.fn(),
  },
}));

// 图标 URL 由各用例按需设置；默认返回空串，避免 HTML 生成用例触发真实网络抓取
jest.mock('../utils/favicon-service', () => ({
  __esModule: true,
  getFaviconUrl: jest.fn(),
}));

jest.mock('../utils/bookmark-service', () => ({
  __esModule: true,
  isBookmarkBarNode: jest.fn((item: { id: string; title: string }) => {
    const normalizedId = item.id.toLowerCase();
    if (normalizedId === '1' || normalizedId.startsWith('toolbar')) {
      return true;
    }
    const normalizedTitle = item.title.trim().toLowerCase();
    return ['书签栏', '書籤列', 'bookmarks bar', 'bookmark bar', 'bookmarks toolbar', 'bookmark toolbar']
      .includes(normalizedTitle);
  }),
  findBookmarkBar: jest.fn((roots: Array<{ id: string; title: string; isFolder?: boolean }>) => {
    if (!Array.isArray(roots) || roots.length === 0) {
      return undefined;
    }
    return roots.find(root => {
      const normalizedId = root.id.toLowerCase();
      const normalizedTitle = root.title.trim().toLowerCase();
      return normalizedId === '1'
        || normalizedId.startsWith('toolbar')
        || ['书签栏', '書籤列', 'bookmarks bar', 'bookmark bar', 'bookmarks toolbar', 'bookmark toolbar']
          .includes(normalizedTitle);
    }) ?? roots.find(root => root.isFolder) ?? roots[0];
  }),
  default: {
    getBookmarkRoots: jest.fn(),
    getAllBookmarks: jest.fn(),
    removeBookmarkTree: jest.fn(),
    createFolder: jest.fn(),
    createBookmark: jest.fn(),
  },
}));

describe('backup-service 恢复路径选择', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;
  const mockedBookmark = bookmarkService as jest.Mocked<typeof bookmarkService>;
  const credentials = { token: 'test-token' };
  const username = 'alice';

  const backupFileContent = JSON.stringify({
    timestamp: 1735600000000,
    metadata: {
      totalBookmarks: 1,
    },
    bookmarks: [
      {
        id: '0',
        title: 'root',
        isFolder: true,
        children: [
          {
            id: '1',
            title: 'Bookmarks Bar',
            isFolder: true,
            children: [
              {
                id: '2',
                title: 'Example',
                url: 'https://example.com',
                isFolder: false,
              },
            ],
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGitHub.repoExists.mockResolvedValue(true);
    mockedStorage.saveBackupStatus.mockResolvedValue({ success: true });
    mockedStorage.setStorageData.mockResolvedValue({ success: true } as any);
    mockedBookmark.getBookmarkRoots.mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          isFolder: true,
          children: [
            {
              id: 'old-1',
              title: 'Old Bookmark',
              url: 'https://old.example.com',
              isFolder: false,
            },
          ],
        },
      ],
    } as any);
    mockedBookmark.removeBookmarkTree.mockResolvedValue({ success: true } as any);
    mockedBookmark.createFolder.mockResolvedValue({
      success: true,
      data: { id: 'folder-created' },
    } as any);
    mockedBookmark.createBookmark.mockResolvedValue({
      success: true,
      data: { id: 'bookmark-created' },
    } as any);
  });

  test('默认恢复会优先选择最新时间戳备份文件', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'bookmarks_backup_20240101010101.json',
        path: 'bookmarks/bookmarks_backup_20240101010101.json',
      } as any,
      {
        name: 'bookmarks_backup_20250202020202.json',
        path: 'bookmarks/bookmarks_backup_20250202020202.json',
      } as any,
    ]);
    mockedGitHub.getFileContent.mockRejectedValue(new Error('stop-here'));

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(mockedGitHub.getFileContent).toHaveBeenCalledWith(
      credentials,
      username,
      'marksvault-backups',
      'bookmarks/bookmarks_backup_20250202020202.json'
    );
  });

  test('当没有时间戳备份时，兼容回退到 latest 文件', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'bookmarks_backup_latest.json',
        path: 'bookmarks/bookmarks_backup_latest.json',
      } as any,
    ]);
    mockedGitHub.getFileContent.mockRejectedValue(new Error('stop-here'));

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(mockedGitHub.getFileContent).toHaveBeenCalledWith(
      credentials,
      username,
      'marksvault-backups',
      'bookmarks/bookmarks_backup_latest.json'
    );
  });

  test('当不存在可恢复文件时，返回明确错误', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([]);

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.error).toContain('未找到可恢复的书签备份文件');
    expect(mockedGitHub.getFileContent).not.toHaveBeenCalled();
  });

  test('仓库或 bookmarks 目录不存在（404）时返回未找到可恢复备份，而非文件列表失败', async () => {
    mockedGitHub.getRepositoryFiles.mockRejectedValue(
      new GitHubApiError(404, '获取仓库文件列表失败: 404 - Not Found')
    );

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.error).toContain('未找到可恢复的书签备份文件');
    expect(result.error).not.toContain('获取仓库文件列表失败');
    expect(mockedGitHub.getFileContent).not.toHaveBeenCalled();
  });

  test('文件列表的非 404 错误保持原始错误信息', async () => {
    mockedGitHub.getRepositoryFiles.mockRejectedValue(new Error('network down'));

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.error).toContain('network down');
    expect(result.error).not.toContain('未找到可恢复的书签备份文件');
  });

  test('删除旧书签失败时应中断恢复并返回失败', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'bookmarks_backup_20250202020202.json',
        path: 'bookmarks/bookmarks_backup_20250202020202.json',
      } as any,
    ]);
    mockedGitHub.getFileContent.mockResolvedValue({ content: backupFileContent } as any);
    mockedBookmark.removeBookmarkTree.mockResolvedValue({
      success: false,
      error: 'permission denied',
    } as any);

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.error).toContain('删除现有书签失败');
    expect(mockedBookmark.createBookmark).not.toHaveBeenCalled();
  });

  test('创建新书签失败时应中断恢复并返回失败', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'bookmarks_backup_20250202020202.json',
        path: 'bookmarks/bookmarks_backup_20250202020202.json',
      } as any,
    ]);
    mockedGitHub.getFileContent.mockResolvedValue({ content: backupFileContent } as any);
    mockedBookmark.createBookmark.mockResolvedValue({
      success: false,
      error: 'invalid url',
    } as any);

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.error).toContain('创建书签失败');
  });

  test('Firefox 书签栏ID（toolbar前缀）应能被正确识别', async () => {
    const firefoxBackupContent = JSON.stringify({
      timestamp: 1735600000000,
      metadata: {
        totalBookmarks: 1,
      },
      bookmarks: [
        {
          id: 'root________',
          title: '',
          isFolder: true,
          children: [
            {
              id: 'toolbar_____',
              title: 'Bookmarks Toolbar',
              isFolder: true,
              children: [
                {
                  id: '2',
                  title: 'Example',
                  url: 'https://example.com',
                  isFolder: false,
                },
              ],
            },
          ],
        },
      ],
    });

    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'bookmarks_backup_20250202020202.json',
        path: 'bookmarks/bookmarks_backup_20250202020202.json',
      } as any,
    ]);
    mockedGitHub.getFileContent.mockResolvedValue({ content: firefoxBackupContent } as any);
    mockedBookmark.getBookmarkRoots.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'toolbar_____',
          title: 'Bookmarks Toolbar',
          isFolder: true,
          children: [],
        },
      ],
    } as any);

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(true);
    expect(mockedBookmark.createBookmark).toHaveBeenCalledWith({
      parentId: 'toolbar_____',
      title: 'Example',
      url: 'https://example.com',
    });
  });
});

describe('backup-service restore 前置校验与暂存保护', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;
  const mockedBookmark = bookmarkService as jest.Mocked<typeof bookmarkService>;
  const credentials = { token: 'test-token' };
  const username = 'alice';

  // 构造备份内容：bookmarks[0].children[0] 为书签栏，其 children 为待恢复数据
  const buildBackupContent = (barChildren: any[]): string => JSON.stringify({
    timestamp: 1735600000000,
    metadata: { totalBookmarks: 1 },
    bookmarks: [
      {
        id: '0',
        title: 'root',
        isFolder: true,
        children: [
          { id: '1', title: 'Bookmarks Bar', isFolder: true, children: barChildren },
        ],
      },
    ],
  });

  // 构造嵌套链：leaf 被 depth 层文件夹包裹
  const buildDeepNestedNode = (depth: number): any => {
    let node: any = { id: 'leaf', title: 'Leaf', url: 'https://example.com', isFolder: false };
    for (let i = 0; i < depth; i++) {
      node = { id: `folder-${i}`, title: `Folder ${i}`, isFolder: true, children: [node] };
    }
    return node;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGitHub.repoExists.mockResolvedValue(true);
    mockedStorage.saveBackupStatus.mockResolvedValue({ success: true });
    mockedStorage.setStorageData.mockResolvedValue({ success: true } as any);
    mockedBookmark.getBookmarkRoots.mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          title: 'Bookmarks Bar',
          isFolder: true,
          children: [
            {
              id: 'old-1',
              title: 'Old Bookmark',
              url: 'https://old.example.com',
              isFolder: false,
            },
          ],
        },
      ],
    } as any);
    mockedBookmark.removeBookmarkTree.mockResolvedValue({ success: true } as any);
    mockedBookmark.createFolder.mockResolvedValue({
      success: true,
      data: { id: 'folder-created' },
    } as any);
    mockedBookmark.createBookmark.mockResolvedValue({
      success: true,
      data: { id: 'bookmark-created' },
    } as any);
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'bookmarks_backup_20250202020202.json',
        path: 'bookmarks/bookmarks_backup_20250202020202.json',
      } as any,
    ]);
  });

  test('嵌套层级过深的备份应在任何删除/暂存前被拒绝', async () => {
    mockedGitHub.getFileContent.mockResolvedValue({
      content: buildBackupContent([buildDeepNestedNode(101)]),
    } as any);

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('嵌套层级过深');
    expect(mockedBookmark.removeBookmarkTree).not.toHaveBeenCalled();
    expect(mockedStorage.setStorageData).not.toHaveBeenCalled();
  });

  test('节点数超过上限的备份应在任何删除/暂存前被拒绝', async () => {
    const manyItems = Array.from({ length: 5001 }, (_, i) => ({
      id: `b-${i}`,
      title: `B ${i}`,
      url: 'https://example.com',
      isFolder: false,
    }));
    mockedGitHub.getFileContent.mockResolvedValue({
      content: buildBackupContent(manyItems),
    } as any);

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('备份文件过大');
    expect(mockedBookmark.removeBookmarkTree).not.toHaveBeenCalled();
    expect(mockedStorage.setStorageData).not.toHaveBeenCalled();
  });

  test('暂存现有书签失败时应拒绝恢复，不进入删除阶段', async () => {
    mockedGitHub.getFileContent.mockResolvedValue({
      content: buildBackupContent([
        { id: '2', title: 'Example', url: 'https://example.com', isFolder: false },
      ]),
    } as any);
    mockedStorage.setStorageData.mockResolvedValue({
      success: false,
      error: 'quota exceeded',
    } as any);

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('暂存现有书签失败');
    expect(mockedBookmark.removeBookmarkTree).not.toHaveBeenCalled();
  });

  test('恢复成功前应暂存现有书签树，成功后清理暂存键', async () => {
    mockedGitHub.getFileContent.mockResolvedValue({
      content: buildBackupContent([
        { id: '2', title: 'Example', url: 'https://example.com', isFolder: false },
      ]),
    } as any);
    const removeSpy = jest.spyOn(browser.storage.local, 'remove');

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(true);
    // 暂存：写入序列化后的书签栏树（含现有旧书签）
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'pending_restore_backup',
      expect.stringContaining('old-1')
    );
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'pending_restore_backup',
      expect.stringContaining('Old Bookmark')
    );
    // 成功后清理暂存键
    expect(removeSpy).toHaveBeenCalledWith('pending_restore_backup');
    removeSpy.mockRestore();
  });

  test('恢复中途失败时应保留暂存数据（不清理）', async () => {
    mockedGitHub.getFileContent.mockResolvedValue({
      content: buildBackupContent([
        { id: '2', title: 'Example', url: 'https://example.com', isFolder: false },
      ]),
    } as any);
    mockedBookmark.createBookmark.mockResolvedValue({
      success: false,
      error: 'invalid url',
    } as any);
    const removeSpy = jest.spyOn(browser.storage.local, 'remove');

    const result = await backupService.restoreFromGitHub(credentials, username);

    expect(result.success).toBe(false);
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'pending_restore_backup',
      expect.any(String)
    );
    // 失败路径不清理暂存数据，供未来回滚
    expect(removeSpy).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});

describe('backup-service 备份文件命名与解析', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const credentials = { token: 'test-token' };
  const username = 'alice';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('按备份类型与当前时间生成带时间戳的文件路径', () => {
    const now = new Date(2024, 0, 2, 3, 4, 5);

    expect(buildTimestampedBackupFilePath(BackupType.BOOKMARKS, now)).toEqual({
      filePath: 'bookmarks/bookmarks_backup_20240102030405.json',
      description: '书签',
    });
    expect(buildTimestampedBackupFilePath(BackupType.SETTINGS, now)).toEqual({
      filePath: 'settings/settings_backup_20240102030405.json',
      description: '配置',
    });
  });

  test('推送文件路径按日期生成，空文件夹时不加前缀', () => {
    const now = new Date(2024, 0, 2);

    expect(buildPushFilePath('bookmarks', now)).toBe('bookmarks/bookmarks_20240102.html');
    expect(buildPushFilePath('', now)).toBe('bookmarks_20240102.html');
  });

  test('解析书签、配置与通用备份文件名中的时间戳', () => {
    const expected = new Date(2024, 0, 2, 3, 4, 5).getTime();

    expect(parseBookmarksBackupTimestamp('bookmarks_backup_20240102030405.json')).toBe(expected);
    expect(parseSettingsBackupTimestamp('settings_backup_20240102030405.json')).toBe(expected);
    expect(parseBackupTimestamp('bookmarks_backup_20240102030405.json')).toBe(expected);
    expect(parseBackupTimestamp('settings_backup_20240102030405.json')).toBe(expected);
  });

  test('非备份文件名返回 0', () => {
    expect(parseBookmarksBackupTimestamp('bookmarks_backup_latest.json')).toBe(0);
    expect(parseSettingsBackupTimestamp('settings.json')).toBe(0);
    expect(parseBackupTimestamp('bookmarks_20240102.html')).toBe(0);
  });

  test('正则匹配但日期非法时按最旧处理', () => {
    expect(parseBookmarksBackupTimestamp('bookmarks_backup_20241301120000.json')).toBe(0);
    expect(parseSettingsBackupTimestamp('settings_backup_20241301120000.json')).toBe(0);
    expect(parseBackupTimestamp('bookmarks_backup_20241301120000.json')).toBe(0);
    expect(isTimestampedBookmarksBackupFile('bookmarks_backup_20241301120000.json')).toBe(false);
  });

  test('latest 文件不算带时间戳备份', () => {
    expect(isTimestampedBookmarksBackupFile('bookmarks_backup_20240102030405.json')).toBe(true);
    expect(isTimestampedBookmarksBackupFile('bookmarks_backup_latest.json')).toBe(false);
  });

  test('恢复文件路径统一补齐类型文件夹前缀', () => {
    const settingsName = 'settings_backup_20240102030405.json';
    const bookmarksName = 'bookmarks_backup_20240102030405.json';

    expect(resolveSettingsRestoreFilePath(settingsName)).toBe(`settings/${settingsName}`);
    expect(resolveSettingsRestoreFilePath(`settings/${settingsName}`)).toBe(`settings/${settingsName}`);
    expect(resolveBookmarksRestoreFilePath(bookmarksName)).toBe(`bookmarks/${bookmarksName}`);
    expect(resolveBookmarksRestoreFilePath(`bookmarks/${bookmarksName}`)).toBe(`bookmarks/${bookmarksName}`);
  });

  test('选择最新书签备份时忽略非法日期文件，并兼容回退 latest', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      { name: 'bookmarks_backup_20241301120000.json', path: 'bookmarks/bad.json' },
      { name: 'bookmarks_backup_20240101010101.json', path: 'bookmarks/valid.json' },
    ] as any);

    await expect(resolveLatestBookmarksBackupFilePath(credentials, username))
      .resolves.toBe('bookmarks/valid.json');

    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      { name: 'bookmarks_backup_latest.json', path: 'bookmarks/bookmarks_backup_latest.json' },
      { name: 'bookmarks_backup_20241301120000.json', path: 'bookmarks/bad.json' },
    ] as any);

    await expect(resolveLatestBookmarksBackupFilePath(credentials, username))
      .resolves.toBe('bookmarks/bookmarks_backup_latest.json');
  });

  test('仓库或书签目录不存在（404）时返回未找到可恢复备份', async () => {
    mockedGitHub.getRepositoryFiles.mockRejectedValue(
      new GitHubApiError(404, '获取仓库文件列表失败: 404 - Not Found')
    );

    await expect(resolveLatestBookmarksBackupFilePath(credentials, username))
      .rejects.toThrow('未找到可恢复的书签备份文件');
  });
});

describe('backup-service 清理阈值与回退文件保护', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;
  const credentials = { token: 'test-token' };
  const username = 'alice';

  const buildFile = (name: string, sha = `sha-${name}`) => ({
    name,
    path: `bookmarks/${name}`,
    sha,
    size: 1,
    url: `https://api.github.com/${name}`,
    download_url: `https://raw.example.com/${name}`,
    type: 'file',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.getSettings.mockResolvedValue({
      success: true,
      data: { backup: { maxBackupsPerType: 2 } },
    } as any);
    mockedStorage.getBackupStatsCache.mockResolvedValue({ success: true, data: null } as any);
    mockedStorage.saveBackupStatsCache.mockResolvedValue({ success: true } as any);
    mockedStorage.isBackupStatsCacheValid.mockReturnValue(false);
    mockedGitHub.deleteFile.mockResolvedValue({} as any);
    mockedGitHub.getRepositoryFiles.mockResolvedValue([] as any);
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify({ metadata: {} }),
    } as any);
  });

  test('备份数量等于上限时不删除', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20240101010101.json'),
      buildFile('bookmarks_backup_20240202020202.json'),
    ] as any);

    const result = await backupService.cleanupOldBackups(credentials, username);

    expect(result).toEqual({ success: true, deletedCount: 0 });
    expect(mockedGitHub.deleteFile).not.toHaveBeenCalled();
  });

  test('备份数量超过上限时删除最旧文件', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20240101010101.json', 'sha-old'),
      buildFile('bookmarks_backup_20240202020202.json', 'sha-mid'),
      buildFile('bookmarks_backup_20240303030303.json', 'sha-new'),
    ] as any);

    const result = await backupService.cleanupOldBackups(credentials, username);

    expect(result).toEqual({ success: true, deletedCount: 1 });
    expect(mockedGitHub.deleteFile).toHaveBeenCalledWith(
      credentials,
      username,
      'marksvault-backups',
      'bookmarks/bookmarks_backup_20240101010101.json',
      expect.stringContaining('清理'),
      'sha-old'
    );
  });

  test('latest 回退文件不参与上限计数，也不会被删除', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20240101010101.json'),
      buildFile('bookmarks_backup_20240202020202.json'),
      buildFile('bookmarks_backup_latest.json'),
    ] as any);

    const result = await backupService.cleanupOldBackups(credentials, username);

    expect(result).toEqual({ success: true, deletedCount: 0 });
    expect(mockedGitHub.deleteFile).not.toHaveBeenCalled();
  });

  test('超过上限删除时仍保留 latest 回退文件', async () => {
    mockedStorage.getSettings.mockResolvedValue({
      success: true,
      data: { backup: { maxBackupsPerType: 1 } },
    } as any);
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20240101010101.json'),
      buildFile('bookmarks_backup_20240202020202.json'),
      buildFile('bookmarks_backup_latest.json'),
    ] as any);

    const result = await backupService.cleanupOldBackups(credentials, username);

    expect(result).toEqual({ success: true, deletedCount: 1 });
    const deletedPaths = mockedGitHub.deleteFile.mock.calls.map(call => call[3]);
    expect(deletedPaths).toEqual(['bookmarks/bookmarks_backup_20240101010101.json']);
  });

  test('非法日期的备份文件按最旧优先删除', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20241301120000.json'),
      buildFile('bookmarks_backup_20240202020202.json'),
      buildFile('bookmarks_backup_20240101010101.json'),
    ] as any);

    const result = await backupService.cleanupOldBackups(credentials, username);

    expect(result).toEqual({ success: true, deletedCount: 1 });
    const deletedPaths = mockedGitHub.deleteFile.mock.calls.map(call => call[3]);
    expect(deletedPaths).toEqual(['bookmarks/bookmarks_backup_20241301120000.json']);
  });

  test('未设置上限时不拉取文件列表', async () => {
    mockedStorage.getSettings.mockResolvedValue({
      success: true,
      data: { backup: { maxBackupsPerType: 0 } },
    } as any);

    const result = await backupService.cleanupOldBackups(credentials, username);

    expect(result).toEqual({ success: true, deletedCount: 0 });
    expect(mockedGitHub.getRepositoryFiles).not.toHaveBeenCalled();
  });

  test('获取文件列表失败时返回清理失败', async () => {
    mockedGitHub.getRepositoryFiles.mockRejectedValue(new Error('network down'));

    const result = await backupService.cleanupOldBackups(credentials, username);

    expect(result.success).toBe(false);
    expect(result.error).toContain('清理失败');
  });
});

describe('backup-service 统计缓存', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;
  const credentials = { token: 'test-token' };
  const username = 'alice';

  const buildFile = (name: string, size: number) => ({
    name,
    path: `bookmarks/${name}`,
    sha: `sha-${name}`,
    size,
    url: `https://api.github.com/${name}`,
    download_url: `https://raw.example.com/${name}`,
    type: 'file',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.getBackupStatsCache.mockResolvedValue({ success: true, data: null } as any);
    mockedStorage.isBackupStatsCacheValid.mockReturnValue(false);
    mockedStorage.saveBackupStatsCache.mockResolvedValue({ success: true } as any);
    mockedGitHub.getRepositoryFiles.mockResolvedValue([] as any);
  });

  test('缓存有效时直接返回缓存并标记 isFromCache', async () => {
    mockedStorage.getBackupStatsCache.mockResolvedValue({
      success: true,
      data: {
        data: { totalBackups: 4, totalBookmarks: 20 },
        timestamp: Date.now(),
      },
    } as any);
    mockedStorage.isBackupStatsCacheValid.mockReturnValue(true);

    const stats = await backupService.getBackupStats(credentials, username);

    expect(stats).toEqual({ totalBackups: 4, totalBookmarks: 20, isFromCache: true });
    expect(mockedGitHub.getRepositoryFiles).not.toHaveBeenCalled();
    expect(mockedStorage.saveBackupStatsCache).not.toHaveBeenCalled();
  });

  test('缓存过期时重新从 GitHub 统计并写回缓存', async () => {
    mockedStorage.getBackupStatsCache.mockResolvedValue({
      success: true,
      data: {
        data: { totalBackups: 99 },
        timestamp: Date.now() - 11 * 60 * 1000,
      },
    } as any);
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20240101010101.json', 100),
      buildFile('bookmarks_backup_20240202020202.json', 200),
    ] as any);
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify({ metadata: { totalBookmarks: 12, totalFolders: 3 } }),
    } as any);

    const stats = await backupService.getBackupStats(credentials, username);

    expect(stats.totalBackups).toBe(2);
    expect(stats.firstBackupTime).toBe(new Date(2024, 0, 1, 1, 1, 1).getTime());
    expect(stats.totalBookmarks).toBe(12);
    expect(stats.totalFolders).toBe(3);
    expect(stats.fileSize).toBe(200);
    expect(stats.isFromCache).toBeUndefined();
    expect(mockedStorage.saveBackupStatsCache).toHaveBeenCalledWith({
      totalBackups: 2,
      firstBackupTime: new Date(2024, 0, 1, 1, 1, 1).getTime(),
      totalBookmarks: 12,
      totalFolders: 3,
      fileSize: 200,
    });
  });

  test('forceRefresh 忽略有效缓存并重新统计', async () => {
    mockedStorage.getBackupStatsCache.mockResolvedValue({
      success: true,
      data: {
        data: { totalBackups: 99 },
        timestamp: Date.now(),
      },
    } as any);
    mockedStorage.isBackupStatsCacheValid.mockReturnValue(true);
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20240101010101.json', 100),
    ] as any);
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify({ metadata: { totalBookmarks: 1, totalFolders: 0 } }),
    } as any);

    const stats = await backupService.getBackupStats(credentials, username, true);

    expect(mockedGitHub.getRepositoryFiles).toHaveBeenCalledTimes(1);
    expect(stats.totalBackups).toBe(1);
    expect(stats.isFromCache).toBeUndefined();
    expect(mockedStorage.saveBackupStatsCache).toHaveBeenCalledWith(expect.objectContaining({
      totalBackups: 1,
      totalBookmarks: 1,
    }));
  });

  test('仅有 latest 回退文件时统计为 1 个备份（与恢复对话框一致）', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_latest.json', 300),
    ] as any);
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify({ metadata: { totalBookmarks: 5, totalFolders: 1 } }),
    } as any);

    const stats = await backupService.getBackupStats(credentials, username);

    expect(stats.totalBackups).toBe(1);
    expect(stats.firstBackupTime).toBeUndefined();
    expect(stats.fileSize).toBe(300);
    expect(stats.totalBookmarks).toBe(5);
    expect(stats.totalFolders).toBe(1);
    expect(mockedStorage.saveBackupStatsCache).toHaveBeenCalledWith(expect.objectContaining({
      totalBackups: 1,
    }));
  });

  test('时间戳备份与 latest 混合时统计为 N+1 个备份', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      buildFile('bookmarks_backup_20240101010101.json', 100),
      buildFile('bookmarks_backup_20240202020202.json', 200),
      buildFile('bookmarks_backup_latest.json', 300),
    ] as any);
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify({ metadata: { totalBookmarks: 12, totalFolders: 3 } }),
    } as any);

    const stats = await backupService.getBackupStats(credentials, username);

    expect(stats.totalBackups).toBe(3);
    expect(stats.firstBackupTime).toBe(new Date(2024, 0, 1, 1, 1, 1).getTime());
    // latest 不参与“最新时间戳备份”的选择，文件大小仍取自最新时间戳备份
    expect(stats.fileSize).toBe(200);
    expect(mockedStorage.saveBackupStatsCache).toHaveBeenCalledWith(expect.objectContaining({
      totalBackups: 3,
      firstBackupTime: new Date(2024, 0, 1, 1, 1, 1).getTime(),
      fileSize: 200,
    }));
  });
});

describe('backup-service 配置备份与恢复', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;
  const credentials = { token: 'test-token' };
  const username = 'alice';
  const fileUrl = 'https://github.com/alice/marksvault-backups/blob/main/settings/backup.json';

  const configBackup = {
    schemaVersion: 1,
    app: 'MarksVault',
    extensionVersion: '1.5.1',
    exportedAt: '2024-01-01T00:00:00.000Z',
    local: { settings: { syncEnabled: true } },
    sync: {},
    timestamp: 1735600000000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGitHub.repoExists.mockResolvedValue(true);
    mockedGitHub.createOrUpdateFile.mockResolvedValue({ content: { html_url: fileUrl } } as any);
    mockedStorage.setStorageData.mockResolvedValue({ success: true } as any);
    mockedStorage.getStorageData.mockResolvedValue({ success: true, data: {} } as any);
    mockedStorage.saveBackupStatus.mockResolvedValue({ success: true } as any);
    mockedStorage.exportConfig.mockResolvedValue({ success: true, data: configBackup } as any);
    mockedStorage.importConfig.mockResolvedValue({ success: true } as any);
    mockedStorage.saveSettings.mockResolvedValue({ success: true } as any);
    // 清理流程无法读取设置时直接跳过，避免影响备份结果断言
    mockedStorage.getSettings.mockResolvedValue({ success: false } as any);
  });

  test('配置备份成功时上传配置快照并保存状态', async () => {
    const result = await backupService.backupToGitHub(credentials, username, BackupType.SETTINGS);

    expect(result.success).toBe(true);
    expect(result.data.fileUrl).toBe(fileUrl);
    expect(result.data.timestamp).toBe(configBackup.timestamp);
    expect(result.data.filePath).toMatch(/^settings\/settings_backup_\d{14}\.json$/);
    expect(mockedGitHub.createOrUpdateFile).toHaveBeenCalledWith(
      credentials,
      username,
      'marksvault-backups',
      result.data.filePath,
      JSON.stringify(configBackup, null, 2),
      expect.stringContaining('添加配置备份')
    );
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'settings_backup_status',
      expect.objectContaining({
        lastBackupFilePath: result.data.filePath,
        backupFileUrl: fileUrl,
        lastOperationStatus: 'success',
      })
    );
  });

  test('配置导出失败时返回失败并保存失败状态', async () => {
    mockedStorage.exportConfig.mockResolvedValue({ success: false, error: 'export boom' } as any);

    const result = await backupService.backupToGitHub(credentials, username, BackupType.SETTINGS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('导出配置失败');
    expect(mockedGitHub.createOrUpdateFile).not.toHaveBeenCalled();
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'settings_backup_status',
      expect.objectContaining({
        lastOperationStatus: 'failed',
        errorMessage: expect.stringContaining('导出配置失败'),
      })
    );
  });

  test('上传备份失败时返回失败与可重试标记', async () => {
    mockedGitHub.createOrUpdateFile.mockRejectedValue(new Error('network down'));

    const result = await backupService.backupToGitHub(credentials, username, BackupType.SETTINGS);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('备份失败: network down');
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'settings_backup_status',
      expect.objectContaining({
        lastOperationStatus: 'failed',
        errorMessage: 'network down',
      })
    );
  });

  test('配置备份失败时合并写入状态，保留上次成功的备份时间与文件链接', async () => {
    const previousStatus = {
      lastBackupTime: 1735600000000,
      backupFileUrl: 'https://github.com/alice/marksvault-backups/blob/main/settings/old.json',
      lastBackupFilePath: 'settings/settings_backup_20240101010101.json',
      lastOperationStatus: 'success',
      stats: { totalBackups: 2 },
    };
    mockedStorage.getStorageData.mockResolvedValue({
      success: true,
      data: previousStatus,
    } as any);
    mockedGitHub.createOrUpdateFile.mockRejectedValue(new Error('network down'));

    const result = await backupService.backupToGitHub(credentials, username, BackupType.SETTINGS);

    expect(result.success).toBe(false);
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'settings_backup_status',
      {
        ...previousStatus,
        lastOperationStatus: 'failed',
        errorMessage: 'network down',
      }
    );
  });

  test('读取配置备份状态失败时不写入，避免覆盖上次成功记录', async () => {
    mockedStorage.getStorageData.mockResolvedValue({
      success: false,
      error: 'storage down',
    } as any);
    mockedGitHub.createOrUpdateFile.mockRejectedValue(new Error('network down'));

    const result = await backupService.backupToGitHub(credentials, username, BackupType.SETTINGS);

    expect(result.success).toBe(false);
    expect(mockedStorage.setStorageData).not.toHaveBeenCalledWith(
      'settings_backup_status',
      expect.anything()
    );
  });

  test('配置恢复成功时导入配置并保存成功状态', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'settings_backup_20240101010101.json',
        path: 'settings/settings_backup_20240101010101.json',
      },
    ] as any);
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify(configBackup),
    } as any);

    const result = await backupService.restoreFromGitHub(
      credentials,
      username,
      false,
      undefined,
      BackupType.SETTINGS
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      timestamp: configBackup.timestamp,
      filePath: 'settings/settings_backup_20240101010101.json',
    });
    expect(result.timestamp).toBe(configBackup.timestamp);
    expect(mockedStorage.importConfig).toHaveBeenCalledWith(
      expect.objectContaining({ schemaVersion: 1, app: 'MarksVault' }),
      { importLocalStorage: false }
    );
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'settings_backup_status',
      expect.objectContaining({ lastOperationStatus: 'success' })
    );
  });

  test('指定裸配置备份文件名时补齐 settings 前缀', async () => {
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify(configBackup),
    } as any);

    const result = await backupService.restoreFromGitHub(
      credentials,
      username,
      true,
      'settings_backup_20240101010101.json',
      BackupType.SETTINGS
    );

    expect(result.success).toBe(true);
    expect(mockedGitHub.getFileContent).toHaveBeenCalledWith(
      credentials,
      username,
      'marksvault-backups',
      'settings/settings_backup_20240101010101.json'
    );
  });

  test('导入配置失败时返回失败并保存失败状态', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'settings_backup_20240101010101.json',
        path: 'settings/settings_backup_20240101010101.json',
      },
    ] as any);
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify(configBackup),
    } as any);
    mockedStorage.importConfig.mockResolvedValue({
      success: false,
      error: 'invalid config',
    } as any);

    const result = await backupService.restoreFromGitHub(
      credentials,
      username,
      false,
      undefined,
      BackupType.SETTINGS
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('导入配置失败: invalid config');
    expect(mockedStorage.setStorageData).toHaveBeenCalledWith(
      'settings_backup_status',
      expect.objectContaining({ lastOperationStatus: 'failed' })
    );
  });

  test('不存在配置备份文件时返回准确错误，而非文件列表错误', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      { name: 'README.md', path: 'settings/README.md' },
    ] as any);

    const result = await backupService.restoreFromGitHub(
      credentials,
      username,
      false,
      undefined,
      BackupType.SETTINGS
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('未找到配置备份文件');
    expect(result.error).not.toContain('获取仓库文件列表失败');
  });

  test('获取配置备份文件列表失败时保留文件列表错误', async () => {
    mockedGitHub.getRepositoryFiles.mockRejectedValue(new Error('network down'));

    const result = await backupService.restoreFromGitHub(
      credentials,
      username,
      false,
      undefined,
      BackupType.SETTINGS
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('获取仓库文件列表失败: network down');
  });

  test('旧版仅 settings 格式的配置备份仍可恢复', async () => {
    mockedGitHub.getRepositoryFiles.mockResolvedValue([
      {
        name: 'settings_backup_20240101010101.json',
        path: 'settings/settings_backup_20240101010101.json',
      },
    ] as any);
    const legacySettings = { syncEnabled: true, viewType: 'list' };
    mockedGitHub.getFileContent.mockResolvedValue({
      content: JSON.stringify({ settings: legacySettings }),
    } as any);

    const result = await backupService.restoreFromGitHub(
      credentials,
      username,
      false,
      undefined,
      BackupType.SETTINGS
    );

    expect(result.success).toBe(true);
    expect(mockedStorage.saveSettings).toHaveBeenCalledWith(legacySettings);
  });
});

describe('backup-service HTML 导出', () => {
  const mockedBookmark = bookmarkService as jest.Mocked<typeof bookmarkService>;
  const mockedFavicon = getFaviconUrl as jest.MockedFunction<typeof getFaviconUrl>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFavicon.mockReturnValue('');
  });

  test('完整 HTML 导出应转义标题、URL 并标记书签栏', async () => {
    mockedBookmark.getAllBookmarks.mockResolvedValue({
      success: true,
      data: [
        {
          id: '0',
          title: 'root',
          isFolder: true,
          children: [
            {
              id: '1',
              title: 'Bookmarks Bar',
              isFolder: true,
              children: [
                {
                  id: '2',
                  title: `<b>"A&B"</b>'`,
                  url: 'https://example.com/?a=1&b="2"',
                  isFolder: false,
                },
              ],
            },
          ],
        },
      ],
    } as any);

    const html = await createHtmlBookmarkData();

    expect(html).toContain('PERSONAL_TOOLBAR_FOLDER="true"');
    expect(html).toContain('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;&#039;');
    expect(html).toContain('HREF="https://example.com/?a=1&amp;b=&quot;2&quot;"');
    expect(html).not.toContain('<b>');
  });

  test('无图标时不写入 ICON 属性，书签项结构保持完整', async () => {
    mockedBookmark.getAllBookmarks.mockResolvedValue({
      success: true,
      data: [
        {
          id: '0',
          title: 'root',
          isFolder: true,
          children: [
            {
              id: '1',
              title: 'Bookmarks Bar',
              isFolder: true,
              children: [
                { id: '2', title: 'Example', url: 'https://example.com/page', isFolder: false },
              ],
            },
          ],
        },
      ],
    } as any);

    const html = await createHtmlBookmarkData();

    expect(html).toMatch(/<DT><A HREF="https:\/\/example\.com\/page" ADD_DATE="\d+">Example<\/A>/);
    expect(html).not.toContain('ICON=');
    expect(html).not.toContain('google.com');
  });

  test('获取书签失败时完整 HTML 导出抛错', async () => {
    mockedBookmark.getAllBookmarks.mockResolvedValue({
      success: false,
      error: 'permission denied',
    } as any);

    await expect(createHtmlBookmarkData()).rejects.toThrow('获取书签失败: permission denied');
  });

  test('选择性导出按 customOrder 排序，未设置顺序的排在最后', async () => {
    const html = await backupService.generateSelectiveHtml([
      { id: 'c', title: 'Third', type: 'bookmark', url: 'https://third.example.com', customOrder: 3 },
      { id: 'a', title: 'First', type: 'bookmark', url: 'https://first.example.com', customOrder: 1 },
      { id: 'n', title: 'NoOrder', type: 'bookmark', url: 'https://none.example.com' },
    ]);

    expect(html).toContain('PERSONAL_TOOLBAR_FOLDER="true"');
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Third'));
    expect(html.indexOf('Third')).toBeLessThan(html.indexOf('NoOrder'));
  });

  test('选择性导出保留文件夹层级并转义内容', async () => {
    const html = await backupService.generateSelectiveHtml([
      {
        id: 'f1',
        title: 'Folder <&>',
        type: 'folder',
        children: [
          {
            id: 'b1',
            title: 'Book & "Quote"',
            type: 'bookmark',
            url: 'https://example.com/?x=1&y=2',
          },
        ],
      },
    ]);

    expect(html).toContain('<DT><H3>Folder &lt;&amp;&gt;</H3>');
    expect(html).toContain('<DL><p>');
    expect(html).toContain('<DT><A HREF="https://example.com/?x=1&amp;y=2">Book &amp; &quot;Quote&quot;</A>');
  });

  test('图标预加载应按域名去重，避免重复抓取', async () => {
    mockedFavicon.mockImplementation((url: string) => `https://icons.example/${new URL(url).hostname}`);
    const fetchIcon = jest.fn(async () => 'data:image/png;base64,AAA');

    const faviconMap = await preloadFaviconIcons([
      { id: '1', title: 'A-1', url: 'https://a.example.com/path-1', isFolder: false },
      { id: '2', title: 'A-2', url: 'https://a.example.com/path-2', isFolder: false },
      { id: '3', title: 'B-1', url: 'https://b.example.com/path-1', isFolder: false },
    ], fetchIcon);

    expect(fetchIcon).toHaveBeenCalledTimes(2);
    expect(fetchIcon).toHaveBeenCalledWith('https://icons.example/a.example.com');
    expect(fetchIcon).toHaveBeenCalledWith('https://icons.example/b.example.com');
    expect(faviconMap.size).toBe(2);
  });
});

describe('backup-service 推送返回结果', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;
  const mockedBookmark = bookmarkService as jest.Mocked<typeof bookmarkService>;
  const mockedFavicon = getFaviconUrl as jest.MockedFunction<typeof getFaviconUrl>;
  const credentials = { token: 'test-token' };
  const username = 'alice';
  const fileUrl = 'https://github.com/alice/menav/blob/main/bookmarks/bookmarks_20240102.html';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGitHub.repoExists.mockResolvedValue(true);
    mockedGitHub.getRepositoryFiles.mockResolvedValue([]);
    mockedGitHub.createOrUpdateFile.mockResolvedValue({ content: { html_url: fileUrl } } as any);
    mockedStorage.saveBackupStatus.mockResolvedValue({ success: true } as any);
    // 关闭清理流程，避免其文件列表请求干扰推送用例的调用次数断言
    mockedStorage.getSettings.mockResolvedValue({
      success: true,
      data: { backup: { maxBackupsPerType: 0 } },
    } as any);
    mockedFavicon.mockReturnValue('');
    mockedBookmark.getAllBookmarks.mockResolvedValue({
      success: true,
      data: [
        {
          id: '0',
          title: 'root',
          isFolder: true,
          children: [
            { id: '1', title: 'Bookmarks Bar', isFolder: true, children: [] },
          ],
        },
      ],
    } as any);
  });

  test('推送成功时返回文件路径与 URL 并保存状态', async () => {
    const result = await backupService.pushBookmarksToGitHub(
      credentials,
      username,
      'menav',
      'bookmarks',
      '提交书签'
    );

    expect(result.success).toBe(true);
    expect(result.data.fileUrl).toBe(fileUrl);
    expect(result.data.filePath).toMatch(/^bookmarks\/bookmarks_\d{8}\.html$/);
    expect(result.timestamp).toBe(result.data.timestamp);
    expect(mockedGitHub.createOrUpdateFile).toHaveBeenCalledWith(
      credentials,
      username,
      'menav',
      result.data.filePath,
      expect.stringContaining('<!DOCTYPE NETSCAPE-Bookmark-file-1>'),
      '提交书签'
    );
    expect(mockedStorage.saveBackupStatus).toHaveBeenCalledWith(expect.objectContaining({
      lastBackupFilePath: result.data.filePath,
      backupFileUrl: fileUrl,
      lastOperationStatus: 'success',
      stats: { isFromCache: false },
    }));
  });

  test('同日二次推送应查询已有文件并携带 sha 更新', async () => {
    const first = await backupService.pushBookmarksToGitHub(
      credentials,
      username,
      'menav',
      'bookmarks',
      '提交书签'
    );
    // 模拟首次推送后仓库中已存在同名文件
    const existingFileName = first.data.filePath.split('/').pop() as string;
    mockedGitHub.getRepositoryFiles.mockResolvedValueOnce([
      {
        name: existingFileName,
        path: first.data.filePath,
        sha: 'sha-existing',
        size: 1,
        url: '',
        download_url: '',
        type: 'file',
      },
    ] as any);

    const second = await backupService.pushBookmarksToGitHub(
      credentials,
      username,
      'menav',
      'bookmarks',
      '提交书签'
    );

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.data.filePath).toBe(first.data.filePath);
    expect(mockedGitHub.getRepositoryFiles).toHaveBeenNthCalledWith(
      1,
      credentials,
      username,
      'menav',
      'bookmarks'
    );
    expect(mockedGitHub.getRepositoryFiles).toHaveBeenNthCalledWith(
      2,
      credentials,
      username,
      'menav',
      'bookmarks'
    );
    // 首次上传目录为空（不传 sha），同日第二次上传携带已有文件 sha，避免 GitHub 返回 422
    expect(mockedGitHub.createOrUpdateFile).toHaveBeenNthCalledWith(
      1,
      credentials,
      username,
      'menav',
      first.data.filePath,
      expect.stringContaining('<!DOCTYPE NETSCAPE-Bookmark-file-1>'),
      '提交书签'
    );
    expect(mockedGitHub.createOrUpdateFile).toHaveBeenNthCalledWith(
      2,
      credentials,
      username,
      'menav',
      second.data.filePath,
      expect.stringContaining('<!DOCTYPE NETSCAPE-Bookmark-file-1>'),
      '提交书签',
      'sha-existing'
    );
  });

  test('目标目录不存在时按新建文件上传', async () => {
    mockedGitHub.getRepositoryFiles.mockRejectedValue(new GitHubApiError(404, 'Not Found'));

    const result = await backupService.pushBookmarksToGitHub(
      credentials,
      username,
      'menav',
      'bookmarks',
      '提交书签'
    );

    expect(result.success).toBe(true);
    expect(mockedGitHub.createOrUpdateFile).toHaveBeenCalledWith(
      credentials,
      username,
      'menav',
      result.data.filePath,
      expect.stringContaining('<!DOCTYPE NETSCAPE-Bookmark-file-1>'),
      '提交书签'
    );
  });

  test('推送上传失败时返回失败并保存失败状态', async () => {
    mockedGitHub.createOrUpdateFile.mockRejectedValue(new Error('403 forbidden'));

    const result = await backupService.pushBookmarksToGitHub(
      credentials,
      username,
      'menav',
      'bookmarks',
      '提交书签'
    );

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toContain('推送失败: 403 forbidden');
    expect(mockedStorage.saveBackupStatus).toHaveBeenCalledWith(expect.objectContaining({
      lastOperationStatus: 'failed',
      errorMessage: '403 forbidden',
    }));
  });
});
