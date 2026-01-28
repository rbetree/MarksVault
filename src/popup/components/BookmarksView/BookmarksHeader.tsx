import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ViewToggleButton from './ViewToggleButton';

interface BookmarksHeaderProps {
    // Navigation props
    parentFolder?: { id: string; title: string };
    isSearching: boolean;
    onNavigateBack: () => void;

    // Search props
    searchText: string;
    onSearch: (query: string) => void;
    onClearSearch: () => void;

    // View props
    viewType: 'list' | 'grid';
    onViewTypeChange: (viewType: 'list' | 'grid') => void;
}

export const BookmarksHeaderTitle: React.FC<Pick<BookmarksHeaderProps, 'parentFolder' | 'isSearching' | 'onNavigateBack'>> = ({
    parentFolder,
    isSearching,
    onNavigateBack
}) => {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
            {isSearching ? (
                <Typography
                    variant="body2"
                    noWrap
                    sx={{
                        fontWeight: 400,
                        flex: 1,
                        fontSize: '0.9rem',
                        color: 'text.primary',
                    }}
                >
                    搜索结果
                </Typography>
            ) : parentFolder ? (
                <>
                    <IconButton onClick={onNavigateBack} size="small" sx={{ p: 0.5, mr: 0.5, ml: -0.5 }}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography
                        variant="body2"
                        noWrap
                        sx={{
                            fontWeight: 400,
                            flex: 1,
                            fontSize: '0.9rem',
                            color: 'text.primary'
                        }}
                    >
                        {parentFolder.title}
                    </Typography>
                </>
            ) : (
                <Typography
                    variant="body2"
                    noWrap
                    sx={{
                        fontWeight: 400,
                        flex: 1,
                        fontSize: '0.9rem',
                        color: 'text.primary',
                    }}
                >
                    书签栏
                </Typography>
            )}
        </Box>
    );
};

export const BookmarksHeaderActions: React.FC<Omit<BookmarksHeaderProps, 'parentFolder' | 'onNavigateBack'>> = ({
    searchText,
    onSearch,
    onClearSearch,
    viewType,
    onViewTypeChange
}) => {
    const [inputValue, setInputValue] = useState(searchText);
    const isComposingRef = useRef(false);

    useEffect(() => {
        if (!isComposingRef.current) {
            setInputValue(searchText);
        }
    }, [searchText]);

    const handleCompositionStart = () => {
        isComposingRef.current = true;
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
        isComposingRef.current = false;
        const value = (e.currentTarget.value ?? '') as string;
        setInputValue(value);
        onSearch(value);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const nativeIsComposing = (e.nativeEvent as any)?.isComposing;

        setInputValue(value);
        if (isComposingRef.current || nativeIsComposing) return;
        onSearch(value);
    };

    const handleSearchBlur = () => {
        isComposingRef.current = false;
    };

    const clearSearch = () => {
        setInputValue('');
        onClearSearch();
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <InputBase
                sx={{
                    pl: 0.5,
                    flex: 1,
                    fontSize: '0.9rem',
                    fontWeight: 400,
                    fontFamily: 'inherit',
                    color: 'text.primary'
                }}
                placeholder="搜索..."
                value={inputValue}
                onChange={handleSearchChange}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onBlur={handleSearchBlur}
            />
            {inputValue && (
                <IconButton sx={{ p: 0.5 }} aria-label="清除" onClick={clearSearch}>
                    <ClearIcon fontSize="small" />
                </IconButton>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5, borderLeft: '1px solid rgba(255,255,255,0.1)', pl: 0.5 }}>
                <ViewToggleButton
                    viewType={viewType}
                    onChange={onViewTypeChange}
                />
            </Box>
        </Box>
    );
};

/**
 * 书签页顶部栏：将“标题区”和“操作区”合并到同一个容器中，并把分隔线放到中间。
 */
export const BookmarksHeader: React.FC<BookmarksHeaderProps> = (props) => {
    const {
        parentFolder,
        isSearching,
        onNavigateBack,
        searchText,
        onSearch,
        onClearSearch,
        viewType,
        onViewTypeChange,
    } = props;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                <BookmarksHeaderTitle
                    parentFolder={parentFolder}
                    isSearching={isSearching}
                    onNavigateBack={onNavigateBack}
                />
            </Box>

            <Box
                sx={{
                    width: '1px',
                    height: 22,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    flex: '0 0 auto',
                }}
            />

            <Box sx={{ flex: 1, minWidth: 0, pl: 1 }}>
                <BookmarksHeaderActions
                    isSearching={isSearching}
                    searchText={searchText}
                    onSearch={onSearch}
                    onClearSearch={onClearSearch}
                    viewType={viewType}
                    onViewTypeChange={onViewTypeChange}
                />
            </Box>
        </Box>
    );
};
