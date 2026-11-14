import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderAutocomplete from './FolderAutocomplete';
import {
  ExtendedOrganizeOperation,
  FolderOption,
  ORGANIZE_OPERATION_OPTIONS
} from './action-form-types';

interface OrganizeOperationItemProps {
  operation: ExtendedOrganizeOperation;
  index: number;
  errors: { [key: string]: string };
  folders: FolderOption[];
  foldersLoading: boolean;
  selectedFolder: FolderOption | null;
  showDivider: boolean;
  onUpdate: (index: number, field: string, value: any) => void;
  onDelete: (index: number) => void;
}

/**
 * 单条整理规则配置块
 */
const OrganizeOperationItem: React.FC<OrganizeOperationItemProps> = ({
  operation,
  index,
  errors,
  folders,
  foldersLoading,
  selectedFolder,
  showDivider,
  onUpdate,
  onDelete
}) => {
  return (
    <Box
      sx={{
        mb: 2,
        mt: 1,
      }}
    >
      <Grid container spacing={1.5} alignItems="center">
        <Grid item xs={10}>
          <FormControl fullWidth size="small" margin="dense">
            <InputLabel>操作</InputLabel>
            <Select
              value={operation.operation}
              onChange={(e) => onUpdate(index, 'operation', e.target.value)}
              label="操作"
            >
              {ORGANIZE_OPERATION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={2} sx={{ textAlign: 'right' }}>
          <IconButton
            onClick={() => onDelete(index)}
            size="small"
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            size="small"
            margin="dense"
            label="匹配规则"
            placeholder="例如: *google*"
            value={operation.filters?.pattern || ''}
            onChange={(e) => onUpdate(index, 'filters.pattern', e.target.value)}
            helperText="支持通配符 * 匹配书签标题或URL"
          />
        </Grid>

        {operation.operation === 'move' && (
          <>
            <Grid item xs={12}>
              <FolderAutocomplete
                id={`folder-select-${index}`}
                options={folders}
                loading={foldersLoading}
                value={selectedFolder}
                error={errors[`operation_${index}_target`]}
                onChange={(folder) => onUpdate(index, 'target', folder)}
              />
            </Grid>
          </>
        )}

        {operation.operation === 'delete' && (
          <Grid item xs={12}>
            <Typography variant="body2" color="warning.main" sx={{ mt: 1, mb: 1 }}>
              此操作将删除符合上方匹配规则的所有书签，请谨慎使用。
            </Typography>
          </Grid>
        )}

        {operation.operation === 'validate' && (
          <Grid item xs={12}>
            <Typography variant="body2" color="info.main" sx={{ mt: 1, mb: 1 }}>
              此操作将检查符合上方匹配规则的书签URL有效性。
            </Typography>
          </Grid>
        )}

        {operation.operation === 'rename' && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              margin="dense"
              label="新名称格式"
              placeholder="例如: [前缀]书签名"
              value={operation.newName || ''}
              onChange={(e) => onUpdate(index, 'newName', e.target.value)}
              helperText={errors[`operation_${index}_newName`] || "可以使用{name}引用原书签名"}
              error={!!errors[`operation_${index}_newName`]}
              required
            />
          </Grid>
        )}

        {operation.operation === 'tag' && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              margin="dense"
              label="标签名称"
              placeholder="例如: 工作"
              value={operation.newName || ''}
              onChange={(e) => onUpdate(index, 'newName', e.target.value)}
              helperText={errors[`operation_${index}_newName`] || "要添加的标签名称"}
              error={!!errors[`operation_${index}_newName`]}
              required
            />
          </Grid>
        )}
      </Grid>
      {showDivider && (
        <Divider sx={{ mt: 2 }} />
      )}
    </Box>
  );
};

export default OrganizeOperationItem;
