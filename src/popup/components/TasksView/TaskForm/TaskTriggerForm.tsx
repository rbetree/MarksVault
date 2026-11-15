import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  Trigger,
  TriggerType,
  EventTrigger,
  EventType,
  ManualTrigger,
  ActionType,
  Action,
  BackupAction,
  createEventTrigger,
  createManualTrigger
} from '../../../../types/task';
import {
  EMPTY_TRIGGER_CONDITION_DRAFT,
  TriggerConditionDraft,
  buildTriggerConditions,
  triggerConditionDraftFromConditions,
  validateTriggerConditionDraft
} from './trigger-validation';

// 定义统一的触发方式类型
type TriggerOption = {
  value: string;
  label: string;
  eventType: EventType;
};

// 触发方式选项
const TRIGGER_OPTIONS: TriggerOption[] = [
  { value: 'event_browser_startup', label: '浏览器启动时', eventType: EventType.BROWSER_STARTUP },
  // 移除扩展图标点击选项：已配置 action.default_popup，此事件永远不会触发
  // { value: 'event_extension_clicked', label: '扩展图标点击时', eventType: EventType.EXTENSION_CLICKED },

  { value: 'event_bookmark_changed', label: '书签变更时', eventType: EventType.BOOKMARK_CHANGED },
];

interface TaskTriggerFormProps {
  trigger: Trigger;
  onChange: (updatedTrigger: Trigger, isValid: boolean) => void;
  currentAction?: Action;
}

/**
 * 任务触发器配置表单组件
 * 用于选择任务的触发条件
 */
const TaskTriggerForm: React.FC<TaskTriggerFormProps> = ({ trigger, onChange, currentAction }) => {
  // 触发器选项值
  const [triggerOptionValue, setTriggerOptionValue] = useState<string>('');

  // 条件草稿：保留输入原文，保存时再去除首尾空白
  const [conditionDraft, setConditionDraft] = useState<TriggerConditionDraft>(() =>
    trigger.type === TriggerType.EVENT
      ? triggerConditionDraftFromConditions(trigger.conditions)
      : { ...EMPTY_TRIGGER_CONDITION_DRAFT }
  );

  const conditionValidation = validateTriggerConditionDraft(conditionDraft);

  const shouldForceManualTrigger =
    currentAction?.type === ActionType.SELECTIVE_PUSH ||
    (currentAction?.type === ActionType.BACKUP &&
      (currentAction as BackupAction).operation === 'restore');

  const forcedManualDescription =
    currentAction?.type === ActionType.SELECTIVE_PUSH
      ? '选择性推送任务'
      : '恢复书签任务（危险操作）';

  // 当 action 需要交互/高风险时，强制使用 MANUAL 触发器
  useEffect(() => {
    if (shouldForceManualTrigger && trigger.type !== TriggerType.MANUAL) {
      onChange(createManualTrigger(forcedManualDescription), true);
    }
  }, [shouldForceManualTrigger, forcedManualDescription, trigger.type, onChange]);

  // 初始化表单数据
  useEffect(() => {
    if (trigger.type === TriggerType.MANUAL) {
      setTriggerOptionValue('manual');
    } else if (trigger.type === TriggerType.EVENT) {
      const eventTrigger = trigger as EventTrigger;
      const eventType = eventTrigger.event;

      // 设置事件触发器的触发选项值
      const option = TRIGGER_OPTIONS.find(opt => opt.eventType === eventType);

      if (option) {
        setTriggerOptionValue(option.value);
      }
    }
  }, [trigger]);

  // 切换事件类型时重置条件草稿，避免把上一个事件的条件带到新事件
  const triggerEventKey = trigger.type === TriggerType.EVENT ? trigger.event : 'manual';
  const previousEventKeyRef = useRef(triggerEventKey);

  useEffect(() => {
    if (previousEventKeyRef.current === triggerEventKey) {
      return;
    }
    previousEventKeyRef.current = triggerEventKey;
    setConditionDraft(
      trigger.type === TriggerType.EVENT
        ? triggerConditionDraftFromConditions(trigger.conditions)
        : { ...EMPTY_TRIGGER_CONDITION_DRAFT }
    );
  }, [trigger, triggerEventKey]);

  // 旧任务可能存有只含空白的条件：首次加载时把无效状态同步给父表单，
  // 父表单默认按有效处理，不同步会导致保存按钮被误启用
  const reportedInitialValidityRef = useRef(false);

  useEffect(() => {
    if (reportedInitialValidityRef.current || shouldForceManualTrigger) {
      return;
    }
    reportedInitialValidityRef.current = true;
    if (!conditionValidation.isValid) {
      onChange(trigger, false);
    }
  }, [conditionValidation.isValid, onChange, shouldForceManualTrigger, trigger]);

  // 处理触发选项更改
  const handleTriggerOptionChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    setTriggerOptionValue(newValue);

    if (newValue === 'manual') {
      // 创建手动触发器
      const newTrigger = createManualTrigger('手动执行任务');
      onChange(newTrigger, true);
    } else {
      const selectedOption = TRIGGER_OPTIONS.find(opt => opt.value === newValue);
      if (selectedOption) {
        // 更新触发器
        updateEventTrigger(selectedOption.eventType);
      }
    }
  };

  // 更新事件触发器
  const updateEventTrigger = (eventType: EventType) => {
    const newTrigger = createEventTrigger(eventType, undefined);
    onChange(newTrigger, true); // 事件触发器始终有效
  };

  // 更新单个条件字段
  const handleConditionChange = (field: keyof TriggerConditionDraft, value: string) => {
    if (trigger.type !== TriggerType.EVENT) {
      return;
    }

    const nextDraft = { ...conditionDraft, [field]: value };
    setConditionDraft(nextDraft);

    const nextConditions = buildTriggerConditions(nextDraft);
    const validation = validateTriggerConditionDraft(nextDraft);
    onChange({ ...trigger, conditions: nextConditions }, validation.isValid);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <FormControl fullWidth size="small" margin="dense">
        <InputLabel id="trigger-type-label">触发条件</InputLabel>
        <Select
          labelId="trigger-type-label"
          id="trigger-type"
          value={triggerOptionValue}
          label="触发条件"
          onChange={handleTriggerOptionChange}
          disabled={shouldForceManualTrigger}
          MenuProps={{
            PaperProps: {
              style: {
                maxHeight: 224, // 更紧凑的下拉高度
              },
            },
          }}
        >
          <MenuItem value="manual" dense>
            手动触发
          </MenuItem>
          {TRIGGER_OPTIONS.map((option) => (
            <MenuItem
              key={option.value}
              value={option.value}
              dense // 使菜单项更紧凑
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {trigger.type === TriggerType.MANUAL && (
        <TextField
          label="任务描述"
          value={(trigger as ManualTrigger).description}
          onChange={(e) => onChange({
            ...trigger,
            description: e.target.value
          } as ManualTrigger, true)}
          fullWidth
          multiline
          rows={2}
          size="small"
          margin="dense"
          helperText="描述此手动任务的用途"
        />
      )}

      {trigger.type === TriggerType.EVENT && trigger.event === EventType.BOOKMARK_CHANGED && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            条件过滤（可选），全部留空时匹配所有书签变更
          </Typography>
          <TextField
            label="URL 包含"
            value={conditionDraft.url}
            onChange={(e) => handleConditionChange('url', e.target.value)}
            fullWidth
            size="small"
            margin="dense"
            placeholder="例如: example.com"
            error={!!conditionValidation.errors.url}
            helperText={conditionValidation.errors.url || '按文本包含匹配，不按正则表达式'}
          />
          <TextField
            label="标题包含"
            value={conditionDraft.title}
            onChange={(e) => handleConditionChange('title', e.target.value)}
            fullWidth
            size="small"
            margin="dense"
            placeholder="例如: 工作"
            error={!!conditionValidation.errors.title}
            helperText={conditionValidation.errors.title || '按文本包含匹配，不按正则表达式'}
          />
          <TextField
            label="父文件夹 ID"
            value={conditionDraft.parentFolder}
            onChange={(e) => handleConditionChange('parentFolder', e.target.value)}
            fullWidth
            size="small"
            margin="dense"
            placeholder="例如: 1"
            error={!!conditionValidation.errors.parentFolder}
            helperText={conditionValidation.errors.parentFolder || '书签必须直接位于该文件夹中'}
          />
        </Box>
      )}

      {trigger.type === TriggerType.EVENT && trigger.event === EventType.BROWSER_STARTUP && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          浏览器启动事件不支持条件过滤
        </Typography>
      )}
    </Box>
  );
};

export default TaskTriggerForm;
