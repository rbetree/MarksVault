import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

interface SettingsHeaderProps {
    tabValue: number;
    onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
}

const SettingsHeader: React.FC<SettingsHeaderProps> = ({ tabValue, onTabChange }) => {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
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
                设置
            </Typography>

            <Box sx={{
                width: '60%',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 1,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                p: '2px'
            }}>
                <Tabs
                    value={tabValue}
                    onChange={onTabChange}
                    variant="fullWidth"
                    sx={{
                        minHeight: '28px',
                        height: '28px',
                        '& .MuiTabs-indicator': {
                            height: 2,
                            bottom: 0,
                            backgroundColor: 'primary.main',
                            borderRadius: '2px 2px 0 0'
                        },
                        '& .MuiTab-root': {
                            borderRadius: 1,
                            '&:hover': {
                                bgcolor: 'action.hover'
                            },
                            '&.Mui-selected': {
                                color: 'primary.main',
                                bgcolor: 'action.selected'
                            }
                        }
                    }}
                >
                    <Tab label="一般" sx={{ fontSize: '0.8rem', minHeight: '28px', height: '28px', textTransform: 'none', p: 0, minWidth: 0, fontWeight: 500 }} />
                    <Tab label="数据" sx={{ fontSize: '0.8rem', minHeight: '28px', height: '28px', textTransform: 'none', p: 0, minWidth: 0, fontWeight: 500 }} />
                    <Tab label="关于" sx={{ fontSize: '0.8rem', minHeight: '28px', height: '28px', textTransform: 'none', p: 0, minWidth: 0, fontWeight: 500 }} />
                </Tabs>
            </Box>
        </Box>
    );
};

export default SettingsHeader;
