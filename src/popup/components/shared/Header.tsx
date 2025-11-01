import React, { useState, useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LogoutIcon from '@mui/icons-material/Logout';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import VerifiedIcon from '@mui/icons-material/Verified';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import CodeIcon from '@mui/icons-material/Code';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { GitHubUser } from '../../../types/github';
import versionService, { ReleaseInfo } from '../../../services/version-service';
import UpdateDialog from './UpdateDialog';

interface HeaderProps {
  user: GitHubUser | null;
  onLogout: () => Promise<void>;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  // 版本更新状态
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<ReleaseInfo | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  const [isUpToDate, setIsUpToDate] = useState(false);
  const [currentVersionForDisplay, setCurrentVersionForDisplay] = useState('');

  // 检查版本更新
  useEffect(() => {
    const checkVersion = async () => {
      try {
        // 强制检查，忽略冷却时间
        const result = await versionService.checkForUpdates(true);
        
        // 保存当前版本用于显示
        setCurrentVersionForDisplay(result.currentVersion);
        
        // 检查是否处于开发模式
        if (result.isDevelopmentMode) {
          setIsDevelopmentMode(true);
        }
        
        if (result.hasUpdate && result.releaseInfo) {
          // 直接显示更新提示
          setUpdateAvailable(true);
          setUpdateInfo(result.releaseInfo);
        } else if (!result.hasUpdate && !result.isDevelopmentMode) {
          // 已为最新版本
          setIsUpToDate(true);
        }
      } catch (error) {
        console.error('[Header] 版本检查失败:', error);
      }
    };

    checkVersion();
  }, []);

  /**
   * 处理关闭对话框
   */
  const handleCloseDialog = () => {
    setShowUpdateDialog(false);
  };

  return (
    <>
    <AppBar position="static" color="primary" sx={{ height: 56 }}>
      <Toolbar>
        <Box display="flex" alignItems="center">
          <img 
            src="/assets/icons/logo/icon48.png" 
            alt="MarksVault Logo" 
            width="36" 
            height="36"
            style={{ marginRight: 8 }}
          />
          <Typography variant="h5" component="h1">
            MarksVault
          </Typography>
        </Box>
        
        <Box sx={{ flexGrow: 1 }} />

        {/* 已为最新版本徽章 */}
        {isUpToDate && !isDevelopmentMode && (
          <Tooltip title={`已为最新版本 v${currentVersionForDisplay}`}>
            <IconButton
              color="inherit"
              size="small"
              sx={{ mr: 2 }}
            >
              <CheckCircleIcon sx={{ color: 'success.main' }} />
            </IconButton>
          </Tooltip>
        )}

        {/* 开发模式徽章 */}
        {isDevelopmentMode && (
          <Tooltip title="您正在使用开发版本">
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setShowUpdateDialog(true)}
              sx={{ mr: 2 }}
            >
              <Badge
                badgeContent="Dev"
                color="warning"
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.6rem',
                    height: '16px',
                    minWidth: '16px',
                    padding: '0 4px'
                  }
                }}
              >
                <CodeIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        )}

        {/* 版本更新提示 */}
        {updateAvailable && updateInfo && (
          <Tooltip title="发现新版本，点击查看详情">
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setShowUpdateDialog(true)}
              sx={{ mr: 2 }}
            >
              <Badge color="error" variant="dot">
                <SystemUpdateAltIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
        
        <Box display="flex" alignItems="center">
          {user ? (
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar
                src={user.avatar_url}
                alt={user.login}
                sx={{ width: 32, height: 32 }}
              />
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" fontWeight="medium">
                  {user.login}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  已连接到GitHub账号
                </Typography>
              </Box>
              <Tooltip title="断开连接">
                <span style={{ display: 'inline-block' }}>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={onLogout}
                    sx={{ 
                      minWidth: 'auto', 
                      p: 0.5,
                      ml: 1
                    }}
                  >
                    <LogoutIcon fontSize="small" />
                  </Button>
                </span>
              </Tooltip>
            </Box>
          ) : (
            <Box display="flex" alignItems="center">
              <Avatar
                sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}
              >
                未
              </Avatar>
              <Typography
                variant="body2"
                sx={{ ml: 1, display: { xs: 'none', sm: 'block' } }}
              >
                未登录
              </Typography>
            </Box>
          )}
        </Box>
      </Toolbar>
    </AppBar>

    {/* 更新对话框 */}
    <UpdateDialog
      open={showUpdateDialog}
      onClose={handleCloseDialog}
      currentVersion={versionService.getCurrentVersion()}
      latestVersion={updateInfo?.version}
      releaseNotes={updateInfo?.releaseNotes}
      releaseUrl={updateInfo?.releaseUrl}
      isDevelopmentMode={isDevelopmentMode}
    />
    </>
  );
};

export default Header;