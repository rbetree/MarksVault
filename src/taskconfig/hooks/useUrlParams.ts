import { useMemo } from 'react';

export type TaskConfigMode = 'create' | 'edit';

interface UrlParams {
  mode: TaskConfigMode;
  taskId?: string;
}

/**
 * 解析URL的query参数
 * @returns mode和taskId
 */
export function useUrlParams(): UrlParams {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as TaskConfigMode;
    const taskId = params.get('taskId') || undefined;

    return {
      mode: mode === 'edit' ? 'edit' : 'create',
      taskId,
    };
  }, []);
}