import {
  DELETE_PATTERN_ERROR,
  MOVE_TARGET_ERROR,
  validateOrganizeOperations
} from './action-validation';
import { ExtendedOrganizeOperation } from './action-form-types';

describe('action-validation 整理操作校验', () => {
  test('删除操作缺少匹配规则时校验失败', () => {
    const result = validateOrganizeOperations([
      { operation: 'delete', filters: { pattern: '' } }
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errors.operation_0_pattern).toBe(DELETE_PATTERN_ERROR);
  });

  test('删除操作的匹配规则只有空白字符时校验失败', () => {
    const result = validateOrganizeOperations([
      { operation: 'delete', filters: { pattern: '   ' } }
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errors.operation_0_pattern).toBe(DELETE_PATTERN_ERROR);
  });

  test('删除操作指定匹配规则时校验通过', () => {
    const result = validateOrganizeOperations([
      { operation: 'delete', filters: { pattern: '*example*' } }
    ]);

    expect(result.isValid).toBe(true);
    expect(result.errors.operation_0_pattern).toBeUndefined();
  });

  test('其他操作不要求匹配规则，保持原有校验语义', () => {
    const operations: ExtendedOrganizeOperation[] = [
      { operation: 'move', target: 'folder-1' },
      { operation: 'rename', newName: '{title}-new' },
      { operation: 'tag', newName: '工作' },
      { operation: 'validate' }
    ];

    const result = validateOrganizeOperations(operations);

    expect(result.isValid).toBe(true);
  });

  test('保留非整理操作字段的错误，只重建 operation_ 前缀条目', () => {
    const result = validateOrganizeOperations(
      [{ operation: 'delete', filters: { pattern: '' } }],
      { name: '任务名称错误', operation_0_target: MOVE_TARGET_ERROR }
    );

    expect(result.errors.name).toBe('任务名称错误');
    expect(result.errors.operation_0_target).toBeUndefined();
    expect(result.errors.operation_0_pattern).toBe(DELETE_PATTERN_ERROR);
  });
});
