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

// 扁平化项，包含索引和路径信息
interface FlattenedItem {
  selection: BookmarkSelection;
  flatIndex: number; // 扁平化后的唯一索引
  depth: number; // 嵌套深度
  path: number[]; // 在嵌套结构中的路径 [parentIndex, childIndex, ...]
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

  // 同步 selections 到 selectedIds（包括所有子节点）
  useEffect(() => {
    const ids = new Set<string>();
    
    const collectSelectionIds = (selection: BookmarkSelection) => {
      ids.add(selection.id);
      if (selection.children) {
        selection.children.forEach(child => collectSelectionIds(child));
      }
    };
    
    selections.forEach(selection => collectSelectionIds(selection));
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
    console.log('[BookmarkSelector] collectAllChildIds:', {
      nodeId: node.id,
      nodeTitle: node.title,
      hasChildren: !!node.children,
      childrenCount: node.children?.length || 0,
      collectedIds: ids,
      collectedCount: ids.length
    });
    return ids;
  };

  // 将节点转换为 BookmarkSelection
  const nodeToSelection = (node: chrome.bookmarks.BookmarkTreeNode): BookmarkSelection => {
    console.log('[BookmarkSelector] nodeToSelection called:', {
      nodeId: node.id,
      nodeTitle: node.title,
      nodeType: node.url ? 'bookmark' : 'folder',
      hasChildren: !!node.children,
      childrenCount: node.children?.length || 0
    });

    const selection: BookmarkSelection = {
      id: node.id,
      title: node.title || '未命名',
      type: node.url ? 'bookmark' : 'folder',
      url: node.url
    };

    if (node.children && node.children.length > 0) {
      selection.children = node.children.map(child => nodeToSelection(child));
      console.log('[BookmarkSelector] nodeToSelection created children:', {
        parentId: node.id,
        parentTitle: node.title,
        childrenCount: selection.children.length
      });
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

    console.log('[BookmarkSelector] Toggle selection:', {
      nodeId: node.id,
      nodeTitle: node.title,
      nodeType: node.url ? 'bookmark' : 'folder',
      hasChildren: !!node.children,
      childrenCount: node.children?.length || 0,
      collectedIds: allIds,
      currentlySelected: newSelectedIds.has(node.id)
    });

    if (newSelectedIds.has(node.id)) {
      // 取消选中:移除所有相关ID
      allIds.forEach(id => newSelectedIds.delete(id));
    } else {
      // 选中:添加所有相关ID
      allIds.forEach(id => newSelectedIds.add(id));
    }

    console.log('[BookmarkSelector] After toggle:', {
      newSelectedIdsSize: newSelectedIds.size,
      newSelectedIds: Array.from(newSelectedIds)
    });

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
    console.log('[BookmarkSelector] convertToSelections start:', {
      idsCount: ids.size,
      ids: Array.from(ids)
    });

    const selections: BookmarkSelection[] = [];

    // 过滤掉那些是其他选中节点子节点的ID
    ids.forEach(id => {
      const node = findNode(bookmarkTree, id);
      if (!node) {
        console.log('[BookmarkSelector] Node not found:', id);
        return;
      }

      // 检查此ID是否是其他选中节点的子节点
      let isChildOfSelected = false;
      for (const selectedId of ids) {
        if (selectedId === id) continue; // 跳过自己
        
        const parentNode = findNode(bookmarkTree, selectedId);
        if (parentNode && parentNode.children) {
          const childIds = collectAllChildIds(parentNode);
          // 如果当前ID在其他节点的子ID列表中，且不是该节点本身
          if (childIds.includes(id) && selectedId !== id) {
            isChildOfSelected = true;
            console.log('[BookmarkSelector] Skipping child node:', {
              childId: id,
              childTitle: node.title,
              parentId: selectedId,
              parentTitle: parentNode.title
            });
            break;
          }
        }
      }

      // 只处理顶层选中项（不是其他选中项的子节点）
      if (!isChildOfSelected) {
        const selection = nodeToSelection(node);
        selections.push(selection);
        console.log('[BookmarkSelector] Added selection:', {
          id: selection.id,
          title: selection.title,
          type: selection.type,
          hasChildren: !!selection.children,
          childrenCount: selection.children?.length || 0
        });
      }
    });

    console.log('[BookmarkSelector] convertToSelections result:', {
      selectionsCount: selections.length,
      selections: selections.map(s => ({ id: s.id, title: s.title, type: s.type }))
    });

    onChange(selections);
  };

  // 将嵌套的 selections 扁平化为一维数组
  const flattenSelections = (selections: BookmarkSelection[]): FlattenedItem[] => {
    const flattened: FlattenedItem[] = [];
    let flatIndex = 0;

    const flatten = (
      items: BookmarkSelection[],
      depth: number,
      parentPath: number[]
    ) => {
      items.forEach((item, localIndex) => {
        const currentPath = [...parentPath, localIndex];
        flattened.push({
          selection: item,
          flatIndex: flatIndex++,
          depth,
          path: currentPath
        });

        if (item.children && item.children.length > 0) {
          flatten(item.children, depth + 1, currentPath);
        }
      });
    };

    flatten(selections, 0, []);
    return flattened;
  };

  // 从扁平化数组重建嵌套结构
  const rebuildNestedStructure = (flattened: FlattenedItem[]): BookmarkSelection[] => {
    if (flattened.length === 0) return [];

    // 创建所有项的副本
    const itemsCopy: BookmarkSelection[] = flattened.map(item => ({
      ...item.selection,
      children: item.selection.children ? [] : undefined
    }));

    // 按路径重建树结构
    const root: BookmarkSelection[] = [];
    
    flattened.forEach((item, index) => {
      const { path } = item;
      const itemCopy = itemsCopy[index];

      if (path.length === 1) {
        // 顶层项
        root.push(itemCopy);
      } else {
        // 查找父项
        let parent: BookmarkSelection | BookmarkSelection[] = root;
        for (let i = 0; i < path.length - 1; i++) {
          if (Array.isArray(parent)) {
            parent = parent[path[i]];
          } else if (parent.children) {
            parent = parent.children[path[i]];
          }
        }
        
        // 添加到父项的 children
        if (!Array.isArray(parent) && parent.children) {
          parent.children.push(itemCopy);
        }
      }
    });

    return root;
  };

  // 从嵌套结构中移除指定路径的项
  const removeItemByPath = (
    selections: BookmarkSelection[],
    path: number[]
  ): BookmarkSelection[] => {
    if (path.length === 0) return selections;
    
    const newSelections = JSON.parse(JSON.stringify(selections)) as BookmarkSelection[];
    
    if (path.length === 1) {
      // 移除顶层项
      newSelections.splice(path[0], 1);
      return newSelections;
    }
    
    // 导航到父项
    let current: BookmarkSelection | BookmarkSelection[] = newSelections;
    for (let i = 0; i < path.length - 1; i++) {
      if (Array.isArray(current)) {
        current = current[path[i]];
      } else if (current.children) {
        current = current.children[path[i]];
      }
    }
    
    // 从父项的 children 中移除
    if (!Array.isArray(current) && current.children) {
      current.children.splice(path[path.length - 1], 1);
    }
    
    return newSelections;
  };

  // 在指定路径插入项
  const insertItemAtPath = (
    selections: BookmarkSelection[],
    path: number[],
    item: BookmarkSelection
  ): BookmarkSelection[] => {
    if (path.length === 0) return selections;
    
    const newSelections = JSON.parse(JSON.stringify(selections)) as BookmarkSelection[];
    
    if (path.length === 1) {
      // 插入到顶层
      newSelections.splice(path[0], 0, item);
      return newSelections;
    }
    
    // 导航到父项
    let current: BookmarkSelection | BookmarkSelection[] = newSelections;
    for (let i = 0; i < path.length - 1; i++) {
      if (Array.isArray(current)) {
        current = current[path[i]];
      } else if (current.children) {
        current = current.children[path[i]];
      }
    }
    
    // 插入到父项的 children
    if (!Array.isArray(current) && current.children) {
      current.children.splice(path[path.length - 1], 0, item);
    }
    
    return newSelections;
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

  // 放置 - 支持嵌套结构的拖拽
  const handleDrop = (e: React.DragEvent, targetFlatIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === targetFlatIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 扁平化当前 selections
    const flattened = flattenSelections(selections);
    
    // 查找被拖拽项和目标项
    const draggedItem = flattened.find(item => item.flatIndex === draggedIndex);
    const targetItem = flattened.find(item => item.flatIndex === targetFlatIndex);
    
    if (!draggedItem || !targetItem) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 防止将父项拖到自己的子项中
    const isTargetChildOfDragged = targetItem.path.length > draggedItem.path.length &&
      targetItem.path.slice(0, draggedItem.path.length).every((v, i) => v === draggedItem.path[i]);
    
    if (isTargetChildOfDragged) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // 步骤1: 从原位置移除
    let newSelections = removeItemByPath(selections, draggedItem.path);
    
    // 步骤2: 调整目标路径（如果目标在被移除项之后）
    let adjustedTargetPath = [...targetItem.path];
    
    // 如果在同一层级且目标在源之后，需要调整索引
    if (draggedItem.path.length === targetItem.path.length) {
      const sameParent = draggedItem.path.slice(0, -1).every((v, i) => v === targetItem.path[i]);
      if (sameParent && targetItem.path[targetItem.path.length - 1] > draggedItem.path[draggedItem.path.length - 1]) {
        adjustedTargetPath[adjustedTargetPath.length - 1]--;
      }
    }
    
    // 步骤3: 在目标位置插入
    newSelections = insertItemAtPath(newSelections, adjustedTargetPath, draggedItem.selection);

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
          
          {!isFolder && (
            <Box sx={{ width: 28, mr: 0.5 }} />
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
      <Grid item xs={6}>
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
      <Grid item xs={6}>
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
              position: 'relative',
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
                {(() => {
                  // 扁平化 selections 以获取唯一索引
                  const flattened = flattenSelections(selections);
                  
                  // 渲染选中项（使用扁平化索引）
                  const renderSelectionItem = (
                    flattenedItem: FlattenedItem
                  ): React.ReactNode => {
                    const { selection, flatIndex, depth } = flattenedItem;
                    
                    return (
                      <Box key={selection.id}>
                        <ListItem
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, flatIndex)}
                          onDragOver={(e) => handleDragOver(e, flatIndex)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, flatIndex)}
                          onDragEnd={handleDragEnd}
                          sx={{
                            px: 1,
                            py: 0.5,
                            mb: 0.5,
                            ml: depth * 3,
                            width: `calc(100% - ${depth * 24}px)`,
                            boxSizing: 'border-box',
                            bgcolor: draggedIndex === flatIndex ? 'action.selected' :
                                     dragOverIndex === flatIndex ? 'action.hover' :
                                     'background.paper',
                            border: '1px solid',
                            borderColor: dragOverIndex === flatIndex ? 'primary.main' : 'divider',
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
                          
                          {selection.type === 'folder' ? (
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
                            {selection.title}{selection.type === 'folder' ? '/' : ''}
                          </Typography>

                          <IconButton
                            size="small"
                            onClick={() => handleRemoveSelection(selection.id)}
                            sx={{ p: 0.5 }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </ListItem>
                      </Box>
                    );
                  };

                  return flattened.map(item => renderSelectionItem(item));
                })()}
              </List>
            )}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default BookmarkSelector;