import { useState, useEffect } from 'react';
import { Task, createDefaultTask } from '../../types/task';
import taskService from '../../services/task-service';
import { TaskConfigMode } from './useUrlParams';

interface UseTaskConfigDataResult {
  taskData: Task | null;
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  saveError: string | null;
  clearSaveError: () => void;
  saveTask: (task: Task) => Promise<{ success: boolean; taskId?: string; error?: string }>;
}

/**
 * 管理任务配置数据的加载和保存
 * @param mode 配置模式（创建或编辑）
 * @param taskId 任务ID（编辑模式下需要）
 */
export function useTaskConfigData(
  mode: TaskConfigMode,
  taskId?: string
): UseTaskConfigDataResult {
  const [taskData, setTaskData] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 加载任务数据
  useEffect(() => {
    const loadTask = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        if ((mode === 'edit' || mode === 'execute') && taskId) {
          // 编辑模式或执行模式：加载指定任务
          const result = await taskService.getTaskById(taskId);
          if (result.success && result.data) {
            setTaskData(result.data);
          } else {
            setLoadError(result.error || '加载任务失败');
            setTaskData(null);
          }
        } else {
          // 创建模式：使用默认任务
          setTaskData(createDefaultTask());
        }
      } catch (err) {
        console.error('加载任务数据时出错:', err);
        setLoadError('加载任务数据时发生错误');
        setTaskData(null);
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [mode, taskId]);

  // 保存任务
  const saveTask = async (
    task: Task
  ): Promise<{ success: boolean; taskId?: string; error?: string }> => {
    setSaving(true);
    setSaveError(null);

    try {
      let result;

      if (mode === 'edit') {
        // 更新现有任务
        result = await taskService.updateTask(task.id, task);
      } else {
        // 创建新任务
        result = await taskService.createTask(task);
      }

      if (result.success) {
        const savedTask = result.data as Task;
        setTaskData(savedTask);
        return {
          success: true,
          taskId: savedTask.id,
        };
      } else {
        const errorMsg = result.error || '保存任务失败';
        setSaveError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (err) {
      console.error('保存任务时出错:', err);
      const errorMsg = '保存任务时发生错误';
      setSaveError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setSaving(false);
    }
  };

  const clearSaveError = () => setSaveError(null);

  return {
    taskData,
    loading,
    loadError,
    saving,
    saveError,
    clearSaveError,
    saveTask,
  };
}
