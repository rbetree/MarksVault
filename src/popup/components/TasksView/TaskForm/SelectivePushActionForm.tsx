import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SelectivePushAction } from '../../../../types/task';

interface SelectivePushActionFormProps {
  action: SelectivePushAction;
  onChange: (action: SelectivePushAction) => void;
  onValidation?: (isValid: boolean) => void;
}

/**
 * 选择性推送操作表单组件
 * 用于配置SELECTIVE_PUSH动作的专用表单
 */
const SelectivePushActionForm: React.FC<SelectivePushActionFormProps> = ({
  action,
  onChange,
  onValidation
}) => {
  // 表单字段状态
  const [repoName, setRepoName] = useState<string>(action.options.repoName || 'menav');
  const [folderPath, setFolderPath] = useState<string>(action.options.folderPath || 'bookmarks');
  const [commitMessage, setCommitMessage] = useState<string>(action.options.commitMessage || '选择性推送书签');
  
  // 表单验证错误
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!repoName.trim()) {
      newErrors.repoName = '仓库名称不能为空';
    }
    
    if (!folderPath.trim()) {
      newErrors.folderPath = '文件夹路径不能为空';
    }
    
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    
    // 通知父组件验证状态
    if (onValidation) {
      onValidation(isValid);
    }
    
    return isValid;
  };

  // 当表单数据变化时,更新action并验证
  useEffect(() => {
    const updatedAction: SelectivePushAction = {
      ...action,
      options: {
        ...action.options,
        repoName,
        folderPath,
        commitMessage
      }
    };
    
    onChange(updatedAction);
    validateForm();
  }, [repoName, folderPath, commitMessage]);

  // 处理仓库名称变更
  const handleRepoNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRepoName(event.target.value);
  };

  // 处理文件夹路径变更
  const handleFolderPathChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFolderPath(event.target.value);
  };

  // 处理提交消息变更
  const handleCommitMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCommitMessage(event.target.value);
  };

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
          选择性推送配置
        </Typography>

        <Box
          sx={{
            mb: 2,
            p: 1.5,
            bgcolor: 'rgba(3, 169, 244, 0.05)',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'rgba(3, 169, 244, 0.2)'
          }}
        >
          <Typography variant="body2" color="info.main" sx={{ mb: 0.5, fontWeight: 500 }}>
            关于本操作
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            配置推送参数后，点击任务卡片的“运行”按钮来选择要推送的书签
          </Typography>
        </Box>

        <Stack spacing={2}>
          <TextField
            fullWidth
            size="small"
            label="目标仓库名称"
            variant="outlined"
            value={repoName}
            onChange={handleRepoNameChange}
            error={!!errors.repoName}
            helperText={errors.repoName || '推送的目标GitHub仓库名称'}
            required
            InputLabelProps={{
              shrink: true
            }}
          />

          <TextField
            fullWidth
            size="small"
            label="目标文件夹路径"
            variant="outlined"
            value={folderPath}
            onChange={handleFolderPathChange}
            error={!!errors.folderPath}
            helperText={errors.folderPath || '仓库中的目标文件夹路径'}
            required
            InputLabelProps={{
              shrink: true
            }}
          />

          <TextField
            fullWidth
            size="small"
            label="提交消息"
            variant="outlined"
            value={commitMessage}
            onChange={handleCommitMessageChange}
            helperText="GitHub提交消息,描述此次推送"
            InputLabelProps={{
              shrink: true
            }}
          />
        </Stack>
      </Box>
    </Box>
  );
};

export default SelectivePushActionForm;
