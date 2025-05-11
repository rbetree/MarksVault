import { createTheme, ThemeOptions } from '@mui/material/styles';

// 创建主题工厂函数，根据模式和颜色返回相应主题
export const createAppTheme = (mode: 'light' | 'dark', themeColor: string = '#4285F4') => {
  // 通用的主题设置
  const baseThemeOptions: ThemeOptions = {
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
      h4: {
        fontSize: '18px',
        fontWeight: 500,
      },
      h5: {
        fontSize: '15px',
        fontWeight: 500,
      },
      h6: {
        fontSize: '14px',
        fontWeight: 500,
      },
      body1: {
        fontSize: '13px',
      },
      body2: {
        fontSize: '11px',
      },
      button: {
        fontSize: '12px',
        textTransform: 'none',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            borderRadius: 0,
          },
        },
      },
    },
  };

  // 亮色主题特定设置
  const lightThemeOptions: ThemeOptions = {
    ...baseThemeOptions,
    palette: {
      mode: 'light',
      primary: {
        main: themeColor, // 使用自定义主题颜色
      },
      secondary: {
        main: '#34A853', // Google绿色
      },
      error: {
        main: '#EA4335', // Google红色
      },
      warning: {
        main: '#FBBC05', // Google黄色
      },
      background: {
        default: '#FFFFFF',
        paper: '#F5F5F5',
      },
      text: {
        primary: '#212121',
        secondary: '#757575',
      },
    },
  };

  // 生成深色主题颜色 - 让颜色在深色模式下更亮
  const brightenColor = (color: string): string => {
    // 简单的颜色亮化处理，对于复杂情况可以使用颜色处理库
    if (color.startsWith('#')) {
      // 十六进制颜色处理
      const hex = color.slice(1);
      // 尝试让颜色更亮，但不超过白色
      let r = parseInt(hex.slice(0, 2), 16);
      let g = parseInt(hex.slice(2, 4), 16);
      let b = parseInt(hex.slice(4, 6), 16);
      
      r = Math.min(255, r + 40);
      g = Math.min(255, g + 40);
      b = Math.min(255, b + 40);
      
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    // 默认返回原颜色
    return color;
  };

  // 深色主题特定设置
  const darkThemeOptions: ThemeOptions = {
    ...baseThemeOptions,
    palette: {
      mode: 'dark',
      primary: {
        main: brightenColor(themeColor), // 使用亮化的自定义主题颜色
      },
      secondary: {
        main: '#4DB96F', // 亮绿色
      },
      error: {
        main: '#FF6B6B', // 亮红色
      },
      warning: {
        main: '#FFCF4D', // 亮黄色
      },
      background: {
        default: '#121212', // Material Design推荐的深色背景
        paper: '#1E1E1E',   // 稍微亮一点的表面
      },
      text: {
        primary: '#E0E0E0',
        secondary: '#AAAAAA',
      },
    },
  };

  // 根据模式返回相应的主题
  return createTheme(mode === 'dark' ? darkThemeOptions : lightThemeOptions);
};

// 默认导出亮色主题
const theme = createAppTheme('light');
export default theme; 