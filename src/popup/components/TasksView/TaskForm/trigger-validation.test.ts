import {
  EMPTY_TRIGGER_CONDITION_DRAFT,
  PARENT_FOLDER_WHITESPACE_ERROR,
  WHITESPACE_ONLY_CONDITION_ERROR,
  buildTriggerConditions,
  hasTriggerConditions,
  triggerConditionDraftFromConditions,
  validateTriggerConditionDraft
} from './trigger-validation';

describe('trigger-validation 触发条件转换与校验', () => {
  test('全部留空或只含空白时生成 undefined 条件', () => {
    expect(buildTriggerConditions(EMPTY_TRIGGER_CONDITION_DRAFT)).toBeUndefined();
    expect(
      buildTriggerConditions({ url: '  ', title: '\t', parentFolder: ' ' })
    ).toBeUndefined();
  });

  test('去除首尾空白并丢弃空字段', () => {
    expect(
      buildTriggerConditions({
        url: ' example.com ',
        title: '',
        parentFolder: ' folder_1 '
      })
    ).toEqual({
      url: 'example.com',
      parentFolder: 'folder_1'
    });
  });

  test('旧任务缺少 conditions 时草稿为空且视为未配置', () => {
    expect(triggerConditionDraftFromConditions(undefined)).toEqual(EMPTY_TRIGGER_CONDITION_DRAFT);
    expect(triggerConditionDraftFromConditions({})).toEqual(EMPTY_TRIGGER_CONDITION_DRAFT);
    expect(hasTriggerConditions(undefined)).toBe(false);
    expect(hasTriggerConditions({})).toBe(false);
    expect(hasTriggerConditions({ url: '   ' })).toBe(false);
    expect(hasTriggerConditions({ title: 'Example' })).toBe(true);
  });

  test('只包含空白字符的条件字段校验失败', () => {
    const result = validateTriggerConditionDraft({
      url: '   ',
      title: '\t',
      parentFolder: ''
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.url).toBe(WHITESPACE_ONLY_CONDITION_ERROR);
    expect(result.errors.title).toBe(WHITESPACE_ONLY_CONDITION_ERROR);
    expect(result.errors.parentFolder).toBeUndefined();
  });

  test('父文件夹 ID 包含空白字符时校验失败', () => {
    const result = validateTriggerConditionDraft({
      url: '',
      title: '',
      parentFolder: 'folder 1'
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.parentFolder).toBe(PARENT_FOLDER_WHITESPACE_ERROR);
  });

  test('合法条件校验通过，正则元字符按字面文本处理', () => {
    const result = validateTriggerConditionDraft({
      url: 'https://example.com/a?b=c',
      title: '[工作] 周报',
      parentFolder: 'folder_1'
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('全部留空是合法状态，表示匹配所有事件', () => {
    const result = validateTriggerConditionDraft(EMPTY_TRIGGER_CONDITION_DRAFT);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
