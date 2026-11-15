import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import {
  Action,
  ActionType,
  BackupAction,
  OrganizeAction,
  PushAction,
  SelectivePushAction,
  createBackupAction,
  createOrganizeAction,
  createPushAction,
  createSelectivePushAction
} from '../../../../types/task';
import bookmarkService from '../../../../utils/bookmark-service';
import SelectivePushActionForm from './SelectivePushActionForm';
import ActionTypeSelector from './ActionTypeSelector';
import BackupActionEditor from './BackupActionEditor';
import PushActionEditor from './PushActionEditor';
import OrganizeActionEditor from './OrganizeActionEditor';
import { ExtendedOrganizeOperation, FolderOption } from './action-form-types';
import {
  getNewNameError,
  MOVE_TARGET_ERROR,
  validateOrganizeOperations
} from './action-validation';

interface TaskActionFormProps {
  action: Action;
  onChange: (updatedAction: Action, isValid: boolean) => void;
  showDetailsInSeparateColumn?: boolean; // 当为true时，只渲染操作类型选择卡片
  showOnlyDetails?: boolean; // 当为true时，只渲染详细配置表单
}

/**
 * 任务操作配置表单组件
 * 用于配置任务的具体操作，包括备份、整理等
 */
const TaskActionForm: React.FC<TaskActionFormProps> = ({
  action,
  onChange,
  showDetailsInSeparateColumn = false,
  showOnlyDetails = false
}) => {
  // 操作类型
  const [actionType, setActionType] = useState<ActionType>(action.type);

  // 备份操作状态
  const [backupOperation, setBackupOperation] = useState<'backup' | 'restore'>(
    action.type === ActionType.BACKUP && 'operation' in action ?
      (action as BackupAction).operation : 'backup'
  );
  const [backupFilePath, setBackupFilePath] = useState<string>(
    action.type === ActionType.BACKUP &&
    'options' in action &&
    (action as BackupAction).options.backupFilePath ?
      String((action as BackupAction).options.backupFilePath) : ''
  );

  // 推送操作状态
  const [pushRepoName, setPushRepoName] = useState<string>(
    action.type === ActionType.PUSH ? (action as PushAction).options.repoName || 'menav' : 'menav'
  );
  const [pushFolderPath, setPushFolderPath] = useState<string>(
    action.type === ActionType.PUSH ? (action as PushAction).options.folderPath || 'bookmarks' : 'bookmarks'
  );
  const [pushCommitMessage, setPushCommitMessage] = useState<string>(
    action.type === ActionType.PUSH ? (action as PushAction).options.commitMessage || '自动推送书签' : '自动推送书签'
  );

  // 选择性推送操作状态
  const [selectivePush, setSelectivePush] = useState<SelectivePushAction>(
    action.type === ActionType.SELECTIVE_PUSH ? (action as SelectivePushAction) : createSelectivePushAction('menav', 'bookmarks', '选择性推送书签')
  );

  // 整理操作状态
  const [operations, setOperations] = useState<ExtendedOrganizeOperation[]>(
    action.type === ActionType.ORGANIZE ?
      (action as OrganizeAction).operations.map(op => ({
        ...op
      })) :
      []
  );

  // 表单验证状态
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 文件夹选择状态
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [foldersLoading, setFoldersLoading] = useState<boolean>(false);
  const [selectedFolders, setSelectedFolders] = useState<{[key: number]: FolderOption | null}>({});

  // 加载所有书签文件夹
  const loadBookmarkFolders = async () => {
    setFoldersLoading(true);
    try {
      const result = await bookmarkService.getAllBookmarkFolders();
      if (result.success && result.data) {
        setFolders(result.data as FolderOption[]);
      } else {
        console.error('加载书签文件夹失败:', result.error);
      }
    } catch (error) {
      console.error('加载书签文件夹异常:', error);
    } finally {
      setFoldersLoading(false);
    }
  };

  // 组件挂载时加载文件夹
  useEffect(() => {
    loadBookmarkFolders();
  }, []);

  // 初始化已选择的文件夹
  useEffect(() => {
    if (action.type === ActionType.ORGANIZE && folders.length > 0) {
      const newSelectedFolders: {[key: number]: FolderOption | null} = {};

      (action as OrganizeAction).operations.forEach((op, index) => {
        if (op.operation === 'move' && op.target) {
          const folder = folders.find(f => f.id === op.target);
          if (folder) {
            newSelectedFolders[index] = folder;
          }
        }
      });

      setSelectedFolders(newSelectedFolders);
    }
  }, [action, folders]);

  // 初始化表单数据
  useEffect(() => {
    setActionType(action.type);

    if (action.type === ActionType.BACKUP) {
      const backupAction = action as BackupAction;
      setBackupOperation(backupAction.operation || 'backup');
      setBackupFilePath(backupAction.options.backupFilePath ? String(backupAction.options.backupFilePath) : '');
    } else if (action.type === ActionType.PUSH) {
      const pushAction = action as PushAction;
      setPushRepoName(pushAction.options.repoName || 'menav');
      setPushFolderPath(pushAction.options.folderPath || 'bookmarks');
      setPushCommitMessage(pushAction.options.commitMessage || '自动推送书签');
    } else if (action.type === ActionType.SELECTIVE_PUSH) {
      const selectivePushAction = action as SelectivePushAction;
      setSelectivePush(selectivePushAction);
    } else if (action.type === ActionType.ORGANIZE) {
      // 转换操作
      setOperations(
        (action as OrganizeAction).operations.map(op => ({
          ...op
        }))
      );
    }
  }, [action]);

  // 编辑已有整理任务时也要把当前配置的校验结果同步给父组件，
  // 避免删除操作沿用旧的空匹配规则仍允许保存
  useEffect(() => {
    if (action.type !== ActionType.ORGANIZE) {
      return;
    }
    const validation = validateOrganizeOperations((action as OrganizeAction).operations, {});
    setErrors(validation.errors);
    onChange(action, validation.isValid);
  }, []);

  // 处理操作类型更改
  const handleActionTypeChange = (newType: ActionType) => {
    setActionType(newType);

    let newAction: Action;
    switch (newType) {
      case ActionType.BACKUP:
        newAction = createBackupAction(backupOperation);
        break;
      case ActionType.PUSH:
        newAction = createPushAction();
        break;
      case ActionType.SELECTIVE_PUSH:
        newAction = createSelectivePushAction('menav', 'bookmarks', '选择性推送书签');
        break;
      case ActionType.ORGANIZE:
      default:
        newAction = createOrganizeAction();
        break;
    }

    onChange(newAction, true);
  };

  // 处理备份操作类型更改
  const handleBackupOperationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOperation = event.target.value as 'backup' | 'restore';
    setBackupOperation(newOperation);

    if (action.type === ActionType.BACKUP) {
      const updatedAction: BackupAction = {
        ...(action as BackupAction),
        operation: newOperation,
        description: newOperation === 'backup' ? '备份书签到GitHub' : '从GitHub恢复书签',
        options: {
          ...(action as BackupAction).options,
          backupFilePath: newOperation === 'restore' ? backupFilePath : undefined
        }
      };

      onChange(updatedAction, true);
    }
  };

  // 处理备份文件路径更改
  const handleBackupFilePathChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setBackupFilePath(value);

    if (action.type === ActionType.BACKUP) {
      const updatedAction: BackupAction = {
        ...(action as BackupAction),
        options: {
          ...(action as BackupAction).options,
          backupFilePath: value
        }
      };

      onChange(updatedAction, true);
    }
  };

  // 处理推送仓库名称更改
  const handlePushRepoNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPushRepoName(value);

    if (action.type === ActionType.PUSH) {
      const updatedAction: PushAction = {
        ...(action as PushAction),
        options: {
          ...(action as PushAction).options,
          repoName: value
        }
      };

      onChange(updatedAction, true);
    }
  };

  // 处理推送文件夹路径更改
  const handlePushFolderPathChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPushFolderPath(value);

    if (action.type === ActionType.PUSH) {
      const updatedAction: PushAction = {
        ...(action as PushAction),
        options: {
          ...(action as PushAction).options,
          folderPath: value
        }
      };

      onChange(updatedAction, true);
    }
  };

  // 处理推送提交消息更改
  const handlePushCommitMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPushCommitMessage(value);

    if (action.type === ActionType.PUSH) {
      const updatedAction: PushAction = {
        ...(action as PushAction),
        options: {
          ...(action as PushAction).options,
          commitMessage: value
        }
      };

      onChange(updatedAction, true);
    }
  };

  // 添加新的整理操作
  const handleAddOperation = () => {
    const newOperation = {
      operation: 'move' as const,
      filters: {
        pattern: ''
      }
    };

    const newOperations = [...operations, newOperation];
    setOperations(newOperations);

    // 添加新操作时标记目标文件夹为必填
    const newErrors = { ...errors };
    newErrors[`operation_${newOperations.length - 1}_target`] = MOVE_TARGET_ERROR;
    setErrors(newErrors);

    if (action.type === ActionType.ORGANIZE) {
      const updatedAction: OrganizeAction = {
        ...(action as OrganizeAction),
        operations: newOperations
      };

      onChange(updatedAction, false); // 新添加的移动操作无效，直到指定目标文件夹
    }
  };

  // 删除整理操作
  const handleDeleteOperation = (index: number) => {
    const newOperations = [...operations];
    newOperations.splice(index, 1);
    setOperations(newOperations);

    if (action.type === ActionType.ORGANIZE) {
      const updatedAction: OrganizeAction = {
        ...(action as OrganizeAction),
        operations: newOperations
      };

      // 删除操作后重新校验剩余规则，避免残留的无效规则被误判为可保存
      const validation = validateOrganizeOperations(newOperations, errors);
      setErrors(validation.errors);
      onChange(updatedAction, validation.isValid && newOperations.length > 0);
    }
  };

  // 更新整理操作
  const handleUpdateOperation = (index: number, field: string, value: any) => {
    const newOperations = [...operations];
    const newErrors = { ...errors };
    const newSelectedFolders = { ...selectedFolders };

    if (field === 'operation') {
      newOperations[index].operation = value;
      // 如果操作类型变为移动，但没有目标文件夹，标记错误
      if (value === 'move' && !newOperations[index].target) {
        newErrors[`operation_${index}_target`] = MOVE_TARGET_ERROR;
      } else {
        delete newErrors[`operation_${index}_target`];
      }
    } else if (field.startsWith('filters.')) {
      const filterField = field.split('.')[1];
      const nextFilters = newOperations[index].filters ?? {};
      (nextFilters as any)[filterField] = value;
      newOperations[index].filters = nextFilters;
    } else if (field === 'target') {
      // 处理目标文件夹选择
      if (value) {
        if (typeof value === 'string') {
          newOperations[index].target = value;
        } else if (value && 'id' in value) {
          // 选择了文件夹对象，更新选中状态和目标ID
          newOperations[index].target = value.id;
          newSelectedFolders[index] = value as FolderOption;
        }
      } else {
        newOperations[index].target = undefined;
        newSelectedFolders[index] = null;
      }

      // 清除或设置目标文件夹错误
      if (newOperations[index].target) {
        delete newErrors[`operation_${index}_target`];
      } else if (newOperations[index].operation === 'move') {
        newErrors[`operation_${index}_target`] = MOVE_TARGET_ERROR;
      }
    } else if (field === 'newName') {
      newOperations[index].newName = value;
      // 验证重命名和标签操作的新名称
      const operationType = newOperations[index].operation;
      if ((operationType === 'rename' || operationType === 'tag') && !value) {
        newErrors[`operation_${index}_newName`] = getNewNameError(operationType);
      } else {
        delete newErrors[`operation_${index}_newName`];
      }
    }

    setOperations(newOperations);
    setErrors(newErrors);
    setSelectedFolders(newSelectedFolders);

    // 验证所有操作是否有效
    const isValid = validateOperations(newOperations);

    if (action.type === ActionType.ORGANIZE) {
      // 创建操作副本
      const cleanedOperations = [...newOperations];

      const updatedAction: OrganizeAction = {
        ...(action as OrganizeAction),
        operations: cleanedOperations
      };

      onChange(updatedAction, isValid && newOperations.length > 0);
    }
  };

  // 验证所有整理操作
  const validateOperations = (ops: OrganizeAction['operations']): boolean => {
    const validation = validateOrganizeOperations(ops, errors);
    setErrors(validation.errors);
    return validation.isValid;
  };

  // 渲染备份操作表单
  const renderBackupForm = () => {
    return (
      <BackupActionEditor
        operation={backupOperation}
        backupFilePath={backupFilePath}
        onOperationChange={handleBackupOperationChange}
        onBackupFilePathChange={handleBackupFilePathChange}
      />
    );
  };

  // 渲染整理操作表单
  const renderOrganizeForm = () => {
    return (
      <OrganizeActionEditor
        operations={operations}
        errors={errors}
        folders={folders}
        foldersLoading={foldersLoading}
        selectedFolders={selectedFolders}
        onAddOperation={handleAddOperation}
        onDeleteOperation={handleDeleteOperation}
        onUpdateOperation={handleUpdateOperation}
      />
    );
  };

  // 渲染推送书签表单
  const renderPushForm = () => {
    return (
      <PushActionEditor
        repoName={pushRepoName}
        folderPath={pushFolderPath}
        commitMessage={pushCommitMessage}
        onRepoNameChange={handlePushRepoNameChange}
        onFolderPathChange={handlePushFolderPathChange}
        onCommitMessageChange={handlePushCommitMessageChange}
      />
    );
  };

  // 渲染选择性推送表单
  const renderSelectivePushForm = () => {
    return (
      <Box sx={{ mt: 0 }}>
        <SelectivePushActionForm
          action={selectivePush}
          onChange={(updatedAction) => {
            setSelectivePush(updatedAction);
            // 验证表单（selections在配置阶段不需要验证）
            const isValid = updatedAction.options.repoName.trim() !== '' &&
                           updatedAction.options.folderPath.trim() !== '';
            onChange(updatedAction, isValid);
          }}
          onValidation={(isValid) => {
            onChange(selectivePush, isValid);
          }}
        />
      </Box>
    );
  };

  // 根据操作类型渲染相应的表单
  const renderActionForm = () => {
    switch (actionType) {
      case ActionType.BACKUP:
        return renderBackupForm();
      case ActionType.PUSH:
        return renderPushForm();
      case ActionType.SELECTIVE_PUSH:
        return renderSelectivePushForm();
      case ActionType.ORGANIZE:
        return renderOrganizeForm();
      default:
        return null;
    }
  };

  // 如果只显示详细配置
  if (showOnlyDetails) {
    return (
      <Box>
        {renderActionForm()}
      </Box>
    );
  }

  // 如果只显示操作类型选择（详细配置在右栏）
  if (showDetailsInSeparateColumn) {
    return (
      <Box>
        <ActionTypeSelector
          selectedType={actionType}
          onSelect={handleActionTypeChange}
        />
      </Box>
    );
  }

  // 默认渲染：显示操作类型选择和详细配置（向后兼容）
  return (
    <Box>
      <ActionTypeSelector
        selectedType={actionType}
        onSelect={handleActionTypeChange}
        marginBottom
      />

      <Paper
        elevation={0}
        sx={{
          p: 0,
          bgcolor: 'transparent',
          borderRadius: 2,
          border: 'none',
          transition: 'all 0.3s ease',
          boxShadow: 'none'
        }}
      >
        {renderActionForm()}
      </Paper>
    </Box>
  );
};

export default TaskActionForm;
