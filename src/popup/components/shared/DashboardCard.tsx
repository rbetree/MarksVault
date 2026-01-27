import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: theme.shape.borderRadius, // usually 4px by default, consider increasing if 8px is desired globally or override here
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    boxShadow: 'none',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
    overflow: 'hidden',
    '&:hover': {
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
}));

interface DashboardCardProps {
    title?: ReactNode;
    icon?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    sx?: object;
    contentSx?: object;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
    title,
    icon,
    action,
    children,
    footer,
    sx,
    contentSx,
}) => {
    return (
        <StyledPaper sx={sx}>
            {(title || icon || action) && (
                <>
                    <Box
                        sx={{
                            p: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                            {icon && (
                                <Box
                                    sx={{
                                        color: 'primary.main',
                                        display: 'flex',
                                        fontSize: '1.25rem',
                                        '& > svg': { fontSize: 'inherit' },
                                    }}
                                >
                                    {icon}
                                </Box>
                            )}
                            {title && (typeof title === 'string' ? (
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {title}
                                </Typography>
                            ) : (
                                title
                            ))}
                        </Box>
                        {action && <Box sx={{ display: 'flex', alignItems: 'center' }}>{action}</Box>}
                    </Box>
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
                </>
            )}

            <Box sx={{ p: 1.5, ...contentSx }}>{children}</Box>

            {footer && (
                <>
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
                    <Box sx={{ p: 1, bgcolor: 'rgba(0, 0, 0, 0.2)' }}>
                        {footer}
                    </Box>
                </>
            )}
        </StyledPaper>
    );
};

export default DashboardCard;
