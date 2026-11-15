import { EventTriggerConditions } from '../../../../types/task';

/**
 * 事件触发表单中可编辑的条件字段草稿
 * 保留用户输入的原始文本，保存时再统一去除首尾空白
 */
export interface TriggerConditionDraft {
  url: string;
  title: string;
  parentFolder: string;
}

export interface TriggerConditionValidationResult {
  errors: Partial<Record<keyof TriggerConditionDraft, string>>;
  isValid: boolean;
}

export const EMPTY_TRIGGER_CONDITION_DRAFT: TriggerConditionDraft = {
  url: '',
  title: '',
  parentFolder: ''
};

export const WHITESPACE_ONLY_CONDITION_ERROR = '条件不能只包含空白字符';

export const PARENT_FOLDER_WHITESPACE_ERROR = '父文件夹 ID 不能包含空白字符';

const getConditionString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * 把已保存的条件转换为表单草稿
 * 旧任务没有 conditions 时返回空草稿，对应“匹配所有事件”
 */
export const triggerConditionDraftFromConditions = (
  conditions?: EventTriggerConditions
): TriggerConditionDraft => ({
  url: getConditionString(conditions?.url),
  title: getConditionString(conditions?.title),
  parentFolder: getConditionString(conditions?.parentFolder)
});

/**
 * 把表单草稿转换为待保存条件
 * 去除首尾空白并丢弃空字段；全部为空时返回 undefined，避免持久化空条件
 */
export const buildTriggerConditions = (
  draft: TriggerConditionDraft
): EventTriggerConditions | undefined => {
  const conditions: EventTriggerConditions = {};
  const url = draft.url.trim();
  const title = draft.title.trim();
  const parentFolder = draft.parentFolder.trim();

  if (url) conditions.url = url;
  if (title) conditions.title = title;
  if (parentFolder) conditions.parentFolder = parentFolder;

  return Object.keys(conditions).length > 0 ? conditions : undefined;
};

/**
 * 校验条件草稿
 * URL 与标题按文本包含匹配，不做正则解析；父文件夹按 ID 精确匹配
 */
export const validateTriggerConditionDraft = (
  draft: TriggerConditionDraft
): TriggerConditionValidationResult => {
  const errors: TriggerConditionValidationResult['errors'] = {};

  (['url', 'title', 'parentFolder'] as const).forEach((field) => {
    if (draft[field] !== '' && draft[field].trim() === '') {
      errors[field] = WHITESPACE_ONLY_CONDITION_ERROR;
    }
  });

  if (!errors.parentFolder && /\s/.test(draft.parentFolder.trim())) {
    errors.parentFolder = PARENT_FOLDER_WHITESPACE_ERROR;
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
};

/**
 * 判断条件是否实际生效
 * 缺失、空对象与全空白字段都视为未配置，匹配所有事件
 */
export const hasTriggerConditions = (conditions?: EventTriggerConditions): boolean => {
  if (!conditions) {
    return false;
  }

  return (
    getConditionString(conditions.url) !== '' ||
    getConditionString(conditions.title) !== '' ||
    getConditionString(conditions.parentFolder) !== ''
  );
};
