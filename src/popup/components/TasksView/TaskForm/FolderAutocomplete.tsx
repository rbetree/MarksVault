import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import FolderIcon from '@mui/icons-material/Folder';
import { FolderOption } from './action-form-types';

interface FolderAutocompleteProps {
  id: string;
  options: FolderOption[];
  loading: boolean;
  value: FolderOption | null;
  error?: string;
  onChange: (folder: FolderOption | null) => void;
}

/**
 * 书签目标文件夹选择控件
 */
const FolderAutocomplete: React.FC<FolderAutocompleteProps> = ({
  id,
  options,
  loading,
  value,
  error,
  onChange
}) => {
  return (
    <Autocomplete
      id={id}
      options={options}
      fullWidth
      size="small"
      loading={loading}
      getOptionLabel={(option) => option.fullPath}
      isOptionEqualToValue={(option, selectedValue) => option.id === selectedValue.id}
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      freeSolo={false}
      autoHighlight
      openOnFocus={false}
      filterOptions={(filterOptions, state) => {
        const inputValue = state.inputValue.toLowerCase().trim();
        if (!inputValue) return []; // 无输入时不显示选项

        return filterOptions.filter(option =>
          option.title.toLowerCase().includes(inputValue) ||
          option.fullPath.toLowerCase().includes(inputValue)
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="目标文件夹"
          placeholder="输入文件夹名称筛选"
          error={!!error}
          helperText={error || "输入文件夹名称进行筛选后选择"}
          required
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <React.Fragment>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </React.Fragment>
            ),
            startAdornment: (
              <React.Fragment>
                <FolderIcon color="action" sx={{ ml: 0.5, mr: 1 }} />
              </React.Fragment>
            )
          }}
        />
      )}
      renderOption={(props, option) => {
        // 从props中提取key属性，其余属性放入rest
        const { key, ...rest } = props;

        return (
          <li key={key} {...rest} style={{padding: '1px 8px', minHeight: '22px'}}>
            <Box component="span" sx={{
              pl: option.depth * 1,
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.8rem',
              py: 0
            }}>
              <FolderIcon fontSize="small" sx={{ mr: 0.5, color: 'action.active', fontSize: '0.9rem' }} />
              <Box component="span" sx={{
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {option.title}
              </Box>
              <Box component="span" sx={{
                ml: 0.5,
                color: 'text.secondary',
                fontSize: '0.7rem',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                ({option.fullPath})
              </Box>
            </Box>
          </li>
        );
      }}
      ListboxProps={{
        style: {
          maxHeight: '200px',
        }
      }}
    />
  );
};

export default FolderAutocomplete;
