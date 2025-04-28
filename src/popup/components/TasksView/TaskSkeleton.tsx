import React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

interface TaskSkeletonProps {
  mode: 'card' | 'list';
  count?: number;
}

/**
 * 任务加载骨架屏组件
 * 提供卡片和列表两种视图模式的加载占位符
 */
const TaskSkeleton: React.FC<TaskSkeletonProps> = ({ 
  mode = 'card',
  count = 3
}) => {
  const renderCardSkeleton = (key: number) => (
    <Card 
      key={`skeleton-card-${key}`}
      variant="outlined"
      sx={{ mb: 2 }}
    >
      <CardContent sx={{ pb: 1 }}>
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
      </CardContent>
      
      <CardActions>
        <Skeleton variant="circular" width={32} height={32} sx={{ mr: 1 }} />
        <Skeleton variant="circular" width={32} height={32} sx={{ mr: 1 }} />
        <Skeleton variant="circular" width={32} height={32} />
        <Box sx={{ flexGrow: 1 }} />
        <Skeleton variant="rounded" width={80} height={32} />
      </CardActions>
    </Card>
  );
  
  const renderListSkeleton = (key: number) => (
    <ListItem
      key={`skeleton-list-${key}`}
      divider
      sx={{ py: 1 }}
    >
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Box sx={{ ml: 1 }}>
              <Skeleton variant="rounded" width={60} height={24} />
            </Box>
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.5 }}>
            <Skeleton variant="text" width="40%" />
          </Box>
        }
      />
      
      <Box>
        <Skeleton variant="circular" width={30} height={30} sx={{ display: 'inline-block', mx: 0.5 }} />
        <Skeleton variant="circular" width={30} height={30} sx={{ display: 'inline-block', mx: 0.5 }} />
        <Skeleton variant="circular" width={30} height={30} sx={{ display: 'inline-block', mx: 0.5 }} />
      </Box>
    </ListItem>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      {Array.from(new Array(count)).map((_, index) => (
        mode === 'card' ? renderCardSkeleton(index) : renderListSkeleton(index)
      ))}
    </Box>
  );
};

export default TaskSkeleton; 