import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import BookmarkSelector from '../../popup/components/shared/BookmarkSelector';
import { BookmarkSelection, Task, SelectivePushAction } from '../../types/task';

interface SelectivePushExecutorProps {
  task: Task;
  onComplete: () => void;
  onCancel: () => void;
}

/**
 * 选择性推送执行器组件
 * 用于在独立页面中选择书签并执行推送
 */
const SelectivePushExecutor: React.FC<SelectivePushExecutorProps> = ({
  task,
  onComplete,
  onCancel
}) => {
  const [selections, setSelections] = useState<BookmarkSelection[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const action = task.action as SelectivePushAction;

  const handleExecute = async () => {
    if (selections.length === 0) {
      setError('请至少选择一个书签或文件夹');
      return;
    }

    setExecuting(true);
    setError(null);

    try {
      // 发送消息到background执行推送
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_SELECTIVE_PUSH',
        payload: {
          taskId: task.id,
          selections,
          repoName: action.options.repoName,
          folderPath: action.options.folderPath,
          commitMessage: action.options.commitMessage
        }
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError(response.error || '推送失败');
      }
    } catch (err) {
      console.error('执行选择性推送失败:', err);
      setError(err instanceof Error ? err.message : '执行推送时发生错误');
    } finally {
      setExecuting(false);
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
          borderRadius: 2
        }}
      >
        {/* 标题 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            选择要推送的书签
          </Typography>
          <Typography variant="body2" color="text.secondary">
            任务: {task.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            仓库: {action.options.repoName}
          </Typography>
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 成功提示 */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            推送成功！即将关闭...
          </Alert>
        )}

        {/* 书签选择器 */}
        <Box sx={{ mb: 3 }}>
          <BookmarkSelector
            selections={selections}
            onChange={setSelections}
            maxHeight="500px"
          />
        </Box>

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            disabled={executing}
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleExecute}
            disabled={executing || selections.length === 0}
            startIcon={executing ? <CircularProgress size={16} /> : null}
          >
            {executing ? '推送中...' : '执行推送'}
          </Button>
        </Box>

        {/* 选择提示 */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 提示: 
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            • 可以选择单个书签或整个文件夹
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 在右侧列表中拖动可调整推送顺序
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 选择文件夹会包含其所有子书签
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default SelectivePushExecutor;