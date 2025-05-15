import React, { useState, useEffect } from 'react';import Box from '@mui/material/Box';import Typography from '@mui/material/Typography';import Switch from '@mui/material/Switch';import FormControlLabel from '@mui/material/FormControlLabel';import FormGroup from '@mui/material/FormGroup';import Tabs from '@mui/material/Tabs';import Tab from '@mui/material/Tab';import Card from '@mui/material/Card';import CardContent from '@mui/material/CardContent';import CardHeader from '@mui/material/CardHeader';import Divider from '@mui/material/Divider';import SettingsIcon from '@mui/icons-material/Settings';import BuildIcon from '@mui/icons-material/Build';import InfoIcon from '@mui/icons-material/Info';import NotificationsIcon from '@mui/icons-material/Notifications';import VisibilityIcon from '@mui/icons-material/Visibility';import GitHubIcon from '@mui/icons-material/GitHub';import BugReportIcon from '@mui/icons-material/BugReport';import CodeIcon from '@mui/icons-material/Code';import FeaturedPlayListIcon from '@mui/icons-material/FeaturedPlayList';import PeopleIcon from '@mui/icons-material/People';import Link from '@mui/material/Link';import Avatar from '@mui/material/Avatar';import Grid from '@mui/material/Grid';import Chip from '@mui/material/Chip';import Paper from '@mui/material/Paper';import { ToastRef } from '../shared/Toast';import storageService, { UserSettings } from '../../../utils/storage-service';import SettingsActions from './SettingsActions';import { useThemeContext } from '../../contexts/ThemeContext';

interface SettingsViewProps {
  toastRef?: React.RefObject<ToastRef>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// 标签面板组件
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      style={{ height: '100%' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// 设置分组组件
interface SettingGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SettingGroup: React.FC<SettingGroupProps> = ({ title, icon, children }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, pl: 1 }}>
        <Box sx={{ color: 'primary.main', mr: 1, display: 'flex' }}>
          {icon}
        </Box>
        <Typography variant="subtitle2" fontWeight={500}>
          {title}
        </Typography>
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box sx={{ pl: 2 }}>
        {children}
      </Box>
    </Box>
  );
};

// 预定义主题颜色选项
const THEME_COLORS = [
  { value: '#4285F4', label: '默认蓝色' },
  { value: '#34A853', label: '绿色' },
  { value: '#EA4335', label: '红色' },
  { value: '#FBBC05', label: '黄色' },
  { value: '#9C27B0', label: '紫色' },
  { value: '#FF5722', label: '橙色' },
];

/**
 * 设置页面主组件
 * 包含所有用户可配置的设置选项
 */
const SettingsView: React.FC<SettingsViewProps> = ({ toastRef }) => {
  const { mode, toggleColorMode, changeThemeColor } = useThemeContext();
  
  // 确保初始状态包含所有必要的字段
  const defaultNotifications = {
    bookmarkChanges: true,
    syncStatus: true,
    backupReminders: true
  };
  
  const [settings, setSettings] = useState<UserSettings>({
    isDarkMode: mode === 'dark',
    syncEnabled: false,
    viewType: 'grid',
    themeColor: '#4285F4',
    notifications: defaultNotifications
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // 从存储服务加载设置
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await storageService.getSettings();
        
        if (result.success && result.data) {
          // 确保notifications字段总是完整的
          const loadedNotifications = result.data.notifications || {};
          
          setSettings({
            ...settings,
            ...result.data,
            notifications: {
              bookmarkChanges: loadedNotifications.bookmarkChanges ?? defaultNotifications.bookmarkChanges,
              syncStatus: loadedNotifications.syncStatus ?? defaultNotifications.syncStatus,
              backupReminders: loadedNotifications.backupReminders ?? defaultNotifications.backupReminders
            }
          });
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
  
  // 处理标签切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 处理主题颜色更改
  const handleThemeColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    const newSettings = { 
      ...settings, 
      themeColor: newColor 
    };
    setSettings(newSettings);
    storageService.updateSettings({ themeColor: newColor });
    changeThemeColor(newColor);
  };

  // 处理通知设置更改
  const handleNotificationChange = (setting: 'bookmarkChanges' | 'syncStatus' | 'backupReminders') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    const currentNotifications = settings.notifications || {
      bookmarkChanges: true,
      syncStatus: true,
      backupReminders: true
    };
    
    const newNotifications = {
      ...currentNotifications,
      [setting]: checked
    };
    
    const newSettings = {
      ...settings,
      notifications: newNotifications
    };
    
    setSettings(newSettings);
    storageService.updateSettings({ notifications: newNotifications });
  };

  return (
    <Box sx={{ p: 2, pb: 0, height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: '48px',
              py: 1,
            },
          }}
        >
          <Tab 
            icon={<SettingsIcon fontSize="small" />} 
            label="一般设置" 
            iconPosition="start"
            sx={{ 
              fontSize: '0.875rem', 
              minHeight: '48px', 
              textTransform: 'none',
              fontWeight: 500
            }}
          />
          <Tab 
            icon={<BuildIcon fontSize="small" />} 
            label="高级设置" 
            iconPosition="start"
            sx={{ 
              fontSize: '0.875rem', 
              minHeight: '48px', 
              textTransform: 'none',
              fontWeight: 500
            }}
          />
          <Tab 
            icon={<InfoIcon fontSize="small" />} 
            label="关于" 
            iconPosition="start"
            sx={{ 
              fontSize: '0.875rem', 
              minHeight: '48px', 
              textTransform: 'none',
              fontWeight: 500
            }}
          />
        </Tabs>
        
        <CardContent sx={{ p: 2, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* 一般设置标签页 */}
          <TabPanel value={tabValue} index={0}>
            {/* 界面设置分组 */}
            <SettingGroup title="界面设置" icon={<VisibilityIcon fontSize="small" />}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={mode === 'dark'}
                      onChange={handleDarkModeToggle}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">深色模式</Typography>
                  }
                />
              </FormGroup>
              
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>主题颜色</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {THEME_COLORS.map((color) => (
                    <Box
                      key={color.value}
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: color.value,
                        cursor: 'pointer',
                        border: settings.themeColor === color.value ? '2px solid #000' : 'none',
                        '&:hover': { opacity: 0.8 },
                      }}
                      onClick={() => {
                        const newSettings = { ...settings, themeColor: color.value };
                        setSettings(newSettings);
                        storageService.updateSettings({ themeColor: color.value });
                        changeThemeColor(color.value);
                      }}
                      title={color.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={settings.themeColor || '#4285F4'}
                    onChange={handleThemeColorChange}
                    style={{ width: 24, height: 24, padding: 0 }}
                    title="自定义颜色"
                  />
                </Box>
              </Box>
            </SettingGroup>
            
            {/* 通知设置分组 */}
            <SettingGroup title="通知设置" icon={<NotificationsIcon fontSize="small" />}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.bookmarkChanges}
                      onChange={handleNotificationChange('bookmarkChanges')}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">书签变更通知</Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.syncStatus}
                      onChange={handleNotificationChange('syncStatus')}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">同步状态通知</Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications.backupReminders}
                      onChange={handleNotificationChange('backupReminders')}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">备份提醒</Typography>
                  }
                />
              </FormGroup>
            </SettingGroup>
          </TabPanel>
          
          {/* 高级设置标签页 */}
          <TabPanel value={tabValue} index={1}>
            <SettingsActions toastRef={toastRef} />
          </TabPanel>
          
          {/* 关于信息标签页 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ px: 0.5 }}>
              {/* 项目基本信息部分 */}
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 1, 
                  mb: 1, 
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                  <Avatar 
                    src="/assets/icons/logo/icon128.png"
                    alt="MarksVault Logo"
                    sx={{ 
                      width: 48, 
                      height: 48,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      bgcolor: 'background.paper',
                      p: 0.5
                    }}
                  >
                    M
                  </Avatar>
                  <Box sx={{ ml: 2, textAlign: 'left', flex: 1 }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                      MarksVault
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                      <Chip 
                        label="v0.1.0" 
                        size="small" 
                        color="primary" 
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                      <Box sx={{ display: 'flex', ml: 1.5 }}>
                        <Link
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            chrome.tabs.create({ url: 'https://github.com/rbetree/MarksVault' });
                          }}
                          sx={{ 
                            color: 'primary.main',
                            display: 'flex'
                          }}
                          aria-label="GitHub"
                        >
                          <GitHubIcon sx={{ fontSize: 18 }} />
                        </Link>
                        <Link
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            chrome.tabs.create({ url: 'https://github.com/rbetree/MarksVault/issues' });
                          }}
                          sx={{ 
                            color: 'primary.main',
                            ml: 1,
                            display: 'flex'
                          }}
                          aria-label="问题反馈"
                        >
                          <BugReportIcon sx={{ fontSize: 18 }} />
                        </Link>
                      </Box>
                    </Box>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  一个强大的书签管理扩展，助您高效整理和安全备份书签
                </Typography>
              </Paper>

              {/* 技术栈信息部分 */}
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <CodeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle1" fontWeight={500} sx={{ fontSize: '0.95rem' }}>技术栈</Typography>
                </Box>
                <Divider sx={{ mb: 0.75 }} />
                <Grid container spacing={1} sx={{ pl: 0.5 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight={500} gutterBottom sx={{ fontSize: '0.75rem' }}>前端框架</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip size="small" label="React 18.2" sx={{ fontSize: '0.65rem', height: 20 }} />
                      <Chip size="small" label="TypeScript 5.0" sx={{ fontSize: '0.65rem', height: 20 }} />
                      <Chip size="small" label="Material-UI 5.13" sx={{ fontSize: '0.65rem', height: 20 }} />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight={500} gutterBottom sx={{ fontSize: '0.75rem' }}>扩展API</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip size="small" label="Chrome Manifest V3" sx={{ fontSize: '0.65rem', height: 20 }} />
                      <Chip size="small" label="Bookmarks API" sx={{ fontSize: '0.65rem', height: 20 }} />
                      <Chip size="small" label="Storage API" sx={{ fontSize: '0.65rem', height: 20 }} />
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* 核心功能介绍部分 */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <FeaturedPlayListIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle1" fontWeight={500} sx={{ fontSize: '0.95rem' }}>核心功能</Typography>
                </Box>
                <Divider sx={{ mb: 0.75 }} />
                <Grid container spacing={1} sx={{ pl: 0.5 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>• 智能书签管理与分类</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>• GitHub云端同步与备份</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>• 高级搜索与过滤功能</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>• 自动化任务管理系统</Typography>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsView; 