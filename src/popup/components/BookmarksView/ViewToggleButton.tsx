import React from 'react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import { styled } from '@mui/material/styles';

// 样式化的ToggleButtonGroup
const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  marginLeft: 'auto',
  height: 36,
  '& .MuiToggleButtonGroup-grouped': {
    border: 0,
    '&:not(:first-of-type)': {
      borderRadius: theme.shape.borderRadius,
    },
    '&:first-of-type': {
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

// 样式化的ToggleButton
const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  padding: '5px 8px',
  borderRadius: theme.shape.borderRadius,
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
  // 处理视图类型更改
  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newViewType: 'list' | 'grid' | null
  ) => {
    if (newViewType !== null) {
      onChange(newViewType);
    }
  };

  return (
    <StyledToggleButtonGroup
      value={viewType}
      exclusive
      onChange={handleViewChange}
      aria-label="视图类型"
      size="small"
    >
      <Tooltip title="列表视图">
        <StyledToggleButton value="list" aria-label="列表视图">
          <ViewListIcon fontSize="small" />
        </StyledToggleButton>
      </Tooltip>
      <Tooltip title="网格视图">
        <StyledToggleButton value="grid" aria-label="网格视图">
          <GridViewIcon fontSize="small" />
        </StyledToggleButton>
      </Tooltip>
    </StyledToggleButtonGroup>
  );
};

export default ViewToggleButton; 