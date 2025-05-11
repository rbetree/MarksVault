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
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import BackupIcon from '@mui/icons-material/Backup';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CodeIcon from '@mui/icons-material/Code';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import FolderIcon from '@mui/icons-material/Folder';
import { 
  Action, 
  ActionType, 
  BackupAction, 
  OrganizeAction, 
  CustomAction,
  createBackupAction,
  createOrganizeAction
} from '../../../../types/task';
import { Radio, RadioGroup } from '@mui/material';
import { Typography } from '@mui/material';
import { Divider } from '@mui/material';
import bookmarkService from '../../../../utils/bookmark-service';

// 文件夹选项接口
interface FolderOption {
  id: string;         // 文件夹ID
  title: string;      // 文件夹名称
  fullPath: string;   // 完整路径，如 "书签栏/工作/项目"
  depth: number;      // 嵌套深度，用于UI缩进显示
}

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
  const handleActionTypeChange = (newType: ActionType) => {
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
    
    // 添加新操作时标记目标文件夹为必填
    const newErrors = { ...errors };
    newErrors[`operation_${newOperations.length - 1}_target`] = '移动操作需要指定目标文件夹';
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
      
      onChange(updatedAction, newOperations.length > 0);
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
        newErrors[`operation_${index}_target`] = '移动操作需要指定目标文件夹';
      } else {
        delete newErrors[`operation_${index}_target`];
      }
    } else if (field.startsWith('filters.')) {
      const filterField = field.split('.')[1];
      if (!newOperations[index].filters) {
        newOperations[index].filters = {};
      }
      (newOperations[index].filters! as any)[filterField] = value;
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
        newErrors[`operation_${index}_target`] = '移动操作需要指定目标文件夹';
      }
    } else if (field === 'newName') {
      newOperations[index].newName = value;
      // 验证重命名和标签操作的新名称
      if ((newOperations[index].operation === 'rename' || newOperations[index].operation === 'tag') && !value) {
        newErrors[`operation_${index}_newName`] = `${newOperations[index].operation === 'rename' ? '重命名' : '标签'}操作需要指定${newOperations[index].operation === 'rename' ? '新名称' : '标签名称'}`;
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
      const updatedAction: OrganizeAction = {
        ...(action as OrganizeAction),
        operations: newOperations
      };
      
      onChange(updatedAction, isValid && newOperations.length > 0);
    }
  };
  
  // 验证所有整理操作
  const validateOperations = (ops: OrganizeAction['operations']): boolean => {
    const newErrors = { ...errors };
    let isValid = true;
    
    // 清除旧的操作相关错误
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith('operation_')) {
        delete newErrors[key];
      }
    });
    
    // 验证每个操作
    ops.forEach((op, index) => {
      // 验证移动操作必须有目标文件夹
      if (op.operation === 'move' && !op.target) {
        newErrors[`operation_${index}_target`] = '移动操作需要指定目标文件夹';
        isValid = false;
      }
      
      // 验证重命名和标签操作必须有新名称
      if ((op.operation === 'rename' || op.operation === 'tag') && !op.newName) {
        newErrors[`operation_${index}_newName`] = `${op.operation === 'rename' ? '重命名' : '标签'}操作需要指定${op.operation === 'rename' ? '新名称' : '标签名称'}`;
        isValid = false;
      }
    });
    
    setErrors(newErrors);
    return isValid;
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
      <Box sx={{ mt: 0 }}>
        <Box 
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            备份操作配置
          </Typography>
          
          <FormControl component="fieldset" size="small" fullWidth sx={{ mb: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              备份操作类型:
            </Typography>
            <RadioGroup
              row
              name="backup-operation"
              value={backupOperation}
              onChange={handleBackupOperationChange}
            >
              <FormControlLabel 
                value="backup" 
                control={<Radio size="small" />} 
                label={<Typography variant="body2">备份书签</Typography>} 
                sx={{ mr: 3 }}
              />
              <FormControlLabel 
                value="restore" 
                control={<Radio size="small" />} 
                label={<Typography variant="body2">恢复书签</Typography>} 
              />
            </RadioGroup>
          </FormControl>
          
          <Divider sx={{ my: 1.5 }} />
          
          {backupOperation === 'backup' ? (
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <TextField
                  label="提交信息"
                  fullWidth
                  size="small"
                  value={commitMessage}
                  onChange={handleCommitMessageChange}
                  placeholder="例如: 每日备份"
                  margin="dense"
                  helperText="提交到GitHub仓库时使用的提交信息"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={includeMetadata} 
                      onChange={handleIncludeMetadataChange}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">包含元数据 (创建时间、访问频率等)</Typography>}
                />
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <TextField
                  label="备份文件路径"
                  fullWidth
                  size="small"
                  value={backupFilePath}
                  onChange={handleBackupFilePathChange}
                  placeholder="留空则使用最新备份"
                  margin="dense"
                  helperText="如果留空，则使用最新的备份文件进行恢复"
                />
              </Grid>
            </Grid>
          )}
        </Box>
      </Box>
    );
  };
  
  // 渲染整理操作表单
  const renderOrganizeForm = () => {
    return (
      <Box sx={{ mt: 0 }}>
        <Box 
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            整理操作配置
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            添加书签整理规则：
          </Typography>
          
          {operations.length === 0 ? (
            <Box 
              sx={{
                p: 1.5,
                mb: 1.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                textAlign: 'center',
                color: 'text.secondary'
              }}
            >
              <Typography variant="body2">
                暂无整理规则，请点击下方按钮添加
              </Typography>
            </Box>
          ) : (
            operations.map((op, index) => (
              <Box 
                key={index} 
                sx={{
                  mb: 2,
                  mt: 1,
                }}
              >
                <Grid container spacing={1.5} alignItems="center">
                  <Grid item xs={10}>
                    <FormControl fullWidth size="small" margin="dense">
                      <InputLabel>操作</InputLabel>
                      <Select
                        value={op.operation}
                        onChange={(e) => handleUpdateOperation(index, 'operation', e.target.value)}
                        label="操作"
                      >
                        <MenuItem value="move">移动书签</MenuItem>
                        <MenuItem value="rename">重命名书签</MenuItem>
                        <MenuItem value="tag">添加标签</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={2} sx={{ textAlign: 'right' }}>
                    <IconButton 
                      onClick={() => handleDeleteOperation(index)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      margin="dense"
                      label="匹配规则"
                      placeholder="例如: *google*"
                      value={op.filters?.pattern || ''}
                      onChange={(e) => handleUpdateOperation(index, 'filters.pattern', e.target.value)}
                      helperText="支持通配符 * 匹配书签标题或URL"
                    />
                  </Grid>
                  
                  {op.operation === 'move' && (
                    <Grid item xs={12}>
                      <Autocomplete
                        id={`folder-select-${index}`}
                        options={folders}
                        fullWidth
                        size="small"
                        loading={foldersLoading}
                        getOptionLabel={(option) => option.fullPath}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        value={selectedFolders[index] || null}
                        onChange={(_, newValue) => handleUpdateOperation(index, 'target', newValue)}
                        freeSolo={false}
                        autoHighlight
                        openOnFocus={false}
                        filterOptions={(options, state) => {
                          const inputValue = state.inputValue.toLowerCase().trim();
                          if (!inputValue) return []; // 无输入时不显示选项
                          
                          return options.filter(option => 
                            option.title.toLowerCase().includes(inputValue) || 
                            option.fullPath.toLowerCase().includes(inputValue)
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="目标文件夹"
                            placeholder="输入文件夹名称筛选"
                            error={!!errors[`operation_${index}_target`]}
                            helperText={errors[`operation_${index}_target`] || "输入文件夹名称进行筛选后选择"}
                            required
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <React.Fragment>
                                  {foldersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                </React.Fragment>
                              ),
                              startAdornment: (
                                <React.Fragment>
                                  <FolderIcon color="action" sx={{ ml: 0.5, mr: 1 }} />
                                </React.Fragment>
                              )
                            }}
                          />
                        )}
                        renderOption={(props, option) => {
                          // 从props中提取key属性，其余属性放入rest
                          const { key, ...rest } = props;
                          
                          return (
                            <li key={key} {...rest} style={{padding: '1px 8px', minHeight: '22px'}}>
                              <Box component="span" sx={{ 
                                pl: option.depth * 1, 
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: '0.8rem',
                                py: 0
                              }}>
                                <FolderIcon fontSize="small" sx={{ mr: 0.5, color: 'action.active', fontSize: '0.9rem' }} />
                                <Box component="span" sx={{
                                  maxWidth: '200px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {option.title}
                                </Box>
                                <Box component="span" sx={{
                                  ml: 0.5, 
                                  color: 'text.secondary',
                                  fontSize: '0.7rem',
                                  fontStyle: 'italic',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  ({option.fullPath})
                                </Box>
                              </Box>
                            </li>
                          );
                        }}
                        ListboxProps={{
                          style: { 
                            maxHeight: '200px',
                          }
                        }}
                      />
                    </Grid>
                  )}
                  
                  {op.operation === 'rename' && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        margin="dense"
                        label="新名称格式"
                        placeholder="例如: [前缀]书签名"
                        value={op.newName || ''}
                        onChange={(e) => handleUpdateOperation(index, 'newName', e.target.value)}
                        helperText={errors[`operation_${index}_newName`] || "可以使用{name}引用原书签名"}
                        error={!!errors[`operation_${index}_newName`]}
                        required
                      />
                    </Grid>
                  )}
                  
                  {op.operation === 'tag' && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        margin="dense"
                        label="标签名称"
                        placeholder="例如: 工作"
                        value={op.newName || ''}
                        onChange={(e) => handleUpdateOperation(index, 'newName', e.target.value)}
                        helperText={errors[`operation_${index}_newName`] || "要添加的标签名称"}
                        error={!!errors[`operation_${index}_newName`]}
                        required
                      />
                    </Grid>
                  )}
                </Grid>
                {index < operations.length - 1 && (
                  <Divider sx={{ mt: 2 }} />
                )}
              </Box>
            ))
          )}
          
          <Button
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleAddOperation}
            variant="outlined"
            size="small"
            sx={{ mt: 0.5 }}
          >
            添加操作
          </Button>
        </Box>
      </Box>
    );
  };
  
  // 渲染自定义操作表单
  const renderCustomForm = () => {
    return (
      <Box sx={{ mt: 0 }}>
        <Box 
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            自定义操作配置
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            自定义操作设置:
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            margin="dense"
            disabled
            label="自定义操作描述"
            value={customDescription}
            onChange={handleCustomDescriptionChange}
            helperText="自定义操作功能正在开发中，暂不可用"
          />
        </Box>
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

  // 操作类型选项定义
  const actionTypeOptions = [
    { 
      type: ActionType.BACKUP, 
      title: "同步书签", 
      description: "",
      icon: <BackupIcon fontSize="medium" />
    },
    { 
      type: ActionType.ORGANIZE, 
      title: "整理书签", 
      description: "",
      icon: <CleaningServicesIcon fontSize="medium" />
    },
    { 
      type: ActionType.CUSTOM, 
      title: "开发中", 
      description: "",
      icon: <CodeIcon fontSize="medium" />
    }
  ];
  
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {actionTypeOptions.map((option) => (
          <Grid item xs={4} key={option.type}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                height: '100%',
                borderColor: actionType === option.type ? 'primary.main' : 'divider',
                borderWidth: actionType === option.type ? 2 : 1,
                borderStyle: 'solid',
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: actionType === option.type ? 1 : 0
              }}
              onClick={() => handleActionTypeChange(option.type)}
            >
              <CardContent sx={{ p: 1.5, textAlign: 'center', '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ 
                  width: '40px',
                  height: '40px',
                  margin: '0 auto 10px',
                  mb: 1.5,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: actionType === option.type ? 'primary.main' : 'text.secondary',
                  backgroundColor: actionType === option.type ? 'action.selected' : 'transparent'
                }}>
                  {option.icon}
                </Box>
                <Typography variant="body1" component="div" sx={{ fontWeight: 500 }}>
                  {option.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '10px', mt: 0.5 }}>
                  {option.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
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