import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningIcon from '@mui/icons-material/Warning';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

import BackupSelectionDialog from '../../popup/components/SyncView/BackupSelectionDialog';
import { Task, BackupAction } from '../../types/task';
import storageService, { GitHubCredentials } from '../../utils/storage-service';
import githubService from '../../services/github-service';
import { PENDING_RESTORE_BACKUP_KEY } from '../../services/backup-service-bookmark-data';
import { browser } from 'wxt/browser';

// 备份仓库名称常量
const BACKUP_REPO_NAME = 'marksvault-backups';

interface BackupRestoreExecutorProps {
  task: Task;
  onComplete: () => void;
  onCancel: () => void;
}

type RestoreMode = 'latest' | 'select';

/**
 * 备份恢复执行器（高风险操作）
 * - 仅用于 TaskConfigPage 的 execute 模式
 * - 提供备份选择 + 二次确认
 */
const BackupRestoreExecutor: React.FC<BackupRestoreExecutorProps> = ({ task, onComplete, onCancel }) => {
  const action = task.action as BackupAction;

  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<GitHubCredentials | null>(null);
  const [username, setUsername] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [executing, setExecuting] = useState(false);

  const initialBackupFilePath = (action.options?.backupFilePath || '').trim();
  const [restoreMode, setRestoreMode] = useState<RestoreMode>(
    initialBackupFilePath ? 'select' : 'latest'
  );
  const [selectedBackupPath, setSelectedBackupPath] = useState<string>(initialBackupFilePath);
  const [backupSelectionOpen, setBackupSelectionOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingRestoreAvailable, setPendingRestoreAvailable] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollbackExecuting, setRollbackExecuting] = useState(false);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        // 回滚不依赖 GitHub 凭据，先检查是否存在恢复失败后保留的暂存书签
        const stashResult = await storageService.getStorageData(PENDING_RESTORE_BACKUP_KEY);
        setPendingRestoreAvailable(
          stashResult.success && typeof stashResult.data === 'string' && stashResult.data.length > 0
        );

        const credentialsResult = await storageService.getGitHubCredentials();
        if (!credentialsResult.success || !credentialsResult.data) {
          setError('未找到 GitHub 凭据，请先在“概览”页完成授权');
          return;
        }

        const creds = credentialsResult.data;
        setCredentials(creds);

        const user = await githubService.validateCredentials(creds);
        setUsername(user.login);
      } catch (e) {
        console.error('初始化恢复执行器失败:', e);
        setError(e instanceof Error ? e.message : '初始化失败');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const canExecute =
    !loading &&
    !executing &&
    !rollbackExecuting &&
    !!credentials &&
    !!username &&
    (restoreMode === 'latest' || (restoreMode === 'select' && !!selectedBackupPath));

  const handleExecuteConfirm = async () => {
    setConfirmOpen(false);
    setExecuting(true);
    setError(null);

    try {
      // 恢复在 background 中执行：页面关闭后仍可完成，执行租约与写入租约由后台维护。
      // 仅传任务ID与本次选择的备份文件，任务配置由后台从存储读取
      const response = await browser.runtime.sendMessage({
        type: 'EXECUTE_TASK_WITH_DATA',
        payload: {
          taskId: task.id,
          ...(restoreMode === 'select' ? { backupFilePath: selectedBackupPath } : {}),
        },
      }) as { success?: boolean; error?: string } | undefined;

      if (!response?.success) {
        throw new Error(response?.error || '恢复失败');
      }

      setSuccess(true);

      // 通知 popup 刷新任务列表/提示（如果 popup 仍打开）；失败不影响“恢复成功”的展示与关闭流程
      try {
        await browser.storage.local.set({
          taskExecutionResult: {
            taskId: task.id,
            success: true,
            timestamp: Date.now(),
            message: '恢复完成',
          },
        });
      } catch (error) {
        console.warn('写入 taskExecutionResult 失败:', error);
      }

      setTimeout(() => onComplete(), 1200);
    } catch (e) {
      console.error('执行恢复失败:', e);
      const message = e instanceof Error ? e.message : '恢复失败';
      setError(message);

      try {
        await browser.storage.local.set({
          taskExecutionResult: {
            taskId: task.id,
            success: false,
            timestamp: Date.now(),
            message,
          },
        });
      } catch (error) {
        console.warn('写入 taskExecutionResult 失败:', error);
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleRollbackConfirm = async () => {
    setRollbackConfirmOpen(false);
    setRollbackExecuting(true);
    setError(null);
    setRollbackMessage(null);

    try {
      // 回滚通过 background 执行并获取书签写入租约，避免与其他写入任务并发
      const response = await browser.runtime.sendMessage({
        type: 'RESTORE_PENDING_BOOKMARK_BACKUP',
      }) as {
        success?: boolean;
        data?: { bookmarksCount?: number };
        error?: string;
      } | undefined;

      if (!response?.success) {
        throw new Error(response?.error || '回滚失败');
      }

      setPendingRestoreAvailable(false);
      setRollbackMessage(
        `已恢复上次暂存书签${response.data?.bookmarksCount ? `，共 ${response.data.bookmarksCount} 个书签` : ''}`
      );
    } catch (e) {
      console.error('回滚暂存书签失败:', e);
      setError(e instanceof Error ? e.message : '回滚失败');
    } finally {
      setRollbackExecuting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        {/* 标题 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <IconButton onClick={onCancel} size="small" sx={{ ml: -1 }} title="返回">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              恢复书签
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            任务: {task.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            GitHub: {username ? username : '未连接'}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!loading && success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            恢复成功，页面即将关闭...
          </Alert>
        )}

        {!loading && !success && (
          <>
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
              此操作会覆盖当前浏览器中的书签，且不可撤销。建议先执行一次“立即备份”。
            </Alert>

            {rollbackMessage && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRollbackMessage(null)}>
                {rollbackMessage}
              </Alert>
            )}

            {pendingRestoreAvailable && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  恢复上次暂存书签
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  上次恢复失败前已暂存原书签栏，可将当前书签栏回滚到恢复前的状态。
                </Typography>
                <Button
                  variant="outlined"
                  color="warning"
                  disabled={executing || rollbackExecuting}
                  startIcon={rollbackExecuting ? <CircularProgress size={16} color="inherit" /> : null}
                  onClick={() => setRollbackConfirmOpen(true)}
                >
                  {rollbackExecuting ? '回滚中...' : '恢复上次暂存书签'}
                </Button>
              </Paper>
            )}

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              选择恢复来源
            </Typography>

            <RadioGroup
              row
              value={restoreMode}
              onChange={(e) => setRestoreMode(e.target.value as RestoreMode)}
            >
              <FormControlLabel value="latest" control={<Radio />} label="使用最新备份" />
              <FormControlLabel value="select" control={<Radio />} label="选择指定备份" />
            </RadioGroup>

            {restoreMode === 'select' && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<FolderOpenIcon />}
                    onClick={() => setBackupSelectionOpen(true)}
                    disabled={!credentials || !username || executing}
                  >
                    选择备份文件
                  </Button>

                  {selectedBackupPath ? (
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                      已选择: {selectedBackupPath}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      尚未选择文件
                    </Typography>
                  )}
                </Box>

                <Typography variant="caption" color="text.secondary">
                  说明：仅展示 GitHub 仓库 {BACKUP_REPO_NAME}/bookmarks/ 下的备份文件
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
              <Button variant="outlined" onClick={onCancel} disabled={executing}>
                取消
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={!canExecute}
                startIcon={executing ? <CircularProgress size={16} color="inherit" /> : null}
                onClick={() => setConfirmOpen(true)}
              >
                {executing ? '恢复中...' : '开始恢复'}
              </Button>
            </Box>
          </>
        )}

        {/* 备份选择对话框 */}
        {backupSelectionOpen && credentials && username && (
          <BackupSelectionDialog
            open={backupSelectionOpen}
            onClose={() => setBackupSelectionOpen(false)}
            onSelect={(filePath) => {
              setSelectedBackupPath(filePath);
              setBackupSelectionOpen(false);
            }}
            credentials={credentials}
            username={username}
            repoName={BACKUP_REPO_NAME}
          />
        )}

        {/* 二次确认对话框 */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              <span>确认恢复书签</span>
            </Box>
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              此操作将从 GitHub 恢复书签，并覆盖当前浏览器中的书签。此操作不可撤销。
              <br />
              <br />
              {restoreMode === 'select' && selectedBackupPath ? (
                <>
                  备份文件: <strong>{selectedBackupPath}</strong>
                </>
              ) : (
                '将使用最新备份文件。'
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} color="inherit">
              取消
            </Button>
            <Button onClick={handleExecuteConfirm} color="error" variant="contained" autoFocus>
              确认恢复
            </Button>
          </DialogActions>
        </Dialog>

        {/* 回滚二次确认对话框 */}
        <Dialog open={rollbackConfirmOpen} onClose={() => setRollbackConfirmOpen(false)}>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              <span>确认恢复上次暂存书签</span>
            </Box>
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              此操作会用上次恢复前暂存的书签栏覆盖当前书签栏。仅在恢复失败后需要撤销时使用。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRollbackConfirmOpen(false)} color="inherit">
              取消
            </Button>
            <Button onClick={handleRollbackConfirm} color="error" variant="contained" autoFocus>
              确认回滚
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default BackupRestoreExecutor;
