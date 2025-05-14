import React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import { styled } from '@mui/material/styles';

// 样式化的IconButton
const StyledIconButton = styled(IconButton)(({ theme }) => ({
  padding: '5px 8px',
  borderRadius: theme.shape.borderRadius,
  marginLeft: 'auto',
  height: 36,
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
}));

interface ViewToggleButtonProps {
  viewType: 'list' | 'grid';
  onChange: (viewType: 'list' | 'grid') => void;
}

const ViewToggleButton: React.FC<ViewToggleButtonProps> = ({ viewType, onChange }) => {
  // 处理视图类型切换
  const handleViewChange = () => {
    // 切换到另一种视图类型
    const newViewType = viewType === 'list' ? 'grid' : 'list';
    onChange(newViewType);
  };

  // 根据当前视图类型显示不同的图标（显示对应的"另一个"视图的图标）
  const icon = viewType === 'list' 
    ? <GridViewIcon fontSize="small" /> // 当前是列表视图，显示网格图标表示可以切换到网格视图
    : <ViewListIcon fontSize="small" />; // 当前是网格视图，显示列表图标表示可以切换到列表视图

  const tooltipTitle = viewType === 'list' ? '切换到网格视图' : '切换到列表视图';

  return (
    <Tooltip title={tooltipTitle}>
      <StyledIconButton 
        onClick={handleViewChange} 
        aria-label={tooltipTitle}
        size="small"
        color="primary"
      >
        {icon}
      </StyledIconButton>
    </Tooltip>
  );
};

export default ViewToggleButton; 