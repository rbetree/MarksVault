import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import { 
  Action, 
  ActionType, 
  BackupAction, 
  OrganizeAction, 
  CustomAction,
  createBackupAction,
  createOrganizeAction
} from '../../../../types/task';

interface TaskActionFormProps {
  action: Action;
  onChange: (updatedAction: Action, isValid: boolean) => void;
}

/**
 * 任务操作配置表单组件
 * 用于配置任务的具体操作，包括备份、整理等
 */
const TaskActionForm: React.FC<TaskActionFormProps> = ({ action, onChange }) => {
  // 操作类型
  const [actionType, setActionType] = useState<ActionType>(action.type);
  
  // 备份操作状态
  const [commitMessage, setCommitMessage] = useState<string>(
    action.type === ActionType.BACKUP ? (action as BackupAction).options.commitMessage || '' : '自动备份书签'
  );
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(
    action.type === ActionType.BACKUP ? !!(action as BackupAction).options.includeMetadata : true
  );
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
  
  // 整理操作状态
  const [operations, setOperations] = useState<OrganizeAction['operations']>(
    action.type === ActionType.ORGANIZE ? (action as OrganizeAction).operations : []
  );
  
  // 自定义操作状态
  const [customDescription, setCustomDescription] = useState<string>(
    action.type === ActionType.CUSTOM ? (action as CustomAction).description : ''
  );
  
  // 表单验证状态
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // 初始化表单数据
  useEffect(() => {
    setActionType(action.type);
    
    if (action.type === ActionType.BACKUP) {
      const backupAction = action as BackupAction;
      setCommitMessage(backupAction.options.commitMessage || '');
      setIncludeMetadata(!!backupAction.options.includeMetadata);
      setBackupOperation(backupAction.operation || 'backup');
      setBackupFilePath(backupAction.options.backupFilePath ? String(backupAction.options.backupFilePath) : '');
    } else if (action.type === ActionType.ORGANIZE) {
      setOperations((action as OrganizeAction).operations);
    } else if (action.type === ActionType.CUSTOM) {
      setCustomDescription((action as CustomAction).description);
    }
  }, [action]);
  
  // 处理操作类型更改
  const handleActionTypeChange = (event: any) => {
    const newType = event.target.value as ActionType;
    setActionType(newType);
    
    let newAction: Action;
    switch (newType) {
      case ActionType.BACKUP:
        newAction = createBackupAction(backupOperation);
        break;
      case ActionType.ORGANIZE:
        newAction = createOrganizeAction();
        break;
      case ActionType.CUSTOM:
      default:
        newAction = {
          type: ActionType.CUSTOM,
          description: customDescription || '自定义操作',
          config: {}
        };
        break;
    }
    
    onChange(newAction, true);
  };
  
  // 处理提交消息更改
  const handleCommitMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCommitMessage(value);
    
    if (action.type === ActionType.BACKUP) {
      const updatedAction: BackupAction = {
        ...(action as BackupAction),
        options: {
          ...(action as BackupAction).options,
          commitMessage: value
        }
      };
      
      onChange(updatedAction, true);
    }
  };
  
  // 处理包含元数据选项更改
  const handleIncludeMetadataChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setIncludeMetadata(value);
    
    if (action.type === ActionType.BACKUP) {
      const updatedAction: BackupAction = {
        ...(action as BackupAction),
        options: {
          ...(action as BackupAction).options,
          includeMetadata: value
        }
      };
      
      onChange(updatedAction, true);
    }
  };
  
  // 处理备份操作类型更改
  const handleBackupOperationChange = (event: any) => {
    const newOperation = event.target.value as 'backup' | 'restore';
    setBackupOperation(newOperation);
    
    if (action.type === ActionType.BACKUP) {
      const updatedAction: BackupAction = {
        ...(action as BackupAction),
        operation: newOperation,
        description: newOperation === 'backup' ? '备份书签到GitHub' : '从GitHub恢复书签',
        options: {
          ...(action as BackupAction).options,
          commitMessage: newOperation === 'backup' ? commitMessage : '',
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
    
    if (action.type === ActionType.ORGANIZE) {
      const updatedAction: OrganizeAction = {
        ...(action as OrganizeAction),
        operations: newOperations
      };
      
      onChange(updatedAction, newOperations.length > 0);
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
      
      onChange(updatedAction, newOperations.length > 0);
    }
  };
  
  // 更新整理操作
  const handleUpdateOperation = (index: number, field: string, value: any) => {
    const newOperations = [...operations];
    
    if (field === 'operation') {
      newOperations[index].operation = value;
    } else if (field.startsWith('filters.')) {
      const filterField = field.split('.')[1];
      if (!newOperations[index].filters) {
        newOperations[index].filters = {};
      }
      (newOperations[index].filters! as any)[filterField] = value;
    } else if (field === 'target') {
      newOperations[index].target = value;
    } else if (field === 'newName') {
      newOperations[index].newName = value;
    }
    
    setOperations(newOperations);
    
    if (action.type === ActionType.ORGANIZE) {
      const updatedAction: OrganizeAction = {
        ...(action as OrganizeAction),
        operations: newOperations
      };
      
      onChange(updatedAction, newOperations.length > 0);
    }
  };
  
  // 处理自定义描述更改
  const handleCustomDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCustomDescription(value);
    
    if (action.type === ActionType.CUSTOM) {
      const updatedAction: CustomAction = {
        ...(action as CustomAction),
        description: value
      };
      
      onChange(updatedAction, !!value.trim());
    }
  };
  
  // 渲染备份操作表单
  const renderBackupForm = () => {
    return (
      <Box sx={{ mt: 1 }}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <FormControl size="small" fullWidth margin="dense">
              <InputLabel>备份操作</InputLabel>
              <Select
                value={backupOperation}
                onChange={handleBackupOperationChange}
                label="备份操作"
              >
                <MenuItem value="backup">上传备份</MenuItem>
                <MenuItem value="restore">下载恢复</MenuItem>
              </Select>
              <FormHelperText>
                选择上传书签或从备份恢复
              </FormHelperText>
            </FormControl>
          </Grid>
          
          {backupOperation === 'backup' && (
            <>
              <Grid item xs={12}>
                <TextField
                  label="提交消息"
                  fullWidth
                  value={commitMessage}
                  onChange={handleCommitMessageChange}
                  helperText="备份时的GitHub提交消息"
                  margin="dense"
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeMetadata}
                      onChange={handleIncludeMetadataChange}
                      color="primary"
                      size="small"
                    />
                  }
                  label="包含元数据"
                />
                <FormHelperText sx={{ mt: 0 }}>
                  包含书签的创建时间、访问频率等附加信息
                </FormHelperText>
              </Grid>
            </>
          )}
          
          {backupOperation === 'restore' && (
            <Grid item xs={12}>
              <TextField
                label="备份文件路径"
                fullWidth
                value={backupFilePath}
                onChange={handleBackupFilePathChange}
                helperText="留空使用最新备份，或填入特定备份文件路径"
                margin="dense"
                size="small"
              />
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };
  
  // 渲染整理操作表单
  const renderOrganizeForm = () => {
    return (
      <Box sx={{ mt: 1 }}>
        {operations.length === 0 ? (
          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <FormHelperText>尚未添加整理操作</FormHelperText>
          </Box>
        ) : (
          operations.map((op, index) => (
            <Box key={index} sx={{ mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={9}>
                  <FormControl size="small" fullWidth margin="dense">
                    <InputLabel>操作类型</InputLabel>
                    <Select
                      value={op.operation}
                      onChange={(e) => handleUpdateOperation(index, 'operation', e.target.value)}
                      label="操作类型"
                    >
                      <MenuItem value="move">移动书签</MenuItem>
                      <MenuItem value="delete">删除书签</MenuItem>
                      <MenuItem value="rename">重命名书签</MenuItem>
                      <MenuItem value="validate">验证书签</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3} sx={{ textAlign: 'right' }}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteOperation(index)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
                
                {/* 根据操作类型显示相应的配置项 */}
                {op.operation === 'move' && (
                  <Grid item xs={12}>
                    <TextField
                      label="目标文件夹"
                      fullWidth
                      value={op.target || ''}
                      onChange={(e) => handleUpdateOperation(index, 'target', e.target.value)}
                      helperText="书签将被移动到的目标文件夹"
                      size="small"
                      margin="dense"
                    />
                  </Grid>
                )}
                
                {op.operation === 'rename' && (
                  <Grid item xs={12}>
                    <TextField
                      label="新名称格式"
                      fullWidth
                      value={op.newName || ''}
                      onChange={(e) => handleUpdateOperation(index, 'newName', e.target.value)}
                      helperText="新的命名格式，可包含变量如 {title}, {date}"
                      size="small"
                      margin="dense"
                    />
                  </Grid>
                )}
                
                {/* 通用筛选条件 */}
                <Grid item xs={12}>
                  <TextField
                    label="匹配模式"
                    fullWidth
                    value={op.filters?.pattern || ''}
                    onChange={(e) => handleUpdateOperation(index, 'filters.pattern', e.target.value)}
                    helperText="URL或标题匹配模式，留空匹配所有"
                    size="small"
                    margin="dense"
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <TextField
                    label="早于(天)"
                    type="number"
                    fullWidth
                    value={op.filters?.olderThan || ''}
                    onChange={(e) => handleUpdateOperation(index, 'filters.olderThan', e.target.value === '' ? undefined : Number(e.target.value))}
                    helperText="早于指定天数的书签"
                    size="small"
                    margin="dense"
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <TextField
                    label="晚于(天)"
                    type="number"
                    fullWidth
                    value={op.filters?.newerThan || ''}
                    onChange={(e) => handleUpdateOperation(index, 'filters.newerThan', e.target.value === '' ? undefined : Number(e.target.value))}
                    helperText="晚于指定天数的书签"
                    size="small"
                    margin="dense"
                  />
                </Grid>
              </Grid>
            </Box>
          ))
        )}
        
        <Button
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleAddOperation}
          variant="outlined"
          size="small"
          fullWidth
          sx={{ mt: 0.5 }}
        >
          添加整理操作
        </Button>
      </Box>
    );
  };
  
  // 渲染自定义操作表单
  const renderCustomForm = () => {
    return (
      <Box sx={{ mt: 1 }}>
        <TextField
          label="操作描述"
          fullWidth
          value={customDescription}
          onChange={handleCustomDescriptionChange}
          helperText="自定义操作的描述文本"
          margin="dense"
          size="small"
        />
        <FormHelperText sx={{ mt: 0.5 }}>
          自定义操作功能正在开发中，暂不可用
        </FormHelperText>
      </Box>
    );
  };
  
  // 根据操作类型渲染相应的表单
  const renderActionForm = () => {
    switch (actionType) {
      case ActionType.BACKUP:
        return renderBackupForm();
      case ActionType.ORGANIZE:
        return renderOrganizeForm();
      case ActionType.CUSTOM:
        return renderCustomForm();
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{ py: 0.5 }}>
      <FormControl fullWidth size="small" margin="dense">
        <InputLabel id="action-type-label">操作类型</InputLabel>
        <Select
          labelId="action-type-label"
          value={actionType}
          onChange={handleActionTypeChange}
          label="操作类型"
        >
          <MenuItem value={ActionType.BACKUP}>备份书签</MenuItem>
          <MenuItem value={ActionType.ORGANIZE}>整理书签</MenuItem>
          <MenuItem value={ActionType.CUSTOM}>自定义操作</MenuItem>
        </Select>
      </FormControl>
      
      {renderActionForm()}
    </Box>
  );
};

export default TaskActionForm; 