import React from 'react';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import TaskIcon from '@mui/icons-material/Assignment';
import SyncIcon from '@mui/icons-material/Sync';
import SettingsIcon from '@mui/icons-material/Settings';

// 导航选项类型
export type NavOption = 'bookmarks' | 'tasks' | 'sync' | 'settings';

interface BottomNavProps {
  value: NavOption;
  onChange: (value: NavOption) => void;
}

const AppBottomNavigation: React.FC<BottomNavProps> = ({ value, onChange }) => {
  const handleChange = (_: React.SyntheticEvent, newValue: NavOption) => {
    onChange(newValue);
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        borderTop: '1px solid rgba(0, 0, 0, 0.12)',
        boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.05)',
        borderRadius: 0 // 底栏使用直角
      }} 
      elevation={0}
    >
      <BottomNavigation
        value={value}
        onChange={handleChange}
        showLabels
        sx={{ height: 56 }}
      >
        <BottomNavigationAction 
          label="书签" 
          value="bookmarks" 
          icon={<BookmarksIcon />} 
        />
        <BottomNavigationAction 
          label="任务" 
          value="tasks" 
          icon={<TaskIcon />} 
        />
        <BottomNavigationAction 
          label="同步" 
          value="sync" 
          icon={<SyncIcon />} 
        />
        <BottomNavigationAction 
          label="设置" 
          value="settings" 
          icon={<SettingsIcon />} 
        />
      </BottomNavigation>
    </Paper>
  );
};

export default AppBottomNavigation; 