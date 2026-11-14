import { ExtendedOrganizeOperation } from './action-form-types';

export interface OrganizeValidationResult {
  errors: { [key: string]: string };
  isValid: boolean;
}

export const MOVE_TARGET_ERROR = '移动操作需要指定目标文件夹';

export const getNewNameError = (operation: 'rename' | 'tag'): string =>
  `${operation === 'rename' ? '重命名' : '标签'}操作需要指定${operation === 'rename' ? '新名称' : '标签名称'}`;

/**
 * 校验整理操作。
 * 复制现有错误后只重建 operation_ 前缀的条目，避免覆盖其他字段的错误。
 */
export const validateOrganizeOperations = (
  operations: ExtendedOrganizeOperation[],
  existingErrors: { [key: string]: string } = {}
): OrganizeValidationResult => {
  const errors = { ...existingErrors };
  Object.keys(errors).forEach((key) => {
    if (key.startsWith('operation_')) {
      delete errors[key];
    }
  });

  let isValid = true;

  operations.forEach((op, index) => {
    if (op.operation === 'move' && !op.target) {
      errors[`operation_${index}_target`] = MOVE_TARGET_ERROR;
      isValid = false;
    }

    if ((op.operation === 'rename' || op.operation === 'tag') && !op.newName) {
      errors[`operation_${index}_newName`] = getNewNameError(op.operation);
      isValid = false;
    }
  });

  return { errors, isValid };
};
