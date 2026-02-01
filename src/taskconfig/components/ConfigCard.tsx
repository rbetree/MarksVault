import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { SxProps, Theme } from '@mui/material/styles';

interface ConfigCardProps {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  sx?: SxProps<Theme>;
}

export const ConfigCard: React.FC<ConfigCardProps> = ({
  title,
  icon,
  description,
  children,
  actions,
  sx
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#1E1E1E', // Dark surface
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0))',
        border: '1px solid',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '16px', // Rounded corners
        overflow: 'hidden',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        },
        ...sx,
      }}
    >
      <Box sx={{ p: 3, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1.5 }}>
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
                bgcolor: 'rgba(66, 133, 244, 0.1)',
                width: 36,
                height: 36,
                borderRadius: '10px',
              }}
            >
              {icon}
            </Box>
          )}
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', letterSpacing: '0.01em' }}>
            {title}
          </Typography>
        </Box>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: icon ? 6 : 0, mb: 1, lineHeight: 1.6 }}>
            {description}
          </Typography>
        )}
      </Box>

      <Box sx={{ p: 3, pt: 1, flex: 1 }}>
        {children}
      </Box>

      {actions && (
        <Box
          sx={{
            p: 2,
            px: 3,
            borderTop: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.06)',
            bgcolor: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          {actions}
        </Box>
      )}
    </Paper>
  );
};
