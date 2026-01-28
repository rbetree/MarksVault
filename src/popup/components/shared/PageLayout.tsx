import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

const TopBar = styled(Box)(({ theme }) => ({
  width: '100%',
  height: 40,
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0.25, 1),
  backgroundColor: theme.palette.background.paper,
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  flexShrink: 0,
}));

interface PageLayoutProps {
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  rootSx?: object;
  contentSx?: object;
}

const PageLayout: React.FC<PageLayoutProps> = ({ title, children, actions, rootSx, contentSx }) => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...rootSx }}>
      <TopBar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
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
        </Box>

        {actions && (
          <Box
            sx={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              ml: 1,
              pl: 1,
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              minWidth: 0,
            }}
          >
            {actions}
          </Box>
        )}
      </TopBar>

      <Box
        sx={{
          flexGrow: 1,
          px: 1,
          pt: 1, // 统一内容区与顶部栏的间距
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
          ...contentSx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default PageLayout;
