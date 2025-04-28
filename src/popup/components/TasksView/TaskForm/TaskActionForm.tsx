import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
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
    } else if (action.type === ActionType.ORGANIZE) {
      setOperations((action as OrganizeAction).operations);
    } else if (action.type === ActionType.CUSTOM) {
      setCustomDescription((action as CustomAction).description);
    }
  }, [action]);
  
  // 处理操作类型更改
  const handleActionTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as ActionType;
    setActionType(newType);
    
    let newAction: Action;
    switch (newType) {
      case ActionType.BACKUP:
        newAction = createBackupAction();
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
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label="提交消息"
            fullWidth
            value={commitMessage}
            onChange={handleCommitMessageChange}
            helperText="备份时的GitHub提交消息"
            margin="normal"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeMetadata}
                onChange={handleIncludeMetadataChange}
                color="primary"
              />
            }
            label="包含元数据"
          />
          <FormHelperText>
            包括创建日期、最后访问时间等额外信息
          </FormHelperText>
        </Grid>
      </Grid>
    );
  };
  
  // 渲染整理操作表单
  const renderOrganizeForm = () => {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2">
              整理操作 ({operations.length})
            </Typography>
            <Button
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleAddOperation}
              size="small"
              variant="outlined"
            >
              添加操作
            </Button>
          </Box>
          
          {operations.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
              暂无整理操作，点击"添加操作"按钮创建新操作
            </Typography>
          ) : (
            operations.map((op, index) => (
              <Box
                key={index}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  mb: 2
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">
                    操作 #{index + 1}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteOperation(index)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                
                <FormControl fullWidth margin="dense">
                  <InputLabel>操作类型</InputLabel>
                  <Select
                    value={op.operation}
                    onChange={(e) => handleUpdateOperation(index, 'operation', e.target.value)}
                    label="操作类型"
                  >
                    <MenuItem value="move">移动</MenuItem>
                    <MenuItem value="delete">删除</MenuItem>
                    <MenuItem value="rename">重命名</MenuItem>
                    <MenuItem value="validate">验证</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  label="URL或标题匹配模式"
                  fullWidth
                  value={op.filters?.pattern || ''}
                  onChange={(e) => handleUpdateOperation(index, 'filters.pattern', e.target.value)}
                  helperText="使用通配符(*)匹配书签URL或标题"
                  margin="dense"
                />
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="早于指定天数"
                      type="number"
                      fullWidth
                      value={op.filters?.olderThan || ''}
                      onChange={(e) => handleUpdateOperation(index, 'filters.olderThan', parseInt(e.target.value, 10))}
                      helperText="仅处理创建超过指定天数的书签"
                      margin="dense"
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="晚于指定天数"
                      type="number"
                      fullWidth
                      value={op.filters?.newerThan || ''}
                      onChange={(e) => handleUpdateOperation(index, 'filters.newerThan', parseInt(e.target.value, 10))}
                      helperText="仅处理最近指定天数内创建的书签"
                      margin="dense"
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                </Grid>
                
                {op.operation === 'move' && (
                  <TextField
                    label="目标文件夹ID"
                    fullWidth
                    value={op.target || ''}
                    onChange={(e) => handleUpdateOperation(index, 'target', e.target.value)}
                    helperText="移动书签到此文件夹"
                    margin="dense"
                  />
                )}
                
                {op.operation === 'rename' && (
                  <TextField
                    label="新名称"
                    fullWidth
                    value={op.newName || ''}
                    onChange={(e) => handleUpdateOperation(index, 'newName', e.target.value)}
                    helperText="可以使用{title}、{url}等作为模板变量"
                    margin="dense"
                  />
                )}
              </Box>
            ))
          )}
        </Grid>
      </Grid>
    );
  };
  
  // 渲染自定义操作表单
  const renderCustomForm = () => {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label="操作描述"
            fullWidth
            value={customDescription}
            onChange={handleCustomDescriptionChange}
            helperText="描述此自定义操作的功能"
            margin="normal"
          />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary">
            自定义操作功能将在后续版本中提供更多功能。
          </Typography>
        </Grid>
      </Grid>
    );
  };
  
  return (
    <Box sx={{ py: 1 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle1">操作类型</Typography>
          <RadioGroup
            name="action-type"
            value={actionType}
            onChange={handleActionTypeChange}
          >
            <FormControlLabel 
              value={ActionType.BACKUP} 
              control={<Radio />} 
              label="备份书签" 
            />
            <FormControlLabel 
              value={ActionType.ORGANIZE} 
              control={<Radio />} 
              label="整理书签" 
            />
            <FormControlLabel 
              value={ActionType.CUSTOM} 
              control={<Radio />} 
              label="自定义操作" 
            />
          </RadioGroup>
        </Grid>
        
        <Grid item xs={12}>
          <Divider />
        </Grid>
        
        <Grid item xs={12}>
          {actionType === ActionType.BACKUP && renderBackupForm()}
          {actionType === ActionType.ORGANIZE && renderOrganizeForm()}
          {actionType === ActionType.CUSTOM && renderCustomForm()}
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaskActionForm; 