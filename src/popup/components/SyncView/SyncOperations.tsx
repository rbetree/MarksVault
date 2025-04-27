import React, { useState } from 'react';
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
import LogoutIcon from '@mui/icons-material/Logout';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import VerifiedIcon from '@mui/icons-material/Verified';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { GitHubUser } from '../../../types/github';
import { ToastRef } from '../shared/Toast';

interface SyncOperationsProps {
  user: GitHubUser;
  onLogout: () => Promise<void>;
  toastRef?: React.RefObject<ToastRef>;
}

const SyncOperations: React.FC<SyncOperationsProps> = ({ user, onLogout, toastRef }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // 处理上传
  const handleUpload = async () => {
    setIsUploading(true);
    try {
      // 这里将来实现上传逻辑
      toastRef?.current?.showToast('上传功能尚未实现', 'info');
      // 模拟上传延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      // 更新最后同步时间
      const now = new Date().toLocaleString();
      setLastSyncTime(now);
    } catch (error) {
      console.error('Upload failed:', error);
      toastRef?.current?.showToast('上传失败', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // 处理下载
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // 这里将来实现下载逻辑
      toastRef?.current?.showToast('下载功能尚未实现', 'info');
      // 模拟下载延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Download failed:', error);
      toastRef?.current?.showToast('下载失败', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ m: 0 }}>
      {/* 用户信息头部 */}
      <CardHeader
        avatar={
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Tooltip title="已验证连接">
                <VerifiedIcon color="success" fontSize="small" />
              </Tooltip>
            }
          >
            <Avatar
              src={user.avatar_url}
              alt={user.login}
              sx={{ width: 40, height: 40 }}
            />
          </Badge>
        }
        title={
          <Typography variant="subtitle1" fontWeight="medium">
            {user.login}
          </Typography>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            已连接到GitHub账号
          </Typography>
        }
        action={
          <Button
            variant="outlined"
            color="primary"
            startIcon={<LogoutIcon />}
            onClick={onLogout}
            size="small"
            sx={{ mt: 1 }}
          >
            断开连接
          </Button>
        }
      />
      
      <Divider />
      
      {/* 同步操作区域 */}
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          同步操作
        </Typography>
        
        {lastSyncTime ? (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AccessTimeIcon fontSize="small" color="action" sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              上次同步时间: {lastSyncTime}
            </Typography>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            尚未进行同步操作，请使用下方按钮进行备份或恢复
          </Alert>
        )}
        
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
              onClick={handleDownload}
            >
              下载恢复
            </Button>
          </Grid>
        </Grid>
        
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
          注意：同步功能开发中，上传和下载操作尚未完全实现
        </Typography>
      </CardContent>
    </Card>
  );
};

export default SyncOperations; 