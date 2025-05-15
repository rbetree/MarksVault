import React, { useState, useRef, useEffect } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import GitHubIcon from '@mui/icons-material/GitHub';
import SettingsIcon from '@mui/icons-material/Settings';
import WarningIcon from '@mui/icons-material/Warning';
import { ToastRef } from '../shared/Toast';
import storageService from '../../../utils/storage-service';
import backupService, { BackupType } from '../../../services/backup-service';
import githubService from '../../../services/github-service';
import { BackupStatus } from '../../../types/backup';

interface SettingsActionsProps {
  toastRef?: React.RefObject<ToastRef>;
}

/**
 * 设置页面的高级操作组件
 * 包含数据导入/导出和清除等功能
 */
const SettingsActions: React.FC<SettingsActionsProps> = ({ toastRef }) => {
  // 状态管理
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showBackupRestoreConfirm, setShowBackupRestoreConfirm] = useState(false);
  const [isGitHubBackuping, setIsGitHubBackuping] = useState(false);
  const [isGitHubRestoring, setIsGitHubRestoring] = useState(false);
  const [gitHubError, setGitHubError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({});
  const [credentialsChecked, setCredentialsChecked] = useState(false);
  const [hasGitHubCredentials, setHasGitHubCredentials] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载GitHub凭据和备份状态
  useEffect(() => {
    const loadData = async () => {
      try {
        // 检查GitHub凭据
        const credentialsResult = await storageService.getGitHubCredentials();
        setHasGitHubCredentials(credentialsResult.success && !!credentialsResult.data);
        setCredentialsChecked(true);
        
        // 如果有GitHub凭据，获取设置备份状态
        if (credentialsResult.success && credentialsResult.data) {
          const status = await backupService.getSettingsBackupStatus();
          setBackupStatus(status);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };
    
    loadData();
  }, []);

  // 处理数据清除
  const handleClearData = async () => {
    setClearing(true);
    try {
      const result = await storageService.clearAllData();
      
      if (result.success) {
        toastRef?.current?.showToast('所有数据已清除', 'success');
        setShowClearDialog(false);
      } else {
        toastRef?.current?.showToast(`清除数据失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('清除数据时出错:', error);
      toastRef?.current?.showToast('清除数据时发生错误', 'error');
    } finally {
      setClearing(false);
    }
  };

  // 处理设置导出
  const handleExportSettings = async () => {
    try {
      const settingsResult = await storageService.getSettings();
      
      if (settingsResult.success && settingsResult.data) {
        const settingsBlob = new Blob(
          [JSON.stringify(settingsResult.data, null, 2)], 
          { type: 'application/json' }
        );
        
        const url = URL.createObjectURL(settingsBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `marksvault-settings-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toastRef?.current?.showToast('设置已导出', 'success');
      } else {
        toastRef?.current?.showToast('导出设置失败', 'error');
      }
    } catch (error) {
      console.error('导出设置时出错:', error);
      toastRef?.current?.showToast('导出设置时发生错误', 'error');
    }
  };

  // 触发文件选择
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 处理设置导入
  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const settings = JSON.parse(content);
          
          // 验证设置格式
          if (!settings || typeof settings !== 'object') {
            throw new Error('无效的设置文件格式');
          }
          
          const result = await storageService.saveSettings(settings);
          
          if (result.success) {
            toastRef?.current?.showToast('设置已导入，请刷新页面以应用更改', 'success');
          } else {
            toastRef?.current?.showToast(`导入设置失败: ${result.error}`, 'error');
          }
        } catch (parseError) {
          console.error('解析设置文件时出错:', parseError);
          toastRef?.current?.showToast('无效的设置文件格式', 'error');
        }
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('导入设置时出错:', error);
      toastRef?.current?.showToast('导入设置时发生错误', 'error');
    } finally {
      // 重置文件输入，以便可以重新选择相同的文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // GitHub备份设置
  const handleGitHubBackup = async () => {
    if (!hasGitHubCredentials) {
      toastRef?.current?.showToast('请先在同步页设置GitHub凭据', 'warning');
      return;
    }
    
    setIsGitHubBackuping(true);
    setGitHubError(null);
    
    try {
      // 获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      if (!credentialsResult.success || !credentialsResult.data) {
        throw new Error('无法获取GitHub凭据，请在同步页配置');
      }
      
      // 从GitHub响应中获取用户名
      const user = await githubService.validateCredentials(credentialsResult.data);
      
      // 执行备份
      const backupResult = await backupService.backupToGitHub(
        credentialsResult.data,
        user.login,
        BackupType.SETTINGS
      );
      
      if (!backupResult.success) {
        throw new Error(backupResult.error || '备份设置到GitHub失败');
      }
      
      // 更新状态
      const status = await backupService.getSettingsBackupStatus(true);
      setBackupStatus(status);
      
      toastRef?.current?.showToast('设置已成功备份到GitHub', 'success');
    } catch (error) {
      console.error('GitHub备份设置失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGitHubError(errorMessage);
      toastRef?.current?.showToast(`GitHub备份设置失败: ${errorMessage}`, 'error');
    } finally {
      setIsGitHubBackuping(false);
    }
  };
  
  // 处理GitHub恢复确认
  const handleGitHubRestoreConfirm = () => {
    if (!hasGitHubCredentials) {
      toastRef?.current?.showToast('请先在同步页设置GitHub凭据', 'warning');
      return;
    }
    
    setShowBackupRestoreConfirm(true);
  };
  
  // 执行GitHub恢复设置
  const handleGitHubRestore = async () => {
    setShowBackupRestoreConfirm(false);
    setIsGitHubRestoring(true);
    setGitHubError(null);
    
    try {
      // 获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      if (!credentialsResult.success || !credentialsResult.data) {
        throw new Error('无法获取GitHub凭据，请在同步页配置');
      }
      
      // 从GitHub响应中获取用户名
      const user = await githubService.validateCredentials(credentialsResult.data);
      
      // 执行恢复
      const restoreResult = await backupService.restoreFromGitHub(
        credentialsResult.data,
        user.login,
        false,
        undefined,
        BackupType.SETTINGS
      );
      
      if (!restoreResult.success) {
        throw new Error(restoreResult.error || '从GitHub恢复设置失败');
      }
      
      // 更新状态
      const status = await backupService.getSettingsBackupStatus(true);
      setBackupStatus(status);
      
      toastRef?.current?.showToast('设置已从GitHub成功恢复，请刷新页面以应用更改', 'success');
    } catch (error) {
      console.error('从GitHub恢复设置失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGitHubError(errorMessage);
      toastRef?.current?.showToast(`从GitHub恢复设置失败: ${errorMessage}`, 'error');
    } finally {
      setIsGitHubRestoring(false);
    }
  };
  
  // 取消GitHub恢复设置
  const handleCancelGitHubRestore = () => {
    setShowBackupRestoreConfirm(false);
  };
  
  // 格式化时间显示
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '未知';
    
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return '格式错误';
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
      <Alert 
        severity="warning" 
        sx={{ 
          mb: 2, 
          py: 0.5, 
          '& .MuiAlert-message': { 
            fontSize: '0.75rem' 
          } 
        }}
      >
        以下操作将对数据产生永久性影响，请谨慎操作
      </Alert>
      
      {/* 设置导入/导出区域 */}
      <Paper
        variant="outlined"
        sx={{ mb: 2, p: 1.5, borderRadius: 1 }}
      >
        <List dense sx={{ p: 0 }}>
          {/* 本地导出/导入功能 */}
          <Typography variant="body2" 
            sx={{ 
              mb: 1, 
              pl: 1, 
              fontWeight: 'medium',
              fontSize: '0.8rem'
            }}
          >
            本地操作
          </Typography>
          
          <ListItem 
            sx={{ px: 1, py: 0.5 }}
            secondaryAction={
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportSettings}
                sx={{ minWidth: '90px', fontSize: '0.75rem' }}
              >
                导出
              </Button>
            }
          >
            <ListItemText 
              primary={
                <Typography variant="body2">导出到文件</Typography>
              } 
              secondary={
                <Typography variant="caption" color="text.secondary">
                  将当前设置导出为JSON文件
                </Typography>
              }
            />
          </ListItem>
          
          <ListItem 
            sx={{ px: 1, py: 0.5 }}
            secondaryAction={
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<FileUploadIcon />}
                onClick={handleImportClick}
                sx={{ minWidth: '90px', fontSize: '0.75rem' }}
              >
                导入
              </Button>
            }
          >
            <ListItemText 
              primary={
                <Typography variant="body2">从文件导入</Typography>
              } 
              secondary={
                <Typography variant="caption" color="text.secondary">
                  从JSON文件导入设置
                </Typography>
              }
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportSettings}
              aria-label="导入设置文件"
            />
          </ListItem>
          
          <Divider sx={{ my: 1 }} />
          
          {/* GitHub备份/恢复功能 */}
          <Typography variant="body2" 
            sx={{ 
              mb: 1, 
              pl: 1, 
              fontWeight: 'medium',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <GitHubIcon fontSize="small" sx={{ mr: 0.5 }} />
            GitHub备份与恢复
          </Typography>
          
          {backupStatus?.lastBackupTime && (
            <Box sx={{ px: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                上次备份: {formatDate(backupStatus.lastBackupTime)}
              </Typography>
            </Box>
          )}
          
          {gitHubError && (
            <Alert severity="error" 
              sx={{ 
                mb: 1, 
                py: 0.5, 
                fontSize: '0.75rem',
                '& .MuiAlert-message': { 
                  fontSize: '0.75rem'
                } 
              }}
            >
              {gitHubError}
            </Alert>
          )}
          
          <ListItem 
            sx={{ px: 1, py: 0.5 }}
            secondaryAction={
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={isGitHubBackuping ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                onClick={handleGitHubBackup}
                disabled={isGitHubBackuping || isGitHubRestoring || !hasGitHubCredentials}
                sx={{ minWidth: '90px', fontSize: '0.75rem' }}
              >
                备份
              </Button>
            }
          >
            <ListItemText 
              primary={
                <Typography variant="body2">GitHub备份</Typography>
              } 
              secondary={
                <Typography variant="caption" color="text.secondary">
                  将设置备份到GitHub仓库
                </Typography>
              }
            />
          </ListItem>
          
          <ListItem 
            sx={{ px: 1, py: 0.5 }}
            secondaryAction={
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={isGitHubRestoring ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
                onClick={handleGitHubRestoreConfirm}
                disabled={isGitHubBackuping || isGitHubRestoring || !hasGitHubCredentials}
                sx={{ minWidth: '90px', fontSize: '0.75rem' }}
              >
                恢复
              </Button>
            }
          >
            <ListItemText 
              primary={
                <Typography variant="body2">GitHub恢复</Typography>
              } 
              secondary={
                <Typography variant="caption" color="text.secondary">
                  从GitHub仓库恢复设置
                </Typography>
              }
            />
          </ListItem>
        </List>
      </Paper>
      
      {/* 危险操作区域 */}
      <Paper
        variant="outlined"
        sx={{ mb: 2, p: 1.5, borderRadius: 1, borderColor: 'error.light' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ color: 'error.main', mr: 1, display: 'flex' }}>
            <WarningIcon fontSize="small" />
          </Box>
          <Typography variant="subtitle2" fontWeight={500} color="error.main">
            危险操作
          </Typography>
        </Box>
        <Divider sx={{ mb: 1.5 }} color="error.light" />
        
        <ListItem 
          sx={{ px: 1, py: 0.5 }}
          secondaryAction={
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => setShowClearDialog(true)}
              sx={{ minWidth: '90px', fontSize: '0.75rem' }}
            >
              清除
            </Button>
          }
        >
          <ListItemText 
            primary={
              <Typography variant="body2">清除所有数据</Typography>
            } 
            secondary={
              <Typography variant="caption" color="text.secondary">
                重置并清除所有存储的数据
              </Typography>
            }
          />
        </ListItem>
      </Paper>
      
      {/* 清除数据确认对话框 */}
      <Dialog
        open={showClearDialog}
        onClose={() => !clearing && setShowClearDialog(false)}
      >
        <DialogTitle>确认清除所有数据</DialogTitle>
        <DialogContent>
          <DialogContentText>
            此操作将清除所有本地存储的数据，包括您的设置、任务和自定义书签数据。此操作不可撤销。
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'error.main' }}>
            您确定要继续吗？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowClearDialog(false)}
            disabled={clearing}
          >
            取消
          </Button>
          <Button 
            onClick={handleClearData}
            color="error"
            disabled={clearing}
            autoFocus
          >
            {clearing ? '正在清除...' : '确认清除'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* GitHub恢复确认对话框 */}
      <Dialog
        open={showBackupRestoreConfirm}
        onClose={handleCancelGitHubRestore}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudDownloadIcon color="primary" />
            <span>确认从GitHub恢复设置</span>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            此操作将从GitHub仓库恢复您的设置，并覆盖当前的设置数据。
            <br /><br />
            建议在恢复前导出当前设置作为备份。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelGitHubRestore} color="primary">
            取消
          </Button>
          <Button 
            onClick={handleGitHubRestore} 
            variant="contained" 
            color="primary"
          >
            确认恢复
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsActions; 