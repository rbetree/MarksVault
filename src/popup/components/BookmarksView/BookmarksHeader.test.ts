import { getInputValueFromEventTarget } from './search-input-utils';

describe('BookmarksHeader IME 取值逻辑', () => {
  test('优先读取事件 target 上的 value', () => {
    const target = { value: '中文搜索' } as unknown as EventTarget;
    expect(getInputValueFromEventTarget(target, '')).toBe('中文搜索');
  });

  test('target 缺失时返回 fallback', () => {
    expect(getInputValueFromEventTarget(null, 'fallback')).toBe('fallback');
  });

  test('target.value 不是字符串时返回 fallback', () => {
    const target = { value: 123 } as unknown as EventTarget;
    expect(getInputValueFromEventTarget(target, 'fallback')).toBe('fallback');
  });
});
