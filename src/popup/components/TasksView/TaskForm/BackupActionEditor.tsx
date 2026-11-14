import React from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';

interface BackupActionEditorProps {
  operation: 'backup' | 'restore';
  commitMessage: string;
  includeMetadata: boolean;
  backupFilePath: string;
  onOperationChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCommitMessageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onIncludeMetadataChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBackupFilePathChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * 备份/恢复操作配置表单
 */
const BackupActionEditor: React.FC<BackupActionEditorProps> = ({
  operation,
  commitMessage,
  includeMetadata,
  backupFilePath,
  onOperationChange,
  onCommitMessageChange,
  onIncludeMetadataChange,
  onBackupFilePathChange
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
          备份/恢复配置
        </Typography>

        <FormControl component="fieldset" size="small" fullWidth sx={{ mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            操作类型:
          </Typography>
          <RadioGroup
            row
            name="backup-operation"
            value={operation}
            onChange={onOperationChange}
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

        {operation === 'backup' ? (
          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <TextField
                label="提交信息"
                fullWidth
                size="small"
                value={commitMessage}
                onChange={onCommitMessageChange}
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
                    onChange={onIncludeMetadataChange}
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
                onChange={onBackupFilePathChange}
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

export default BackupActionEditor;
