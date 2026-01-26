import React from 'react';
import { browser } from 'wxt/browser';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Link,
  Chip
} from '@mui/material';
import {
  NewReleases as NewReleasesIcon,
  OpenInNew as OpenInNewIcon,
  Code as CodeIcon
} from '@mui/icons-material';

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  isDevelopmentMode?: boolean;
}

/**
 * 更新提示对话框组件
 * 显示版本更新信息、更新日志和操作按钮
 */
const UpdateDialog: React.FC<UpdateDialogProps> = ({
  open,
  onClose,
  currentVersion,
  latestVersion,
  releaseNotes,
  releaseUrl,
  isDevelopmentMode = false
}) => {
  /**
   * 处理立即更新按钮点击
   */
  const handleUpdate = () => {
    // 在新标签页中打开 GitHub releases 页面
    browser.tabs.create({ url: releaseUrl });
    onClose();
  };

  /**
   * 格式化更新日志
   * 简单处理 markdown 格式，将其转换为更友好的显示
   */
  const formatReleaseNotes = (notes: string): string => {
    // 移除 markdown 标记符号，保留基本格式
    return notes
      .replace(/^#+\s/gm, '') // 移除标题标记
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除加粗标记
      .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
      .replace(/`(.*?)`/g, '$1') // 移除代码标记
      .trim();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          {isDevelopmentMode ? (
            <>
              <CodeIcon sx={{ color: 'warning.main' }} />
              <Typography variant="h6" component="span">
                开发模式
              </Typography>
            </>
          ) : (
            <>
              <NewReleasesIcon color="primary" />
              <Typography variant="h6" component="span">
                发现新版本
              </Typography>
            </>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {isDevelopmentMode ? (
          /* 开发模式内容 */
          <Box>
            <Box
              sx={{
                p: 2,
                bgcolor: 'warning.light',
                borderRadius: 1,
                mb: 2
              }}
            >
              <Typography variant="body1" fontWeight="bold" gutterBottom>
                您正在使用开发版本
              </Typography>
              <Typography variant="body2" color="text.secondary">
                当前版本号高于已发布的最新版本，这表明您正在使用开发中的版本。
              </Typography>
            </Box>
            
            {/* 版本信息 */}
            <Box mb={2}>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    当前版本
                  </Typography>
                  <Chip
                    label={`v${currentVersion}`}
                    size="small"
                    color="warning"
                  />
                </Box>
                {latestVersion && (
                  <>
                    <Typography variant="h6" color="text.secondary">
                      →
                    </Typography>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        最新发布版本
                      </Typography>
                      <Chip
                        label={`v${latestVersion}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </>
                )}
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="body2" color="text.secondary">
                开发版本可能包含未经充分测试的新功能和改进。如果您遇到任何问题，请考虑：
              </Typography>
              <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                <Typography component="li" variant="body2" color="text.secondary">
                  检查控制台是否有错误信息
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  在 GitHub 上提交问题反馈
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  切换到稳定发布版本
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          /* 正常更新内容 */
          <>
            {/* 版本信息 */}
            <Box mb={2}>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    当前版本
                  </Typography>
                  <Chip
                    label={`v${currentVersion}`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                <Typography variant="h6" color="text.secondary">
                  →
                </Typography>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    最新版本
                  </Typography>
                  <Chip
                    label={`v${latestVersion}`}
                    size="small"
                    color="primary"
                  />
                </Box>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* 更新日志 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                更新内容
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'rgba(0,0,0,0.05)',
                  }
                }}
              >
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'inherit',
                    margin: 0
                  }}
                >
                  {releaseNotes && formatReleaseNotes(releaseNotes)}
                </Typography>
              </Box>
            </Box>

            {/* 查看完整更新说明链接 */}
            {releaseUrl && (
              <Box mt={2}>
                <Link
                  href={releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: '0.875rem'
                  }}
                >
                  查看完整更新说明
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </Link>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {isDevelopmentMode ? (
          /* 开发模式按钮 */
          <>
            <Box sx={{ flexGrow: 1 }} />
            {releaseUrl && (
              <Button
                onClick={() => browser.tabs.create({ url: releaseUrl })}
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                size="small"
              >
                查看发布页面
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="contained"
              size="small"
            >
              知道了
            </Button>
          </>
        ) : (
          /* 正常更新按钮 */
          <>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              onClick={onClose}
              variant="text"
              size="small"
            >
              关闭
            </Button>
            <Button
              onClick={handleUpdate}
              variant="contained"
              size="small"
            >
              立即更新
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default UpdateDialog;
