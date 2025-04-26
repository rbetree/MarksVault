import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import GitHubIcon from '@mui/icons-material/GitHub';
import InfoIcon from '@mui/icons-material/Info';
import ErrorIcon from '@mui/icons-material/Error';
import { AuthStatus } from '../../../types/github';

// 从storage-service中导入GitHubCredentials
import { GitHubCredentials } from '../../../utils/storage-service';

interface GitHubAuthProps {
  onAuth: (credentials: GitHubCredentials) => Promise<void>;
  authStatus: AuthStatus;
  errorMessage?: string;
}

const GitHubAuth: React.FC<GitHubAuthProps> = ({ onAuth, authStatus, errorMessage }) => {
  const [token, setToken] = useState('');
  const [formErrors, setFormErrors] = useState({
    token: ''
  });

  // 生成带有预设参数的GitHub令牌创建链接
  const tokenCreationUrl = "https://github.com/settings/tokens/new?scopes=repo&description=MarksVault-Sync";

  const validateForm = (): boolean => {
    const errors = {
      token: ''
    };
    
    if (!token.trim()) {
      errors.token = '访问令牌不能为空';
    } else if (token.length < 40) {
      errors.token = '访问令牌格式不正确';
    }
    
    setFormErrors(errors);
    return !errors.token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const credentials: GitHubCredentials = {
      token: token.trim()
    };
    
    await onAuth(credentials);
  };

  return (
    <Card variant="outlined" sx={{ m: 0 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <GitHubIcon sx={{ mr: 1, color: 'text.secondary', fontSize: '1.2rem' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>GitHub认证</Typography>
          </Box>
          
          <Typography 
            variant="body2" 
            color="info.main" 
            sx={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              fontSize: '0.8rem', 
              mb: 1,
              mt: 0.5
            }}
          >
            <InfoIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem', mt: 0.1 }} />
            请提供GitHub个人访问令牌以启用同步功能。系统将自动获取您的GitHub账户信息。
          </Typography>
          
          <TextField
            label="个人访问令牌"
            variant="outlined"
            fullWidth
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={!!formErrors.token}
            helperText={formErrors.token}
            disabled={authStatus === AuthStatus.AUTHENTICATING}
            size="small"
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
          
          <Button
            startIcon={<GitHubIcon fontSize="small" />}
            variant="text"
            size="small"
            component="a"
            href={tokenCreationUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ alignSelf: 'center', mt: 0.5, mb: 0.5, textTransform: 'none' }}
          >
            点击此处快速创建令牌
          </Button>
          
          {errorMessage && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 0.5, mb: 0.5 }}>
              <ErrorIcon color="error" fontSize="small" sx={{ mr: 0.5, fontSize: '1rem', mt: 0.1 }} />
              <Typography variant="body2" color="error" sx={{ fontSize: '0.8rem' }}>
                {errorMessage}
              </Typography>
            </Box>
          )}
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={authStatus === AuthStatus.AUTHENTICATING}
            size="medium"
            sx={{ mt: 0.5 }}
          >
            {authStatus === AuthStatus.AUTHENTICATING ? (
              <CircularProgress size={24} color="inherit" />
            ) : '连接GitHub'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default GitHubAuth; 