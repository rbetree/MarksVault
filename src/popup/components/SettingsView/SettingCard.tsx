import React, { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import { SvgIconComponent } from '@mui/icons-material';

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
        mb: 2,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderRadius: 2
      }}
    >
      <CardHeader
        avatar={icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box>}
        title={
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        }
        sx={{ 
          pb: description ? 0 : 1,
          '& .MuiCardHeader-avatar': {
            marginRight: 1
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

      <Divider />

      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

export default SettingCard; 