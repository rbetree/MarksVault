import { getBookmarkFuzzyScore } from './bookmark-search-utils';

describe('bookmark-search-utils 模糊搜索评分', () => {
  test('标题直接包含关键字时应高分命中', () => {
    const score = getBookmarkFuzzyScore('github', 'GitHub - Build software', 'https://github.com');
    expect(score).toBeGreaterThan(200);
  });

  test('支持非连续字符匹配（gthb -> github）', () => {
    const score = getBookmarkFuzzyScore('gthb', 'GitHub', 'https://github.com');
    expect(score).toBeGreaterThan(0);
  });

  test('多关键字采用 AND 语义，缺少任一关键字则不命中', () => {
    const matchedScore = getBookmarkFuzzyScore('react docs', 'React 官方文档', 'https://react.dev/docs');
    const unmatchedScore = getBookmarkFuzzyScore('react docs', 'React 官方站点', 'https://react.dev');

    expect(matchedScore).toBeGreaterThan(0);
    expect(unmatchedScore).toBe(0);
  });

  test('不相关内容应返回 0', () => {
    const score = getBookmarkFuzzyScore('kubernetes', 'GitHub', 'https://github.com');
    expect(score).toBe(0);
  });
});
