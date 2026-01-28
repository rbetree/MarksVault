import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import VisibilityIcon from '@mui/icons-material/Visibility';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { UserSettings } from '../../../utils/storage-service'; // Fixed import path
import DashboardCard from '../shared/DashboardCard';

// 预定义主题颜色选项
const THEME_COLORS = [
    { value: '#667B9D', label: '默认灰蓝' },
    { value: '#769481', label: '柔和绿' },
    { value: '#B57B77', label: '柔和粉' },
    { value: '#B5A077', label: '柔和金' },
    { value: '#8A77B5', label: '柔和紫' },
    { value: '#B58D77', label: '柔和橘' },
];

interface GeneralSettingsProps {
    settings: UserSettings;
    onThemeColorChange: (color: string) => void;
    onNotificationChange: (setting: 'bookmarkChanges' | 'syncStatus' | 'backupReminders', checked: boolean) => void;
    onBackupLimitChange: (limit: number) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
    settings,
    onThemeColorChange,
    onNotificationChange,
    onBackupLimitChange
}) => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 界面设置 */}
            <DashboardCard
                title="界面设置"
                icon={<VisibilityIcon fontSize="small" sx={{ color: 'primary.main' }} />}
            >
                <Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>主题颜色</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                        {THEME_COLORS.map((color) => (
                            <Box
                                key={color.value}
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    bgcolor: color.value,
                                    cursor: 'pointer',
                                    border: settings.themeColor === color.value ? '2px solid' : '2px solid transparent',
                                    borderColor: settings.themeColor === color.value ? 'text.primary' : 'transparent',
                                    boxShadow: settings.themeColor === color.value ? '0 0 0 1px rgba(255,255,255,0.5)' : 'none',
                                    transition: 'all 0.2s',
                                    '&:hover': { transform: 'scale(1.1)' },
                                }}
                                onClick={() => onThemeColorChange(color.value)}
                                title={color.label}
                            />
                        ))}
                        <Box sx={{ position: 'relative', width: 28, height: 28, overflow: 'hidden', borderRadius: '50%' }}>
                            <input
                                type="color"
                                value={settings.themeColor || '#667B9D'}
                                onChange={(e) => onThemeColorChange(e.target.value)}
                                style={{
                                    position: 'absolute',
                                    top: '-50%',
                                    left: '-50%',
                                    width: '200%',
                                    height: '200%',
                                    cursor: 'pointer',
                                    border: 'none',
                                    padding: 0,
                                    margin: 0
                                }}
                                title="自定义颜色"
                            />
                        </Box>
                    </Box>
                </Box>
            </DashboardCard>

            {/* 通知设置 */}
            <DashboardCard
                title="通知设置"
                icon={<NotificationsIcon fontSize="small" sx={{ color: 'primary.main' }} />}
            >
                <FormGroup sx={{ gap: 0.5 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.notifications?.bookmarkChanges ?? true}
                                onChange={(e) => onNotificationChange('bookmarkChanges', e.target.checked)}
                                color="primary"
                                size="small"
                            />
                        }
                        label={<Typography variant="body2">书签变更通知</Typography>}
                        sx={{ ml: 0, justifyContent: 'space-between', width: '100%' }}
                        labelPlacement="start"
                    />
                    <Divider sx={{ my: 0.5, opacity: 0.5 }} />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.notifications?.syncStatus ?? true}
                                onChange={(e) => onNotificationChange('syncStatus', e.target.checked)}
                                color="primary"
                                size="small"
                            />
                        }
                        label={<Typography variant="body2">同步状态通知</Typography>}
                        sx={{ ml: 0, justifyContent: 'space-between', width: '100%' }}
                        labelPlacement="start"
                    />
                    <Divider sx={{ my: 0.5, opacity: 0.5 }} />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.notifications?.backupReminders ?? true}
                                onChange={(e) => onNotificationChange('backupReminders', e.target.checked)}
                                color="primary"
                                size="small"
                            />
                        }
                        label={<Typography variant="body2">备份提醒</Typography>}
                        sx={{ ml: 0, justifyContent: 'space-between', width: '100%' }}
                        labelPlacement="start"
                    />
                </FormGroup>
            </DashboardCard>

            {/* 备份设置 */}
            <DashboardCard
                title="备份设置"
                icon={<CloudUploadIcon fontSize="small" sx={{ color: 'primary.main' }} />}
            >
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2">备份文件保留数量</Typography>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={settings.backup?.maxBackupsPerType || 10}
                            onChange={(e) => onBackupLimitChange(parseInt(e.target.value) || 0)}
                            style={{
                                width: '60px',
                                padding: '4px 8px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                color: 'inherit',
                                textAlign: 'center',
                                outline: 'none'
                            }}
                        />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        每种类型的最大备份数量 (0 = 不限制)。超出限制时将自动删除最旧的备份。
                    </Typography>
                </Box>
            </DashboardCard>
        </Box>
    );
};

export default GeneralSettings;
