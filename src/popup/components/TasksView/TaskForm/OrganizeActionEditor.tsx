import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import OrganizeOperationItem from './OrganizeOperationItem';
import { ExtendedOrganizeOperation, FolderOption } from './action-form-types';

interface OrganizeActionEditorProps {
  operations: ExtendedOrganizeOperation[];
  errors: { [key: string]: string };
  folders: FolderOption[];
  foldersLoading: boolean;
  selectedFolders: { [key: number]: FolderOption | null };
  onAddOperation: () => void;
  onDeleteOperation: (index: number) => void;
  onUpdateOperation: (index: number, field: string, value: any) => void;
}

/**
 * 整理书签操作配置表单
 */
const OrganizeActionEditor: React.FC<OrganizeActionEditorProps> = ({
  operations,
  errors,
  folders,
  foldersLoading,
  selectedFolders,
  onAddOperation,
  onDeleteOperation,
  onUpdateOperation
}) => {
  return (
    <Box sx={{ mt: 0 }}>
      <Box
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          整理操作配置
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          添加书签整理规则：
        </Typography>

        {operations.length === 0 ? (
          <Box
            sx={{
              p: 1.5,
              mb: 1.5,
              bgcolor: 'action.hover',
              borderRadius: 1,
              textAlign: 'center',
              color: 'text.secondary'
            }}
          >
            <Typography variant="body2">
              暂无整理规则，请点击下方按钮添加
            </Typography>
          </Box>
        ) : (
          operations.map((operation, index) => (
            <OrganizeOperationItem
              key={index}
              operation={operation}
              index={index}
              errors={errors}
              folders={folders}
              foldersLoading={foldersLoading}
              selectedFolder={selectedFolders[index] || null}
              showDivider={index < operations.length - 1}
              onUpdate={onUpdateOperation}
              onDelete={onDeleteOperation}
            />
          ))
        )}

        <Button
          startIcon={<AddCircleOutlineIcon />}
          onClick={onAddOperation}
          variant="outlined"
          size="small"
          sx={{ mt: 0.5 }}
        >
          添加操作
        </Button>
      </Box>
    </Box>
  );
};

export default OrganizeActionEditor;
