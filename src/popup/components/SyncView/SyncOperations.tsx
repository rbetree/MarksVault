import React, { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Skeleton from '@mui/material/Skeleton';
import Fade from '@mui/material/Fade';
import IconButton from '@mui/material/IconButton';
import LogoutIcon from '@mui/icons-material/Logout';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import VerifiedIcon from '@mui/icons-material/Verified';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import GitHubIcon from '@mui/icons-material/GitHub';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FolderIcon from '@mui/icons-material/Folder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import StorageIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import { GitHubUser } from '../../../types/github';
import { ToastRef } from '../shared/Toast';
import storageService from '../../../utils/storage-service';
import backupService from '../../../services/backup-service';
import { BackupStatus } from '../../../types/backup';
import BackupSelectionDialog from './BackupSelectionDialog';
import { GitHubCredentials } from '../../../utils/storage-service';
import { formatDate } from '../../../utils/date-utils';

// 备份仓库名称常量
const BACKUP_REPO_NAME = 'marksvault-backups';

interface SyncOperationsProps {
  user: GitHubUser;
  onLogout: () => Promise<void>;
  toastRef?: React.RefObject<ToastRef>;
}

const SyncOperations: React.FC<SyncOperationsProps> = ({ user, onLogout, toastRef }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({});
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showBackupSelection, setShowBackupSelection] = useState(false);
  const [selectedBackupPath, setSelectedBackupPath] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<GitHubCredentials | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isStatsUpdating, setIsStatsUpdating] = useState(false);

  // 添加备份选择对话框刷新方法的引用
  const backupSelectionRefreshRef = useRef<(() => void) | null>(null);

  // 处理备份状态更新的回调
  const handleBackupStatusUpdate = useCallback((updatedStatus: BackupStatus) => {
    setBackupStatus(updatedStatus);
    setIsStatsUpdating(false);
  }, []);

  // 组件挂载时加载备份状态和GitHub凭据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsStatsLoading(true);
        
        // 加载GitHub凭据
        const credentialsResult = await storageService.getGitHubCredentials();
        if (credentialsResult.success && credentialsResult.data) {
          setCredentials(credentialsResult.data);
        }
        
        // 使用缓存优先策略加载备份状态
        const status = await backupService.getBackupStatus(false, handleBackupStatusUpdate);
        setBackupStatus(status);
        
        // 如果状态中有isFromCache标记，表示使用的是缓存数据，后台正在更新
        if (status.stats?.isFromCache) {
          setIsStatsUpdating(true);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setIsStatsLoading(false);
      }
    };

    loadData();
  }, [handleBackupStatusUpdate]);

  // 处理上传
  const handleUpload = async () => {
    setIsUploading(true);
    setBackupError(null);
    
    try {
      // 获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      if (!credentialsResult.success || !credentialsResult.data) {
        throw new Error('无法获取GitHub凭据，请重新登录');
      }
      
      // 执行备份
      const backupResult = await backupService.backupToGitHub(
        credentialsResult.data,
        user.login
      );
      
      if (!backupResult.success) {
        throw new Error(backupResult.error || '备份失败');
      }
      
      // 更新状态
      const status = await backupService.getBackupStatus();
      setBackupStatus(status);
      
      // 刷新备份列表（如果选择对话框是打开的）
      if (backupSelectionRefreshRef.current) {
        backupSelectionRefreshRef.current();
      }
      
      toastRef?.current?.showToast('书签成功备份到GitHub', 'success');
    } catch (error) {
      console.error('上传失败:', error);
      setBackupError(error instanceof Error ? error.message : String(error));
      toastRef?.current?.showToast('上传失败', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // 打开备份选择对话框
  const handleBackupSelectionOpen = () => {
    // 重置选择状态
    setSelectedBackupPath(null);
    setShowBackupSelection(true);
  };

  // 关闭备份选择对话框
  const handleBackupSelectionClose = () => {
    setShowBackupSelection(false);
  };

  // 备份选择后的回调
  const handleBackupSelected = (filePath: string) => {
    setSelectedBackupPath(filePath);
    // 打开确认对话框
    setShowRestoreConfirm(true);
  };

  // 处理下载前确认
  const handleDownloadConfirm = () => {
    if (!selectedBackupPath) {
      // 如果没有选择备份文件，打开选择对话框
      handleBackupSelectionOpen();
    } else {
      // 如果已经选择了备份文件，直接打开确认对话框
      setShowRestoreConfirm(true);
    }
  };

  // 执行下载恢复
  const handleDownload = async () => {
    setShowRestoreConfirm(false);
    setIsDownloading(true);
    setRestoreError(null);
    
    try {
      // 获取GitHub凭据
      const credentialsResult = await storageService.getGitHubCredentials();
      if (!credentialsResult.success || !credentialsResult.data) {
        throw new Error('无法获取GitHub凭据，请重新登录');
      }
      
      if (!selectedBackupPath) {
        throw new Error('未选择备份文件');
      }
      
      // 执行恢复，使用选定的备份文件
      const restoreResult = await backupService.restoreFromGitHub(
        credentialsResult.data,
        user.login,
        true, // 使用指定的备份文件
        selectedBackupPath
      );
      
      if (!restoreResult.success) {
        throw new Error(restoreResult.error || '恢复失败');
      }
      
      // 更新状态
      const status = await backupService.getBackupStatus();
      setBackupStatus(status);
      setSelectedBackupPath(null); // 重置选择
      
      toastRef?.current?.showToast('书签已成功恢复', 'success');
    } catch (error) {
      console.error('下载恢复失败:', error);
      setRestoreError(error instanceof Error ? error.message : String(error));
      toastRef?.current?.showToast('恢复失败', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // 取消下载恢复
  const handleCancelDownload = () => {
    setShowRestoreConfirm(false);
    setSelectedBackupPath(null);
  };

  // 辅助函数：格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '未知';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 手动刷新备份统计数据
  const handleRefreshStats = async () => {
    try {
      setIsStatsUpdating(true);
      const status = await backupService.getBackupStatus(true, handleBackupStatusUpdate);
      setBackupStatus(status);
    } catch (error) {
      console.error('刷新统计数据失败:', error);
      setIsStatsUpdating(false);
    }
  };

  // 统计信息卡片的骨架屏组件
  const StatsSkeletonCard = () => (
    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
        <Skeleton variant="text" width={120} height={24} />
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="circular" width={16} height={16} sx={{ mr: 0.5 }} />
            <Skeleton variant="text" width={100} />
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="circular" width={16} height={16} sx={{ mr: 0.5 }} />
            <Skeleton variant="text" width={100} />
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="circular" width={16} height={16} sx={{ mr: 0.5 }} />
            <Skeleton variant="text" width={100} />
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="circular" width={16} height={16} sx={{ mr: 0.5 }} />
            <Skeleton variant="text" width={100} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Card variant="outlined" sx={{ m: 0 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          同步操作
        </Typography>
        
        {/* 同步状态信息 */}
        <Box sx={{ mb: 2 }}>
          {backupStatus.lastBackupTime ? (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                上次备份时间: {formatDate(backupStatus.lastBackupTime)}
              </Typography>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 1 }}>
              尚未进行备份操作
            </Alert>
          )}
          
          {backupStatus.lastRestoreTime && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                上次恢复时间: {formatDate(backupStatus.lastRestoreTime)}
              </Typography>
            </Box>
          )}
        </Box>
        
        {/* 备份统计信息卡片 - 使用Fade包装实现平滑过渡 */}
        <Fade in={!isStatsLoading} timeout={500}>
          <Box>
            {isStatsLoading ? (
              <StatsSkeletonCard />
            ) : backupStatus.stats && (backupStatus.stats.totalBackups ?? 0) > 0 ? (
              <Card 
                variant="outlined" 
                sx={{ 
                  mb: 2, 
                  bgcolor: 'background.paper', 
                  borderRadius: 1,
                  position: 'relative'
                }}
              >
                {/* 卡片标题 */}
                <CardHeader
                  avatar={<AssessmentIcon color="primary" />}
                  title="备份统计信息"
                  titleTypographyProps={{ variant: 'subtitle1' }}
                  action={
                    <Tooltip title="刷新统计数据">
                      <Box sx={{ display: 'inline-flex' }}>
                        <IconButton 
                          size="small" 
                          onClick={handleRefreshStats}
                          disabled={isStatsUpdating}
                        >
                          {isStatsUpdating ? (
                            <CircularProgress size={18} />
                          ) : (
                            <RefreshIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </Tooltip>
                  }
                  sx={{ pb: 0 }}
                />
                
                <CardContent sx={{ pt: 1 }}>
                  <Grid container spacing={2}>
                    {/* 备份数量区域 */}
                    <Grid item xs={4}>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        p: 1
                      }}>
                        <StorageIcon color="primary" sx={{ mb: 0.5 }} />
                        <Typography variant="h5" sx={{ fontWeight: 'medium' }}>
                          {backupStatus.stats.totalBackups ?? 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          总备份数量
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {/* 书签数量区域 */}
                    <Grid item xs={4}>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        p: 1
                      }}>
                        <BookmarkIcon color="primary" sx={{ mb: 0.5 }} />
                        <Typography variant="h5" sx={{ fontWeight: 'medium' }}>
                          {backupStatus.stats.totalBookmarks ?? 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          书签数量
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {/* 文件夹数量区域 */}
                    <Grid item xs={4}>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        p: 1
                      }}>
                        <FolderIcon color="primary" sx={{ mb: 0.5 }} />
                        <Typography variant="h5" sx={{ fontWeight: 'medium' }}>
                          {backupStatus.stats.totalFolders ?? 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          文件夹数量
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Divider sx={{ my: 0.5 }} />
                    </Grid>
                    
                    {backupStatus.stats.fileSize !== undefined && (
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            最新备份大小:
                          </Typography>
                          <Typography variant="body2" sx={{ ml: 0.5, fontWeight: 'medium' }}>
                            {formatFileSize(backupStatus.stats.fileSize)}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            ) : null}
          </Box>
        </Fade>
        
        {/* 错误信息显示 */}
        {backupError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            备份错误: {backupError}
          </Alert>
        )}
        
        {restoreError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            恢复错误: {restoreError}
          </Alert>
        )}
        
        {/* 操作按钮 */}
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Button
              variant="contained"
              fullWidth
              color="primary"
              startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
              disabled={isUploading || isDownloading}
              onClick={handleUpload}
            >
              上传备份
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              variant="outlined"
              fullWidth
              color="primary"
              startIcon={isDownloading ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
              disabled={isUploading || isDownloading}
              onClick={handleBackupSelectionOpen}
            >
              下载恢复
            </Button>
          </Grid>
        </Grid>
        
        {/* 备份文件链接 */}
        {backupStatus.backupFileUrl && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="text"
              color="primary"
              startIcon={<GitHubIcon fontSize="small" />}
              component="a"
              href={backupStatus.backupFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', fontSize: '0.8rem' }}
            >
              在GitHub查看最新备份
            </Button>
          </Box>
        )}
      </CardContent>
      
      {/* 恢复确认对话框 */}
      <Dialog
        open={showRestoreConfirm}
        onClose={handleCancelDownload}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            <span>确认恢复书签</span>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            此操作将从GitHub恢复您的书签，并覆盖当前浏览器中的书签。此操作不可撤销。
            <br /><br />
            建议在恢复前手动备份当前书签。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDownload} color="primary">
            取消
          </Button>
          <Button onClick={handleDownload} color="error" variant="contained">
            确认恢复
          </Button>
        </DialogActions>
      </Dialog>

      {/* 备份选择对话框 */}
      {showBackupSelection && credentials && (
        <BackupSelectionDialog 
          open={showBackupSelection}
          onClose={handleBackupSelectionClose}
          onSelect={handleBackupSelected}
          credentials={credentials}
          username={user.login}
          repoName={BACKUP_REPO_NAME}
          onRefreshRef={backupSelectionRefreshRef}
        />
      )}
    </Card>
  );
};

export default SyncOperations; 