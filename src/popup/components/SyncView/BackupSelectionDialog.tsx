import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteIcon from '@mui/icons-material/Delete';
import { GitHubCredentials } from '../../../utils/storage-service';
import githubService from '../../../services/github-service';

interface BackupFile {
  name: string;
  path: string;
  size: number;
  timestamp: string; // 解析后的可读时间戳
  rawTimestamp: string; // 原始时间戳字符串
  sha: string; // 用于删除文件
}

interface BackupSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (filePath: string) => void;
  credentials: GitHubCredentials;
  username: string;
  repoName: string;
  onRefreshRef?: React.MutableRefObject<(() => void) | null>;
}

const BackupSelectionDialog: React.FC<BackupSelectionDialogProps> = ({
  open,
  onClose,
  onSelect,
  credentials,
  username,
  repoName,
  onRefreshRef
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<BackupFile | null>(null);

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
  const loadBackupFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const files = await githubService.getRepositoryFiles(
        credentials,
        username,
        repoName,
        'bookmarks' // 指定从bookmarks文件夹获取文件
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
            rawTimestamp: raw,
            sha: file.sha  // 保存SHA值，用于删除
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

  // 确保每次打开对话框时都重新加载文件列表
  useEffect(() => {
    if (open) {
      // 重置状态并加载文件列表
      setSelectedFile(null);
      setError(null);
      loadBackupFiles();
    }
  }, [open, credentials, username, repoName]);

  // 选择文件并关闭对话框
  const handleSelect = () => {
    if (selectedFile) {
      onSelect(selectedFile);
    }
    onClose();
  };

  // 打开删除确认对话框
  const handleDeleteClick = (event: React.MouseEvent, file: BackupFile) => {
    event.stopPropagation(); // 阻止事件冒泡，避免触发选择
    setFileToDelete(file);
    setDeleteConfirmOpen(true);
  };

  // 关闭删除确认对话框
  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  };

  // 执行删除操作
  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    
    setDeleteConfirmOpen(false);
    setDeletingFile(fileToDelete.path);
    
    try {
      await githubService.deleteFile(
        credentials,
        username,
        repoName,
        fileToDelete.path,
        `删除备份文件 ${fileToDelete.name}`,
        fileToDelete.sha
      );
      
      // 从列表中移除已删除的文件
      setBackupFiles(prev => prev.filter(file => file.path !== fileToDelete.path));
      
      // 如果删除的是当前选中的文件，清除选择
      if (selectedFile === fileToDelete.path) {
        setSelectedFile(null);
      }
      
      // 添加延迟后重新加载文件列表，确保GitHub API同步完成
      setTimeout(() => {
        loadBackupFiles();
      }, 1000);
    } catch (error) {
      console.error('删除文件失败:', error);
      setError(`删除文件失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDeletingFile(null);
      setFileToDelete(null);
    }
  };

  // 计算文件大小的可读格式
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 添加一个方法供父组件调用，用于手动刷新文件列表
  const refreshFileList = () => {
    if (open) {
      loadBackupFiles();
    }
  };

  // 设置刷新方法的引用，供父组件使用
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = refreshFileList;
    }
    
    return () => {
      if (onRefreshRef) {
        onRefreshRef.current = null;
      }
    };
  }, [onRefreshRef]);

  return (
    <>
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
                  <ListItem 
                    disablePadding
                    secondaryAction={
                      <IconButton 
                        edge="end"
                        aria-label="delete"
                        onClick={(e) => handleDeleteClick(e, file)}
                        disabled={deletingFile === file.path}
                      >
                        {deletingFile === file.path ? 
                          <CircularProgress size={20} /> : 
                          <DeleteIcon color="error" />
                        }
                      </IconButton>
                    }
                  >
                    <ListItemButton
                      selected={selectedFile === file.path}
                      onClick={() => setSelectedFile(file.path)}
                      sx={{ pr: 6 }} // 为删除按钮留出空间
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

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          确认删除备份
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            您确定要删除这个备份吗？该操作不可恢复。
            {fileToDelete && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  备份时间：{fileToDelete.timestamp}
                </Typography>
                <Typography variant="body2">
                  文件大小：{formatFileSize(fileToDelete.size)}
                </Typography>
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            取消
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BackupSelectionDialog; 