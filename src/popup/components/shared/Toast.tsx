import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertColor } from '@mui/material/Alert';

export interface ToastRef {
  showToast: (message: string, severity?: AlertColor, duration?: number) => void;
  hideToast: () => void;
}

type ToastProps = Record<string, never>;

const Toast = forwardRef<ToastRef, ToastProps>((_, ref) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('info');
  const [duration, setDuration] = useState(3000);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    showToast: (message: string, severity: AlertColor = 'info', duration: number = 3000) => {
      setMessage(message);
      setSeverity(severity);
      setDuration(duration);
      setOpen(true);
    },
    hideToast: () => {
      setOpen(false);
    }
  }));

  const handleClose = (_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  // 如果组件卸载时Toast还在显示，确保清理
  useEffect(() => {
    return () => {
      setOpen(false);
    };
  }, []);

  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: 7 }} // 确保不会被底部导航遮挡
    >
      <Alert 
        onClose={handleClose} 
        severity={severity} 
        variant="filled"
        elevation={6}
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
});

Toast.displayName = 'Toast';

export default Toast; 
