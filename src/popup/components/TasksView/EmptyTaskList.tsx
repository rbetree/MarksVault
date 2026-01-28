import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

interface EmptyTaskListProps {
  onCreateTask?: () => void;
  filtered?: boolean;
}

/**
 * 空任务列表组件
 * 当没有任务或过滤后没有任务时显示
 */
const EmptyTaskList: React.FC<EmptyTaskListProps> = ({ filtered = false }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        textAlign: 'center',
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none'
      }}
    >
      {filtered ? (
        <>
          <FilterAltOffIcon
            sx={{
              fontSize: 64,
              color: 'text.disabled',
              mb: 2
            }}
          />

          <Typography variant="h6" color="text.secondary" gutterBottom>
            没有符合条件的任务
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
            当前过滤条件下没有找到任何任务。请尝试调整过滤条件，或者使用右下角的添加按钮创建新任务。
          </Typography>
        </>
      ) : (
        <>
          <AssignmentIcon
            sx={{
              fontSize: 64,
              color: 'text.disabled',
              mb: 2
            }}
          />

          <Typography variant="h6" color="text.secondary" gutterBottom>
            还没有创建任务
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 500 }}>
            自动化任务可以帮助您定期执行书签备份、整理等操作，无需手动操作，提高效率！
          </Typography>

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 3,
            color: 'primary.main',
            fontSize: '0.875rem'
          }}>
            <Typography color="primary" variant="body2" sx={{ fontWeight: 500, mr: 1 }}>
              点击右下角按钮添加第一个任务
            </Typography>
            <KeyboardArrowDownIcon color="primary" fontSize="small" sx={{ transform: 'rotate(315deg)' }} />
          </Box>
        </>
      )}
    </Box>
  );
};

export default EmptyTaskList; 
