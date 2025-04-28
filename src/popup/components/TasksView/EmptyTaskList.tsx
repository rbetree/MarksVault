import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import BackupIcon from '@mui/icons-material/Backup';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
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
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        textAlign: 'center',
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
          
          <Divider sx={{ width: '100%', my: 2 }} />
          
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, alignSelf: 'flex-start' }}>
            您可以创建的任务示例:
          </Typography>
          
          <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            <ListItem>
              <ListItemIcon>
                <BackupIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="定时备份书签" 
                secondary="每天或每周自动将书签备份到GitHub，确保数据安全" 
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <CleaningServicesIcon color="secondary" />
              </ListItemIcon>
              <ListItemText 
                primary="自动整理书签" 
                secondary="定期清理失效链接，整理分类，保持书签列表整洁有序" 
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <EventRepeatIcon color="info" />
              </ListItemIcon>
              <ListItemText 
                primary="定制化自动任务" 
                secondary="根据您的需求创建自定义任务，提高书签管理效率" 
              />
            </ListItem>
          </List>
        </>
      )}
    </Paper>
  );
};

export default EmptyTaskList; 