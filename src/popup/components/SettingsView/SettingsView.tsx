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

// 确保初始状态包含所有必要的字段
const defaultNotifications = {
  bookmarkChanges: true,
  syncStatus: true,
  backupReminders: true
};

/**
 * 设置页面主组件
 */
const SettingsView: React.FC<SettingsViewProps> = ({ toastRef }) => {
  const { changeThemeColor } = useThemeContext();

  const [settings, setSettings] = useState<UserSettings>({
    isDarkMode: true,
    syncEnabled: false,
    viewType: 'grid',
    themeColor: '#667B9D',
    notifications: defaultNotifications
  });
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  // 从存储服务加载设置
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);

      try {
        const result = await storageService.getSettings();

        if (result.success && result.data) {
          // 确保notifications字段总是完整的
          const loadedNotifications = result.data.notifications || {};

          setSettings(prev => ({
            ...prev,
            ...result.data,
            notifications: {
              bookmarkChanges: loadedNotifications.bookmarkChanges ?? defaultNotifications.bookmarkChanges,
              syncStatus: loadedNotifications.syncStatus ?? defaultNotifications.syncStatus,
              backupReminders: loadedNotifications.backupReminders ?? defaultNotifications.backupReminders
            }
          }));
        } else {
          console.error('加载设置失败:', result.error);
        }
      } catch (error) {
        console.error('加载设置时出错:', error);
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

  // 处理主题颜色更改（保存失败时回滚状态并提示）
  const handleThemeColorChange = async (newColor: string) => {
    const prevSettings = settings;
    const newSettings = {
      ...settings,
      themeColor: newColor
    };
    setSettings(newSettings);
    changeThemeColor(newColor);
    const result = await storageService.updateSettings({ themeColor: newColor });
    if (!result.success) {
      // 保存失败：回滚主题色并提示
      setSettings(prevSettings);
      // themeColor 为可选字段，回滚时兜底用本次尝试的新颜色
      changeThemeColor(prevSettings.themeColor ?? newColor);
      toastRef?.current?.showToast(`保存失败: ${result.error || '未知错误'}`, 'error');
    }
  };

  // 处理通知设置更改（保存失败时回滚状态并提示）
  const handleNotificationChange = async (setting: 'bookmarkChanges' | 'syncStatus' | 'backupReminders', checked: boolean) => {
    const prevSettings = settings;
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
    const result = await storageService.updateSettings({ notifications: newNotifications });
    if (!result.success) {
      // 保存失败：回滚通知设置并提示
      setSettings(prevSettings);
      toastRef?.current?.showToast(`保存失败: ${result.error || '未知错误'}`, 'error');
    }
  };

  // 处理备份限制更改（保存失败时回滚状态并提示）
  const handleBackupLimitChange = async (limit: number) => {
    const prevSettings = settings;
    const value = Math.max(0, Math.min(100, limit));
    const newSettings = {
      ...settings,
      backup: {
        ...(settings.backup || {}),
        maxBackupsPerType: value
      }
    };
    setSettings(newSettings);
    const result = await storageService.updateSettings({
      backup: { maxBackupsPerType: value }
    });
    if (!result.success) {
      // 保存失败：回滚备份限制并提示
      setSettings(prevSettings);
      toastRef?.current?.showToast(`保存失败: ${result.error || '未知错误'}`, 'error');
    }
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
