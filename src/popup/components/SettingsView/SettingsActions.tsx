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
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    mode: 'config' | 'settings';
    data: any;
    meta?: {
      exportedAt?: string;
      extensionVersion?: string;
      localKeys?: number;
      syncKeys?: number;
      hasGitHubCredentials?: boolean;
    };
  } | null>(null);
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

  // 处理配置导出（默认不包含 GitHub 凭据）
  const handleExportConfig = async () => {
    try {
      const result = await storageService.exportConfig({
        includeGitHubCredentials: false,
        includeLocalStorage: false,
      });

      if (result.success && result.data) {
        const settingsBlob = new Blob(
          [JSON.stringify(result.data, null, 2)],
          { type: 'application/json' }
        );
        
        const url = URL.createObjectURL(settingsBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `marksvault-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toastRef?.current?.showToast('配置已导出', 'success');
      } else {
        toastRef?.current?.showToast('导出配置失败', 'error');
      }
    } catch (error) {
      console.error('导出配置时出错:', error);
      toastRef?.current?.showToast('导出配置时发生错误', 'error');
    }
  };

  // 触发文件选择
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 处理配置导入：先解析文件，再二次确认覆盖导入
  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);

          // 判定导入模式：兼容旧版 settings-only
          const looksLikeSettings = parsed && typeof parsed === 'object'
            && typeof parsed.syncEnabled === 'boolean'
            && (parsed.viewType === 'list' || parsed.viewType === 'grid');

          const looksLikeConfig = parsed && typeof parsed === 'object'
            && parsed.schemaVersion === 1
            && parsed.app === 'MarksVault'
            && parsed.local
            && typeof parsed.local === 'object';

          if (!looksLikeSettings && !looksLikeConfig) {
            throw new Error('无效的配置文件格式');
          }

          setPendingImport({
            fileName: file.name,
            mode: looksLikeConfig ? 'config' : 'settings',
            data: parsed,
            meta: looksLikeConfig
              ? {
                exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
                extensionVersion: typeof parsed.extensionVersion === 'string' ? parsed.extensionVersion : undefined,
                localKeys: parsed.local ? Object.keys(parsed.local).length : 0,
                syncKeys: parsed.sync ? Object.keys(parsed.sync).length : 0,
                hasGitHubCredentials: Boolean(parsed?.sync?.github_credentials)
              }
              : undefined
          });
          setShowImportConfirm(true);
        } catch (parseError) {
          console.error('解析配置文件时出错:', parseError);
          toastRef?.current?.showToast('无效的配置文件格式', 'error');
        }
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('导入配置时出错:', error);
      toastRef?.current?.showToast('导入配置时发生错误', 'error');
    } finally {
      // 重置文件输入，以便可以重新选择相同的文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelImport = () => {
    if (isImporting) return;
    setShowImportConfirm(false);
    setPendingImport(null);
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;

    setIsImporting(true);
    try {
      const result = await storageService.importConfig(pendingImport.data, { importLocalStorage: false });
      if (result.success) {
        toastRef?.current?.showToast('配置已导入，正在刷新页面…', 'success');
        setShowImportConfirm(false);
        setPendingImport(null);
        // 刷新 popup 以重新加载 settings/数据
        setTimeout(() => window.location.reload(), 300);
      } else {
        toastRef?.current?.showToast(`导入配置失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('执行导入配置时出错:', error);
      toastRef?.current?.showToast('导入配置时发生错误', 'error');
    } finally {
      setIsImporting(false);
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
                onClick={handleExportConfig}
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
                  导出当前配置（settings/tasks/bookmarks等；不含GitHub token）
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
                  从JSON文件导入配置（覆盖本地数据）
                </Typography>
              }
            />
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportConfig}
              aria-label="导入配置文件"
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

      {/* 导入配置确认对话框 */}
      <Dialog
        open={showImportConfirm}
        onClose={handleCancelImport}
      >
        <DialogTitle>确认导入配置</DialogTitle>
        <DialogContent>
          <DialogContentText>
            此操作将覆盖当前本地数据（settings、任务、书签自定义数据等）。
            <br />
            建议在导入前先导出当前配置作为备份。
          </DialogContentText>
          {pendingImport?.mode === 'config' && (
            <DialogContentText sx={{ mt: 2 }}>
              文件：{pendingImport.fileName}
              <br />
              导出时间：{pendingImport.meta?.exportedAt || '未知'}
              <br />
              版本：{pendingImport.meta?.extensionVersion || '未知'}
              <br />
              local keys：{pendingImport.meta?.localKeys ?? 0}；sync keys：{pendingImport.meta?.syncKeys ?? 0}
              {pendingImport.meta?.hasGitHubCredentials ? (
                <>
                  <br />
                  ⚠️ 该文件包含 GitHub 凭据（token）字段，但默认不会清空 sync，仅对文件中包含的 key 做覆盖写入。
                </>
              ) : null}
            </DialogContentText>
          )}
          {pendingImport?.mode === 'settings' && (
            <DialogContentText sx={{ mt: 2 }}>
              检测到旧版“仅 settings”文件：将只导入 settings。
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelImport} disabled={isImporting}>
            取消
          </Button>
          <Button
            onClick={handleConfirmImport}
            variant="contained"
            color="primary"
            disabled={isImporting}
          >
            {isImporting ? '正在导入…' : '确认导入'}
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
