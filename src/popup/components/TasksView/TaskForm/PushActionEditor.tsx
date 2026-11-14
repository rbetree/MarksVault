import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface PushActionEditorProps {
  repoName: string;
  folderPath: string;
  commitMessage: string;
  onRepoNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFolderPathChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCommitMessageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * 推送书签操作配置表单
 */
const PushActionEditor: React.FC<PushActionEditorProps> = ({
  repoName,
  folderPath,
  commitMessage,
  onRepoNameChange,
  onFolderPathChange,
  onCommitMessageChange
}) => {
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
          推送书签配置
        </Typography>

        <Box
          sx={{
            mb: 2,
            p: 1.5,
            bgcolor: 'rgba(3, 169, 244, 0.05)',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'rgba(3, 169, 244, 0.2)',
          }}
        >
          <Typography variant="body2" color="info.main" sx={{ mb: 1, fontWeight: 500 }}>
            关于本操作：将当前浏览器书签推送至指定仓库
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5, fontSize: '0.8rem' }}>
            作用：方便 <a href="https://github.com/rbetree/menav" target="_blank" rel="noopener noreferrer" style={{color: 'inherit', textDecoration: 'underline'}}>menav-个人导航站</a> 项目的“书签导入”功能
          </Typography>
        </Box>

        <TextField
          fullWidth
          size="small"
          margin="normal"
          label="目标仓库名称"
          variant="outlined"
          value={repoName}
          onChange={onRepoNameChange}
          helperText="推送的目标GitHub仓库名称，默认为menav"
          InputLabelProps={{
            shrink: true,
          }}
        />

        <TextField
          fullWidth
          size="small"
          margin="normal"
          label="目标文件夹路径"
          variant="outlined"
          value={folderPath}
          onChange={onFolderPathChange}
          helperText="目标文件夹路径，默认为bookmarks"
          InputLabelProps={{
            shrink: true,
          }}
        />

        <TextField
          fullWidth
          size="small"
          margin="normal"
          label="提交消息"
          variant="outlined"
          value={commitMessage}
          onChange={onCommitMessageChange}
          helperText="GitHub提交消息，描述此次推送"
          InputLabelProps={{
            shrink: true,
          }}
        />
      </Box>
    </Box>
  );
};

export default PushActionEditor;
