import React, { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';

interface SettingCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * 设置卡片组件
 * 用于在设置页面中显示不同类别的设置
 */
const SettingCard: React.FC<SettingCardProps> = ({
  title,
  description,
  icon,
  children
}) => {
  return (
    <Card 
      sx={{ 
        mb: 3,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        borderRadius: 2,
        transition: 'box-shadow 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
        },
        overflow: 'visible'
      }}
    >
      <CardHeader
        avatar={icon && 
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              bgcolor: 'background.paper',
              p: 1,
              borderRadius: '12px',
            }}
          >
            {icon}
          </Box>
        }
        title={
          <Typography variant="h6" component="h2" fontWeight="500">
            {title}
          </Typography>
        }
        sx={{ 
          pb: description ? 0 : 1,
          '& .MuiCardHeader-avatar': {
            marginRight: 1.5
          }
        }}
      />

      {description && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      )}

      <Divider sx={{ opacity: 0.3 }} />

      <CardContent sx={{ pt: 2 }}>
        {children}
      </CardContent>
    </Card>
  );
};

export default SettingCard; 
