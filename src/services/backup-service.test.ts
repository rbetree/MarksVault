import backupService from './backup-service';
import githubService from './github-service';
import storageService from '../utils/storage-service';

jest.mock('./github-service', () => ({
  __esModule: true,
  default: {
    repoExists: jest.fn(),
    getRepositoryFiles: jest.fn(),
    getFileContent: jest.fn(),
  },
}));

jest.mock('../utils/storage-service', () => ({
  __esModule: true,
  default: {
    saveBackupStatus: jest.fn(),
  },
}));

describe('backup-service 恢复路径选择', () => {
  const mockedGitHub = githubService as jest.Mocked<typeof githubService>;
  const mockedStorage = storageService as jest.Mocked<typeof storageService>;
  const credentials = { token: 'test-token' };
  const username = 'alice';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGitHub.repoExists.mockResolvedValue(true);
    mockedStorage.saveBackupStatus.mockResolvedValue({ success: true });
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
});

