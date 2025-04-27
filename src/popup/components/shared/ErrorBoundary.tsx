import React, { Component, ErrorInfo, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state，下次渲染时使用错误UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    console.error('组件错误:', error, errorInfo);
    this.setState({
      errorInfo
    });
  }

  handleRefresh = (): void => {
    // 重新加载页面
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            height: '100%',
            textAlign: 'center'
          }}
        >
          <BugReportIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            糟糕，出现了问题
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            应用程序遇到了意外错误。请尝试刷新页面。
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={this.handleRefresh}
          >
            刷新页面
          </Button>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <Box 
              sx={{ 
                mt: 4, 
                p: 2, 
                bgcolor: 'grey.100', 
                borderRadius: 1,
                width: '100%',
                overflow: 'auto',
                textAlign: 'left'
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                错误详情（仅开发环境可见）:
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: 12 }}>
                {this.state.error.toString()}
              </Typography>
              {this.state.errorInfo && (
                <Typography variant="body2" component="pre" sx={{ fontSize: 12, mt: 1 }}>
                  {this.state.errorInfo.componentStack}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 