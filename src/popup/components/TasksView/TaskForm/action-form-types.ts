// 与 OrganizeAction.operations 的元素结构保持一致，供表单状态在编辑过程中暂存
export interface ExtendedOrganizeOperation {
  operation: 'move' | 'delete' | 'rename' | 'validate' | 'tag';
  filters?: {
    pattern?: string;
    folder?: string;
    olderThan?: number;
    newerThan?: number;
  };
  target?: string;
  newName?: string;
}

export interface FolderOption {
  id: string;         // 文件夹ID
  title: string;      // 文件夹名称
  fullPath: string;   // 完整路径，如 "书签栏/工作/项目"
  depth: number;      // 嵌套深度，用于UI缩进显示
}

export const ORGANIZE_OPERATION_OPTIONS: Array<{
  value: ExtendedOrganizeOperation['operation'];
  label: string;
}> = [
  { value: 'move', label: '移动书签' },
  { value: 'rename', label: '重命名书签' },
  { value: 'tag', label: '添加标签' },
  { value: 'delete', label: '删除书签' },
  { value: 'validate', label: '验证书签' }
];
