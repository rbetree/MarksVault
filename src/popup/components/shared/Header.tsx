import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LogoutIcon from '@mui/icons-material/Logout';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import VerifiedIcon from '@mui/icons-material/Verified';
import { GitHubUser } from '../../../types/github';

interface HeaderProps {
  user: GitHubUser | null;
  onLogout: () => Promise<void>;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <AppBar position="static" color="primary" sx={{ height: 64 }}>
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
  );
};

export default Header; 