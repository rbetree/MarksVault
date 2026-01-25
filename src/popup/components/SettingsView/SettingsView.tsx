import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import SettingsIcon from '@mui/icons-material/Settings';
import BuildIcon from '@mui/icons-material/Build';
import InfoIcon from '@mui/icons-material/Info';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GitHubIcon from '@mui/icons-material/GitHub';
import BugReportIcon from '@mui/icons-material/BugReport';
import CodeIcon from '@mui/icons-material/Code';
import FeaturedPlayListIcon from '@mui/icons-material/FeaturedPlayList';
import PeopleIcon from '@mui/icons-material/People';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import { ToastRef } from '../shared/Toast';
import storageService, { UserSettings } from '../../../utils/storage-service';
import SettingsActions from './SettingsActions';
import { useThemeContext } from '../../contexts/ThemeContext';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { styled } from '@mui/material/styles';

const ActionArea = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 0.5, 0, 0.5),
  backgroundColor: 'transparent',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  width: '100%',
  justifyContent: 'space-between',
}));

const LeftColumn = styled(Box)(({ theme }) => ({
  width: '30%',
  paddingRight: theme.spacing(0.5),
}));

const RightColumn = styled(Box)(({ theme }) => ({
  width: '70%',
  paddingLeft: theme.spacing(0.5),
}));

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
        <Box sx={{ pt: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
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
  { value: '#667B9D', label: '默认灰蓝' },
  { value: '#769481', label: '柔和绿' },
  { value: '#B57B77', label: '柔和粉' },
  { value: '#B5A077', label: '柔和金' },
  { value: '#8A77B5', label: '柔和紫' },
  { value: '#B58D77', label: '柔和橘' },
];

/**
 * 设置页面主组件
 * 包含所有用户可配置的设置选项
 */
const SettingsView: React.FC<SettingsViewProps> = ({ toastRef }) => {
  const { changeThemeColor } = useThemeContext();

  // 确保初始状态包含所有必要的字段
  const defaultNotifications = {
    bookmarkChanges: true,
    syncStatus: true,
    backupReminders: true
  };

  const [settings, setSettings] = useState<UserSettings>({
    isDarkMode: true,
    syncEnabled: false,
    viewType: 'grid',
    themeColor: '#667B9D',
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 操作区域 */}
      <ActionArea>
        {/* 左侧：页面标题 */}
        <LeftColumn>
          <Paper
            sx={{
              p: '1px 4px',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '32px',
              borderRadius: 1,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              boxShadow: 'none',
              pl: 1
            }}
          >
            <Typography
              variant="body2"
              noWrap
              sx={{
                fontWeight: 400,
                fontSize: '0.9rem',
                color: 'text.primary',
              }}
            >
              设置
            </Typography>
          </Paper>
        </LeftColumn>

        {/* 右侧：标签切换 */}
        <RightColumn>
          <Paper
            sx={{
              p: '1px 4px',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '32px',
              borderRadius: 1,
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              boxShadow: 'none',
            }}
          >
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{
                width: '100%',
                minHeight: '28px',
                height: '28px',
                '& .MuiTabs-indicator': {
                  height: 2,
                  bottom: 0
                }
              }}
            >
              <Tab
                label="一般"
                sx={{
                  fontSize: '0.75rem',
                  minHeight: '28px',
                  height: '28px',
                  textTransform: 'none',
                  p: 0,
                  minWidth: 0
                }}
              />
              <Tab
                label="高级"
                sx={{
                  fontSize: '0.75rem',
                  minHeight: '28px',
                  height: '28px',
                  textTransform: 'none',
                  p: 0,
                  minWidth: 0
                }}
              />
              <Tab
                label="关于"
                sx={{
                  fontSize: '0.75rem',
                  minHeight: '28px',
                  height: '28px',
                  textTransform: 'none',
                  p: 0,
                  minWidth: 0
                }}
              />
            </Tabs>
          </Paper>
        </RightColumn>
      </ActionArea>

      {/* 内容区域 */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 0.5, pb: 1, pt: 1.5, backgroundColor: 'transparent' }}>
        <TabPanel value={tabValue} index={0}>
          {/* 一般设置标签页内容 */}
          <SettingGroup title="界面设置" icon={<VisibilityIcon fontSize="small" />}>
            <Box>
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
                  value={settings.themeColor || '#667B9D'}
                  onChange={handleThemeColorChange}
                  style={{ width: 24, height: 24, padding: 0 }}
                  title="自定义颜色"
                />
              </Box>
            </Box>
          </SettingGroup>

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
                label={<Typography variant="body2">书签变更通知</Typography>}
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
                label={<Typography variant="body2">同步状态通知</Typography>}
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
                label={<Typography variant="body2">备份提醒</Typography>}
              />
            </FormGroup>
          </SettingGroup>

          <SettingGroup title="备份设置" icon={<CloudUploadIcon fontSize="small" />}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>备份文件数量限制</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.backup?.maxBackupsPerType || 10}
                  onChange={(e) => {
                    const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                    const newSettings = {
                      ...settings,
                      backup: {
                        ...(settings.backup || {}),
                        maxBackupsPerType: value
                      }
                    };
                    setSettings(newSettings);
                    storageService.updateSettings({
                      backup: { maxBackupsPerType: value }
                    });
                  }}
                  style={{
                    width: '60px',
                    padding: '4px 8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    color: 'inherit'
                  }}
                  aria-label="最大备份数量"
                />
                <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                  每种类型的最大备份数量 (0 = 不限制)
                </Typography>
              </Box>
            </Box>
          </SettingGroup>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <SettingsActions toastRef={toastRef} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ px: 0.5 }}>
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
                borderColor: 'divider',
                backgroundColor: 'transparent'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                <Avatar
                  src="/assets/icons/logo/icon128.png"
                  alt="MarksVault Logo"
                  sx={{ width: 48, height: 48, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', bgcolor: 'background.paper', p: 0.5 }}
                />
                <Box sx={{ ml: 2, textAlign: 'left', flex: 1 }}>
                  <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>MarksVault</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                    <Chip label="v0.1.1" size="small" color="primary" sx={{ fontSize: '0.7rem', height: 20 }} />
                    <Box sx={{ display: 'flex', ml: 1.5 }}>
                      <Link href="#" onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: 'https://github.com/rbetree/MarksVault' }); }} sx={{ color: 'primary.main', display: 'flex' }}><GitHubIcon sx={{ fontSize: 18 }} /></Link>
                      <Link href="#" onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: 'https://github.com/rbetree/MarksVault/issues' }); }} sx={{ color: 'primary.main', ml: 1, display: 'flex' }}><BugReportIcon sx={{ fontSize: 18 }} /></Link>
                    </Box>
                  </Box>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>一个强大的书签管理扩展，助您高效整理和备份书签</Typography>
            </Paper>

            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <CodeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={500} sx={{ fontSize: '0.95rem' }}>技术栈</Typography>
              </Box>
              <Divider sx={{ mb: 0.75 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom sx={{ fontSize: '0.75rem' }}>前端框架</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip size="small" label="React 18.2" sx={{ fontSize: '0.65rem', height: 20 }} />
                    <Chip size="small" label="TypeScript 5.0" sx={{ fontSize: '0.65rem', height: 20 }} />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom sx={{ fontSize: '0.75rem' }}>扩展API</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip size="small" label="Chrome V3" sx={{ fontSize: '0.65rem', height: 20 }} />
                    <Chip size="small" label="Bookmarks" sx={{ fontSize: '0.65rem', height: 20 }} />
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <FeaturedPlayListIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={500} sx={{ fontSize: '0.95rem' }}>核心功能</Typography>
              </Box>
              <Divider sx={{ mb: 0.75 }} />
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    • 智能书签管理与分类整理
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    • 自动化任务调度系统 (自动备份/清理)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    • GitHub Gist 实时云同步
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                    • 现代化 UI 与深色模式支持
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <PeopleIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={500} sx={{ fontSize: '0.95rem' }}>贡献者</Typography>
              </Box>
              <Divider sx={{ mb: 0.75 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                由 rbetree 及其开源社区贡献者开发。
              </Typography>
            </Box>
          </Box>
        </TabPanel>
      </Box>
    </Box>
  );
};

export default SettingsView; 