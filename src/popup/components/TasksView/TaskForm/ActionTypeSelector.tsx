import React from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BackupIcon from '@mui/icons-material/Backup';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import UploadIcon from '@mui/icons-material/Upload';
import { ActionType } from '../../../../types/task';

interface ActionTypeOption {
  type: ActionType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ACTION_TYPE_OPTIONS: ActionTypeOption[] = [
  {
    type: ActionType.BACKUP,
    title: '备份/恢复',
    description: '',
    icon: <BackupIcon fontSize="medium" />
  },
  {
    type: ActionType.PUSH,
    title: '推送书签',
    description: '',
    icon: <UploadIcon fontSize="medium" />
  },
  {
    type: ActionType.SELECTIVE_PUSH,
    title: '选择性推送',
    description: '选择特定书签推送',
    icon: <UploadIcon fontSize="medium" />
  },
  {
    type: ActionType.ORGANIZE,
    title: '整理书签',
    description: '',
    icon: <CleaningServicesIcon fontSize="medium" />
  }
];

interface ActionTypeSelectorProps {
  selectedType: ActionType;
  onSelect: (type: ActionType) => void;
  marginBottom?: boolean;
}

/**
 * 操作类型选择卡片，任务弹窗与独立配置页共用
 */
const ActionTypeSelector: React.FC<ActionTypeSelectorProps> = ({
  selectedType,
  onSelect,
  marginBottom = false
}) => {
  return (
    <Grid container spacing={2} sx={marginBottom ? { mb: 2 } : undefined}>
      {ACTION_TYPE_OPTIONS.map((option) => (
        <Grid item xs={6} sm={4} key={option.type}>
          <Card
            sx={{
              cursor: 'pointer',
              height: '100%',
              borderColor: selectedType === option.type ? 'primary.main' : 'divider',
              borderWidth: selectedType === option.type ? 2 : 1,
              borderStyle: 'solid',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: selectedType === option.type ? 1 : 0
            }}
            onClick={() => onSelect(option.type)}
          >
            <CardContent sx={{ p: 1.5, textAlign: 'center', '&:last-child': { pb: 1.5 } }}>
              <Box sx={{
                width: '40px',
                height: '40px',
                margin: '0 auto 10px',
                mb: 1.5,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: selectedType === option.type ? 'primary.main' : 'text.secondary',
                backgroundColor: selectedType === option.type ? 'action.selected' : 'transparent'
              }}>
                {option.icon}
              </Box>
              <Typography variant="body1" component="div" sx={{ fontWeight: 500 }}>
                {option.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '10px', mt: 0.5 }}>
                {option.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default ActionTypeSelector;
