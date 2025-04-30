import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BuildIcon from '@mui/icons-material/Build';
import InfoIcon from '@mui/icons-material/Info';
import Link from '@mui/material/Link';
import { ToastRef } from '../shared/Toast';
import storageService, { UserSettings } from '../../../utils/storage-service';
import SettingCard from './SettingCard';
import SettingsActions from './SettingsActions';
import { useThemeContext } from '../../contexts/ThemeContext';

interface SettingsViewProps {
  toastRef?: React.RefObject<ToastRef>;
}

/**
 * 设置页面主组件
 * 包含所有用户可配置的设置选项
 */
const SettingsView: React.FC<SettingsViewProps> = ({ toastRef }) => {
  const { mode, toggleColorMode } = useThemeContext();
  const [settings, setSettings] = useState<UserSettings>({
    isDarkMode: mode === 'dark',
    syncEnabled: false,
    viewType: 'grid',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 从存储服务加载设置
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await storageService.getSettings();
        
        if (result.success && result.data) {
          setSettings(result.data);
        } else {
          setError(result.error || '加载设置失败');
        }
      } catch (error) {
        console.error('加载设置时出错:', error);
        setError('加载设置时发生错误');
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // 处理深色模式切换
  const handleDarkModeToggle = () => {
    toggleColorMode();
    // 设置状态将由ThemeContext管理，这里无需再更新本地状态
  };
  
  return (
    <Box sx={{ p: 2, pb: 7 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        系统设置
      </Typography>
      
      {/* 界面设置 */}
      <SettingCard 
        title="界面设置" 
        description="调整应用界面的外观与显示方式"
        icon={<VisibilityIcon color="primary" />}
      >
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={handleDarkModeToggle}
                color="primary"
              />
            }
            label="深色模式"
          />
        </FormGroup>
      </SettingCard>
      
      {/* 高级设置 */}
      <SettingCard 
        title="高级设置" 
        description="数据管理与高级操作"
        icon={<BuildIcon color="primary" />}
      >
        <SettingsActions toastRef={toastRef} />
      </SettingCard>
      
      {/* 关于信息 */}
      <SettingCard 
        title="关于" 
        description="应用版本与信息"
        icon={<InfoIcon color="primary" />}
      >
        <Box sx={{ py: 1 }}>
          <Typography variant="body2" gutterBottom>
            <strong>MarksVault</strong> 版本: 1.0.0
          </Typography>
          <Typography variant="body2" gutterBottom>
            一个强大的书签管理扩展，助您高效整理和安全备份书签。
          </Typography>
          <Typography variant="body2">
            了解更多信息，请访问{' '}
            <Link 
              href="#" 
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                chrome.tabs.create({ url: 'https://github.com/rbetree/MarksVault' });
              }}
            >
              GitHub页面
            </Link>
          </Typography>
        </Box>
      </SettingCard>
    </Box>
  );
};

export default SettingsView; 