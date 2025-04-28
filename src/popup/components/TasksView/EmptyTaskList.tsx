import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';

interface EmptyTaskListProps {
  onCreateTask?: () => void;
  filtered?: boolean;
}

/**
 * 空任务列表组件
 * 当没有任务或过滤后没有任务时显示
 */
const EmptyTaskList: React.FC<EmptyTaskListProps> = ({ onCreateTask, filtered = false }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        px: 2,
        textAlign: 'center',
      }}
    >
      <AssignmentIcon 
        sx={{ 
          fontSize: 64, 
          color: 'text.disabled',
          mb: 2
        }} 
      />
      
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {filtered 
          ? '没有符合条件的任务' 
          : '还没有创建任务'}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
        {filtered 
          ? '请尝试调整过滤条件或创建新任务' 
          : '自动化任务可以帮助您定期执行书签备份、整理等操作，立即创建第一个任务吧！'}
      </Typography>
      
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onCreateTask}
      >
        创建新任务
      </Button>
    </Box>
  );
};

export default EmptyTaskList; 