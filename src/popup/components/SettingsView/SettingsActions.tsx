import React, { useState, useRef } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { ToastRef } from '../shared/Toast';
import storageService from '../../../utils/storage-service';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <Alert severity="warning" sx={{ mb: 2 }}>
        以下操作将对您的数据产生永久性影响，请谨慎操作。
      </Alert>
      
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportSettings}
            fullWidth
          >
            导出设置
          </Button>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<FileUploadIcon />}
            onClick={handleImportClick}
            fullWidth
          >
            导入设置
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleImportSettings}
            aria-label="导入设置文件"
          />
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setShowClearDialog(true)}
            fullWidth
          >
            清除所有数据
          </Button>
        </Grid>
      </Grid>
      
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
    </>
  );
};

export default SettingsActions; 