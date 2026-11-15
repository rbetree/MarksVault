import versionService from './version-service';

const LAST_CHECK_KEY = 'version_last_check';

interface LocalStorageMock {
  store: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const createLocalStorageMock = (): LocalStorageMock => {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    }
  };
};

const mockReleaseResponse = (version: string) => ({
  ok: true,
  status: 200,
  json: async () => ({
    tag_name: `v${version}`,
    html_url: `https://github.com/rbetree/MarksVault/releases/tag/v${version}`,
    body: 'release notes',
    published_at: '2026-01-01T00:00:00Z'
  })
});

describe('VersionService.checkForUpdates', () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = (global as any).localStorage;
  let localStorageMock: LocalStorageMock;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    (global as any).localStorage = localStorageMock;
    jest.spyOn(versionService, 'getCurrentVersion').mockReturnValue('1.5.2');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    (global as any).localStorage = originalLocalStorage;
  });

  it('冷却期内返回 skipped，不发起请求', async () => {
    localStorageMock.setItem(LAST_CHECK_KEY, Date.now().toString());
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const result = await versionService.checkForUpdates(false);

    expect(result.checkStatus).toBe('skipped');
    expect(result.hasUpdate).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('检查失败返回 failed，且不消耗冷却时间', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

    const result = await versionService.checkForUpdates(true);

    expect(result.checkStatus).toBe('failed');
    expect(result.hasUpdate).toBe(false);
    expect(localStorageMock.getItem(LAST_CHECK_KEY)).toBeNull();
  });

  it('已是最新版本返回 up-to-date', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockReleaseResponse('1.5.2'));

    const result = await versionService.checkForUpdates(true);

    expect(result.checkStatus).toBe('up-to-date');
    expect(result.hasUpdate).toBe(false);
    expect(localStorageMock.getItem(LAST_CHECK_KEY)).not.toBeNull();
  });

  it('发现新版本返回 update-available', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockReleaseResponse('1.6.0'));

    const result = await versionService.checkForUpdates(true);

    expect(result.checkStatus).toBe('update-available');
    expect(result.hasUpdate).toBe(true);
    expect(result.releaseInfo?.version).toBe('1.6.0');
  });

  it('当前版本高于最新正式版本返回 development', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(mockReleaseResponse('1.5.1'));

    const result = await versionService.checkForUpdates(true);

    expect(result.checkStatus).toBe('development');
    expect(result.hasUpdate).toBe(false);
    expect(result.isDevelopmentMode).toBe(true);
  });
});
