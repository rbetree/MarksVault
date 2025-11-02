import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Theme } from '@mui/material/styles';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from '../styles/theme';
import storageService from '../../utils/storage-service';

// 创建主题上下文
interface ThemeContextType {
  themeColor: string;
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
  // 默认使用暗色模式和默认蓝色
  const [themeColor, setThemeColor] = useState<string>('#4285F4');
  // 根据颜色创建暗色主题
  const [theme, setTheme] = useState<Theme>(createAppTheme(themeColor));
  // 加载状态
  const [loading, setLoading] = useState(true);

  // 主题颜色变更函数
  const changeThemeColor = async (color: string) => {
    setThemeColor(color);
    setTheme(createAppTheme(color));
    
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
          const { themeColor: storedThemeColor } = result.data;
          
          if (storedThemeColor) {
            setThemeColor(storedThemeColor);
            setTheme(createAppTheme(storedThemeColor));
          }
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
    themeColor,
    changeThemeColor,
    theme
  };

  // 在加载期间使用默认主题，但不隐藏内容，避免白屏闪烁
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