import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import CircularProgress from '@mui/material/CircularProgress';
import FolderIcon from '@mui/icons-material/Folder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { BookmarkSelection } from '../../../../types/task';

interface BookmarkSelectorProps {
  selections: BookmarkSelection[];
  onChange: (selections: BookmarkSelection[]) => void;
  maxHeight?: string;
}

/**
 * 书签选择器组件
 * 支持混合选择书签和文件夹,并支持拖放重新排序
 */
const BookmarkSelector: React.FC<BookmarkSelectorProps> = ({
  selections,
  onChange,
  maxHeight = '400px'
}) => {
  // 状态管理
  const [bookmarkTree, setBookmarkTree] = useState<chrome.bookmarks.BookmarkTreeNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 加载书签树
  const loadBookmarkTree = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await chrome.bookmarks.getTree();
      setBookmarkTree(tree);
      
      // 默认展开根节点
      if (tree.length > 0 && tree[0].children) {
        const rootIds = tree[0].children.map(node => node.id);
        setExpandedIds(new Set(rootIds));
      }
    } catch (error) {
      console.error('加载书签树失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 组件挂载时加载书签树
  useEffect(() => {
    loadBookmarkTree();
  }, [loadBookmarkTree]);

  // 同步 selections 到 selectedIds
  useEffect(() => {
    const ids = new Set(selections.map(s => s.id));
    setSelectedIds(ids);
  }, [selections]);

  // 递归收集所有子节点的ID
  const collectAllChildIds = (node: chrome.bookmarks.BookmarkTreeNode): string[] => {
    const ids: string[] = [node.id];
    if (node.children) {
      node.children.forEach(child => {
        ids.push(...collectAllChildIds(child));
      });
    }
    return ids;
  };

  // 将节点转换为 BookmarkSelection
  const nodeToSelection = (node: chrome.bookmarks.BookmarkTreeNode): BookmarkSelection => {
    const selection: BookmarkSelection = {
      id: node.id,
      title: node.title || '未命名',
      type: node.url ? 'bookmark' : 'folder',
      url: node.url
    };

    if (node.children && node.children.length > 0) {
      selection.children = node.children.map(child => nodeToSelection(child));
    }

    return selection;
  };

  // 查找节点
  const findNode = (
    tree: chrome.bookmarks.BookmarkTreeNode[],
    id: string
  ): chrome.bookmarks.BookmarkTreeNode | null => {
    for (const node of tree) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // 切换选中状态
  const handleToggleSelection = (node: chrome.bookmarks.BookmarkTreeNode) => {
    const newSelectedIds = new Set(selectedIds);
    const allIds = collectAllChildIds(node);

    if (newSelectedIds.has(node.id)) {
      // 取消选中:移除所有相关ID
      allIds.forEach(id => newSelectedIds.delete(id));
    } else {
      // 选中:添加所有相关ID
      allIds.forEach(id => newSelectedIds.add(id));
    }

    setSelectedIds(newSelectedIds);
    convertToSelections(newSelectedIds);
  };

  // 切换展开状态
  const handleToggleExpand = (folderId: string) => {
    const newExpandedIds = new Set(expandedIds);
    if (newExpandedIds.has(folderId)) {
      newExpandedIds.delete(folderId);
    } else {
      newExpandedIds.add(folderId);
    }
    setExpandedIds(newExpandedIds);
  };

  // 全选
  const handleSelectAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      nodes.forEach(node => {
        allIds.add(node.id);
        if (node.children) {
          collectIds(node.children);
        }
      });
    };
    collectIds(bookmarkTree);
    setSelectedIds(allIds);
    convertToSelections(allIds);
  };

  // 取消全选
  const handleClearAll = () => {
    setSelectedIds(new Set());
    onChange([]);
  };

  // 从选中列表移除
  const handleRemoveSelection = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    newSelectedIds.delete(id);
    
    // 如果移除的是文件夹,也要移除其所有子项
    const node = findNode(bookmarkTree, id);
    if (node) {
      const allIds = collectAllChildIds(node);
      allIds.forEach(childId => newSelectedIds.delete(childId));
    }
    
    setSelectedIds(newSelectedIds);
    convertToSelections(newSelectedIds);
  };

  // 将ID集合转换为BookmarkSelection数组
  const convertToSelections = (ids: Set<string>) => {
    const selections: BookmarkSelection[] = [];
    const processedIds = new Set<string>();

    // 收集顶层选中的节点(不是其他选中节点的子节点)
    ids.forEach(id => {
      if (processedIds.has(id)) return;

      const node = findNode(bookmarkTree, id);
      if (!node) return;

      // 检查是否是其他选中节点的子节点
      let isChild = false;
      ids.forEach(parentId => {
        if (parentId === id) return;
        const parentNode = findNode(bookmarkTree, parentId);
        if (parentNode) {
          const childIds = collectAllChildIds(parentNode);
          if (childIds.includes(id)) {
            isChild = true;
          }
        }
      });

      if (!isChild) {
        const selection = nodeToSelection(node);
        selections.push(selection);
        
        // 标记此节点及其所有子节点为已处理
        const allIds = collectAllChildIds(node);
        allIds.forEach(childId => processedIds.add(childId));
      }
    });

    onChange(selections);
  };

  // 拖动开始
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 拖动经过
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // 拖动离开
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // 放置
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSelections = [...selections];
    const [draggedItem] = newSelections.splice(draggedIndex, 1);
    newSelections.splice(targetIndex, 0, draggedItem);

    onChange(newSelections);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 拖动结束
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 递归渲染书签树
  const renderBookmarkNode = (
    node: chrome.bookmarks.BookmarkTreeNode,
    depth: number = 0
  ): React.ReactNode => {
    const isFolder = !node.url;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    // 跳过根节点和书签栏的父节点
    if (!node.title && depth === 0) {
      return node.children?.map(child => renderBookmarkNode(child, depth));
    }

    return (
      <Box key={node.id}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            pl: depth * 2,
            py: 0.5,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover'
            },
            bgcolor: isSelected ? 'action.selected' : 'transparent'
          }}
        >
          {isFolder && hasChildren && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand(node.id);
              }}
              sx={{ p: 0.5, mr: 0.5 }}
            >
              {isExpanded ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          )}
          
          {isFolder && !hasChildren && (
            <Box sx={{ width: 24, mr: 0.5 }} />
          )}

          <Checkbox
            size="small"
            checked={isSelected}
            onChange={() => handleToggleSelection(node)}
            sx={{ p: 0.5 }}
          />

          <Box
            sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
            onClick={() => handleToggleSelection(node)}
          >
            {isFolder ? (
              <FolderIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />
            ) : (
              <BookmarkIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />
            )}
            <Typography
              variant="body2"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {node.title || '未命名'}
            </Typography>
          </Box>
        </Box>

        {isFolder && hasChildren && isExpanded && (
          <Box>
            {node.children!.map(child => renderBookmarkNode(child, depth + 1))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Grid container spacing={2}>
      {/* 左侧:书签树 */}
      <Grid item xs={7}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            height: maxHeight,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            选择书签
          </Typography>

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              mb: 1,
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'transparent'
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'divider',
                borderRadius: '4px',
                '&:hover': {
                  bgcolor: 'action.disabled'
                }
              }
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              bookmarkTree.map(node => renderBookmarkNode(node, 0))
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleSelectAll}
              fullWidth
            >
              全选
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleClearAll}
              fullWidth
            >
              取消全选
            </Button>
          </Box>
        </Paper>
      </Grid>

      {/* 右侧:已选列表 */}
      <Grid item xs={5}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            height: maxHeight,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            已选择 ({selections.length})
          </Typography>

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'transparent'
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'divider',
                borderRadius: '4px',
                '&:hover': {
                  bgcolor: 'action.disabled'
                }
              }
            }}
          >
            {selections.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary'
                }}
              >
                <Typography variant="body2">未选择任何项</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {selections.map((item, index) => (
                  <ListItem
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    sx={{
                      px: 1,
                      py: 0.5,
                      mb: 0.5,
                      bgcolor: draggedIndex === index ? 'action.selected' : 
                               dragOverIndex === index ? 'action.hover' : 
                               'background.paper',
                      border: '1px solid',
                      borderColor: dragOverIndex === index ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'move',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        borderColor: 'primary.light'
                      }
                    }}
                  >
                    <DragIndicatorIcon
                      fontSize="small"
                      sx={{ mr: 1, color: 'action.active', cursor: 'grab' }}
                    />
                    
                    {item.type === 'folder' ? (
                      <FolderIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />
                    ) : (
                      <BookmarkIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />
                    )}

                    <Typography
                      variant="body2"
                      sx={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mr: 1
                      }}
                    >
                      {item.title}{item.type === 'folder' ? '/' : ''}
                    </Typography>

                    <IconButton
                      size="small"
                      onClick={() => handleRemoveSelection(item.id)}
                      sx={{ p: 0.5 }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default BookmarkSelector;