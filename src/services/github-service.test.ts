import githubService, { GitHubApiError } from './github-service';

describe('github-service.validateCredentials', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  test('成功返回用户信息', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ login: 'alice' }),
    });

    const user = await githubService.validateCredentials({ token: 'test-token' } as any);
    expect(user.login).toBe('alice');
  });

  test('失败时抛出 GitHubApiError 并携带 status/data', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Bad credentials' }),
    });

    await expect(
      githubService.validateCredentials({ token: 'bad-token' } as any),
    ).rejects.toMatchObject<Partial<GitHubApiError>>({
      name: 'GitHubApiError',
      status: 401,
      data: { message: 'Bad credentials' },
    });
  });
});

