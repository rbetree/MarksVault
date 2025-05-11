import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Theme } from '@mui/material/styles';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from '../styles/theme';
import storageService from '../../utils/storage-service';

// 创建主题上下文
interface ThemeContextType {
  mode: 'light' | 'dark';
  themeColor: string;
  toggleColorMode: () => void;
  changeThemeColor: (color: string) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题提供者属性
interface ThemeProviderProps {
  children: ReactNode;
}

// 主题提供者组件
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 默认使用亮色模式和默认蓝色
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [themeColor, setThemeColor] = useState<string>('#4285F4');
  // 根据当前模式和颜色创建主题
  const [theme, setTheme] = useState<Theme>(createAppTheme(mode, themeColor));
  // 加载状态
  const [loading, setLoading] = useState(true);

  // 主题切换函数
  const toggleColorMode = async () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    setTheme(createAppTheme(newMode, themeColor));
    
    // 保存到存储
    await storageService.updateSettings({
      isDarkMode: newMode === 'dark'
    });
  };

  // 主题颜色变更函数
  const changeThemeColor = async (color: string) => {
    setThemeColor(color);
    setTheme(createAppTheme(mode, color));
    
    // 保存到存储
    await storageService.updateSettings({
      themeColor: color
    });
  };

  // 组件挂载时从存储加载主题设置
  useEffect(() => {
    const loadThemeSettings = async () => {
      setLoading(true);
      try {
        const result = await storageService.getSettings();
        
        if (result.success && result.data) {
          const { isDarkMode, themeColor: storedThemeColor } = result.data;
          const themeMode: 'light' | 'dark' = isDarkMode ? 'dark' : 'light';
          setMode(themeMode);
          
          if (storedThemeColor) {
            setThemeColor(storedThemeColor);
          }
          
          setTheme(createAppTheme(themeMode, storedThemeColor || themeColor));
        }
      } catch (error) {
        console.error('加载主题设置失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadThemeSettings();
  }, []);

  // 构建上下文值
  const themeContextValue: ThemeContextType = {
    mode,
    themeColor,
    toggleColorMode,
    changeThemeColor,
    theme
  };

  // 在加载期间可以显示一个空白页面，或者使用默认主题
  if (loading) {
    return (
      <MuiThemeProvider theme={createAppTheme('light', '#4285F4')}>
        <CssBaseline />
        <div style={{ display: 'none' }}>{children}</div>
      </MuiThemeProvider>
    );
  }

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// 自定义Hook，用于在组件中使用主题上下文
export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}; 