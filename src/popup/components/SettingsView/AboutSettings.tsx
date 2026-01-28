import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import GitHubIcon from '@mui/icons-material/GitHub';
import BugReportIcon from '@mui/icons-material/BugReport';
import CodeIcon from '@mui/icons-material/Code';
import FeaturedPlayListIcon from '@mui/icons-material/FeaturedPlayList';
import PeopleIcon from '@mui/icons-material/People';
import { browser } from 'wxt/browser';
import DashboardCard from '../shared/DashboardCard';

const AboutSettings: React.FC = () => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 头部信息 */}
            <DashboardCard>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                        src="/assets/icons/logo/icon128.png"
                        alt="MarksVault Logo"
                        sx={{ width: 56, height: 56, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', bgcolor: 'background.paper', p: 0.5 }}
                    />
                    <Box sx={{ ml: 2, flex: 1 }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2, mb: 0.5 }}>MarksVault</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip label="v0.1.1" size="small" color="primary" sx={{ fontSize: '0.7rem', height: 20, mr: 1.5 }} />
                            <Link
                                href="#"
                                onClick={(e) => { e.preventDefault(); browser.tabs.create({ url: 'https://github.com/rbetree/MarksVault' }); }}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, display: 'flex', mr: 1.5 }}
                            >
                                <GitHubIcon sx={{ fontSize: 18 }} />
                            </Link>
                            <Link
                                href="#"
                                onClick={(e) => { e.preventDefault(); browser.tabs.create({ url: 'https://github.com/rbetree/MarksVault/issues' }); }}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' }, display: 'flex' }}
                            >
                                <BugReportIcon sx={{ fontSize: 18 }} />
                            </Link>
                        </Box>
                    </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    一个强大的书签管理扩展，助您高效整理、备份和同步您的书签。
                </Typography>
            </DashboardCard>

            {/* 技术栈 */}
            <DashboardCard
                title="技术栈"
                icon={<CodeIcon fontSize="small" sx={{ color: 'primary.main' }} />}
            >
                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>前端框架</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            <Chip size="small" label="React 18" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                            <Chip size="small" label="TypeScript" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                        </Box>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>扩展开发</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            <Chip size="small" label="WXT" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                            <Chip size="small" label="MUI System" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                        </Box>
                    </Grid>
                </Grid>
            </DashboardCard>

            {/* 核心功能 */}
            <DashboardCard
                title="核心功能"
                icon={<FeaturedPlayListIcon fontSize="small" sx={{ color: 'primary.main' }} />}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', mr: 1.5 }} />
                        书签管理与拖得排序
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', mr: 1.5 }} />
                        自动化任务调度 (备份/清理)
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main', mr: 1.5 }} />
                        GitHub Gist 云同步
                    </Typography>
                </Box>
            </DashboardCard>

            {/* 贡献者 */}
            <DashboardCard
                title="贡献者"
                icon={<PeopleIcon fontSize="small" sx={{ color: 'primary.main' }} />}
            >
                <Typography variant="body2" color="text.secondary">
                    由 <Link href="#" onClick={(e) => { e.preventDefault(); browser.tabs.create({ url: 'https://github.com/rbetree' }); }} color="primary" sx={{ fontWeight: 500, textDecoration: 'none' }}>rbetree</Link> 设计与开发。
                    感谢开源社区的支持。
                </Typography>
            </DashboardCard>
        </Box>
    );
};

export default AboutSettings;
