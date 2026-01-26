import { getDomainFromUrl } from './favicon-service';

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
});
