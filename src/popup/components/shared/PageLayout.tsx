import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

const HeaderContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 0.5, 0, 0.5),
  backgroundColor: 'transparent',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  width: '100%',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(1),
  flexShrink: 0,
}));

const HeaderPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
  display: 'flex',
  alignItems: 'center',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  height: '40px',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  boxShadow: 'none',
  backdropFilter: 'blur(8px)',
  width: '100%',
}));

interface PageLayoutProps {
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  contentSx?: object;
}

const PageLayout: React.FC<PageLayoutProps> = ({ title, children, actions, contentSx }) => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...contentSx }}>
      <HeaderContainer>
        <Box sx={{ flex: 1, mr: actions ? 1 : 0, minWidth: 0 }}>
          <HeaderPaper sx={{ justifyContent: 'flex-start' }}>
            {typeof title === 'string' ? (
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: 'text.primary',
                  letterSpacing: '0.02em',
                }}
              >
                {title}
              </Typography>
            ) : (
              title
            )}
          </HeaderPaper>
        </Box>

        {actions && (
          <Box sx={{ flex: '0 0 auto' }}>
            <HeaderPaper sx={{ justifyContent: 'flex-end', minWidth: 'auto', px: 0.5 }}>
              {actions}
            </HeaderPaper>
          </Box>
        )}
      </HeaderContainer>

      <Box
        sx={{
          flexGrow: 1,
          px: 0.5,
          pb: 10, // Add bottom padding to ensure content is not hidden behind FABs or bottom edge
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default PageLayout;
