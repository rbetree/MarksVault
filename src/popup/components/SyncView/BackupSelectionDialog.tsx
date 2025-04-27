import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { GitHubCredentials } from '../../../utils/storage-service';
import githubService from '../../../services/github-service';

interface BackupFile {
  name: string;
  path: string;
  size: number;
  timestamp: string; // 解析后的可读时间戳
  rawTimestamp: string; // 原始时间戳字符串
}

interface BackupSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (filePath: string) => void;
  credentials: GitHubCredentials;
  username: string;
  repoName: string;
}

const BackupSelectionDialog: React.FC<BackupSelectionDialogProps> = ({
  open,
  onClose,
  onSelect,
  credentials,
  username,
  repoName
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // 从文件名中提取并格式化时间戳
  const parseTimestampFromFilename = (filename: string): { formatted: string; raw: string } => {
    // 格式: bookmark_backup_YYYYMMDDHHMMSS.json
    const match = filename.match(/bookmark_backup_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.json/);
    
    if (match) {
      const [_, year, month, day, hour, minute, second] = match;
      const raw = `${year}${month}${day}${hour}${minute}${second}`;
      const formatted = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      return { formatted, raw };
    }
    
    return { formatted: '未知时间', raw: '0' };
  };

  // 加载备份文件列表
  useEffect(() => {
    const fetchBackupFiles = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const files = await githubService.getRepositoryFiles(
          credentials,
          username,
          repoName
        );
        
        // 只过滤书签备份文件
        const backupFiles = files
          .filter(file => file.name.startsWith('bookmark_backup_') && file.name.endsWith('.json'))
          .map(file => {
            const { formatted, raw } = parseTimestampFromFilename(file.name);
            return {
              name: file.name,
              path: file.path,
              size: file.size,
              timestamp: formatted,
              rawTimestamp: raw
            };
          })
          // 按时间戳从新到旧排序
          .sort((a, b) => b.rawTimestamp.localeCompare(a.rawTimestamp));
        
        setBackupFiles(backupFiles);
      } catch (error) {
        console.error('加载备份文件列表失败:', error);
        setError('无法加载备份文件列表。请检查您的连接和权限。');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchBackupFiles();
    }
  }, [open, credentials, username, repoName]);

  // 选择文件并关闭对话框
  const handleSelect = () => {
    if (selectedFile) {
      onSelect(selectedFile);
    }
    onClose();
  };

  // 计算文件大小的可读格式
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="backup-selection-dialog-title"
    >
      <DialogTitle id="backup-selection-dialog-title">
        选择要恢复的备份
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ p: 2 }}>
            {error}
          </Typography>
        ) : backupFiles.length === 0 ? (
          <Typography sx={{ p: 2 }}>
            没有找到可用的备份文件。
          </Typography>
        ) : (
          <List sx={{ width: '100%' }}>
            {backupFiles.map((file) => (
              <React.Fragment key={file.path}>
                <ListItem disablePadding>
                  <ListItemButton 
                    selected={selectedFile === file.path}
                    onClick={() => setSelectedFile(file.path)}
                  >
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <AccessTimeIcon fontSize="small" sx={{ mr: 1 }} />
                          {file.timestamp}
                        </Box>
                      }
                      secondary={`文件大小: ${formatFileSize(file.size)}`}
                    />
                  </ListItemButton>
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button 
          onClick={handleSelect} 
          disabled={!selectedFile || loading}
          variant="contained" 
          color="primary"
        >
          恢复选中的备份
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BackupSelectionDialog; 