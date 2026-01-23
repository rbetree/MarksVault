import React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

interface TaskSkeletonProps {
  mode?: 'card';
  count?: number;
}

/**
 * 任务加载骨架屏组件
 * 提供卡片视图模式的加载占位符
 */
const TaskSkeleton: React.FC<TaskSkeletonProps> = ({
  mode = 'card',
  count = 3
}) => {
  const renderCardSkeleton = (key: number) => (
    <Box
      key={`skeleton-card-${key}`}
      sx={{
        mb: 2,
        backgroundColor: 'transparent',
        borderRadius: 1
      }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Skeleton variant="text" width="70%" height={28} />
          <Skeleton variant="rounded" width={60} height={24} />
        </Box>

        <Skeleton variant="text" width="85%" sx={{ mb: 2 }} />

        <Box sx={{ mt: 1 }}>
          <Skeleton variant="text" width="50%" />
        </Box>

        <Box sx={{ mt: 1 }}>
          <Skeleton variant="text" width="65%" />
        </Box>
      </Box>

      <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
        <Skeleton variant="circular" width={32} height={32} sx={{ mr: 1 }} />
        <Skeleton variant="circular" width={32} height={32} sx={{ mr: 1 }} />
        <Skeleton variant="circular" width={32} height={32} />
        <Box sx={{ flexGrow: 1 }} />
        <Skeleton variant="rounded" width={80} height={32} />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {Array.from(new Array(count)).map((_, index) => renderCardSkeleton(index))}
    </Box>
  );
};

export default TaskSkeleton; 