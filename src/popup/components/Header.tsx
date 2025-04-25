import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  // 临时使用默认头像，后续会替换为GitHub用户头像
  const avatarSrc = undefined;
  const username = "未登录";

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
          <Box display="flex" alignItems="center">
            <Avatar
              src={avatarSrc}
              alt={username}
              sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}
            >
              {username.charAt(0).toUpperCase()}
            </Avatar>
            <Typography
              variant="body2"
              sx={{ ml: 1, display: { xs: 'none', sm: 'block' } }}
            >
              {username}
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header; 