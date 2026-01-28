import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import LoadingIndicator from '../shared/LoadingIndicator';
import { ToastRef } from '../shared/Toast';
import storageService, { UserSettings } from '../../../utils/storage-service';
import SettingsActions from './SettingsActions';
import { useThemeContext } from '../../contexts/ThemeContext';
import PageLayout from '../shared/PageLayout';
import SettingsHeader from './SettingsHeader';
import GeneralSettings from './GeneralSettings';
import AboutSettings from './AboutSettings';

interface SettingsViewProps {
  toastRef?: React.RefObject<ToastRef>;
}

/**
 * 设置页面主组件
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
  const handleThemeColorChange = (newColor: string) => {
    const newSettings = {
      ...settings,
      themeColor: newColor
    };
    setSettings(newSettings);
    storageService.updateSettings({ themeColor: newColor });
    changeThemeColor(newColor);
  };

  // 处理通知设置更改
  const handleNotificationChange = (setting: 'bookmarkChanges' | 'syncStatus' | 'backupReminders', checked: boolean) => {
    const currentNotifications = settings.notifications || defaultNotifications;

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

  // 处理备份限制更改
  const handleBackupLimitChange = (limit: number) => {
    const value = Math.max(0, Math.min(100, limit));
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
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <PageLayout
      title={
        <SettingsHeader
          tabValue={tabValue}
          onTabChange={handleTabChange}
        />
      }
      contentSx={{ pb: 2 }}
    >
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        {tabValue === 0 && (
          <GeneralSettings
            settings={settings}
            onThemeColorChange={handleThemeColorChange}
            onNotificationChange={handleNotificationChange}
            onBackupLimitChange={handleBackupLimitChange}
          />
        )}
        {tabValue === 1 && (
          <SettingsActions toastRef={toastRef} />
        )}
        {tabValue === 2 && (
          <AboutSettings />
        )}
      </Box>
    </PageLayout>
  );
};

export default SettingsView;
