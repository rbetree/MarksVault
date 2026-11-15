import { ExecutionOutcome } from '../types/task';
import {
  getExecutionOutcomeLabel,
  getExecutionResultText,
  resolveExecutionOutcome
} from './date-utils';

describe('执行结果文案', () => {
  it('显式 outcome 优先于 success 推断', () => {
    expect(resolveExecutionOutcome(false, ExecutionOutcome.UNCERTAIN))
      .toBe(ExecutionOutcome.UNCERTAIN);
    expect(resolveExecutionOutcome(false, ExecutionOutcome.INTERRUPTED))
      .toBe(ExecutionOutcome.INTERRUPTED);
  });

  it('缺省 outcome 时按 success 推断，兼容旧记录', () => {
    expect(resolveExecutionOutcome(true)).toBe(ExecutionOutcome.SUCCESS);
    expect(resolveExecutionOutcome(false)).toBe(ExecutionOutcome.FAILURE);
    expect(getExecutionOutcomeLabel(true)).toBe('成功');
    expect(getExecutionOutcomeLabel(false)).toBe('失败');
  });

  it('执行中断与结果不确定不显示为失败', () => {
    expect(getExecutionOutcomeLabel(false, ExecutionOutcome.INTERRUPTED)).toBe('执行中断');
    expect(getExecutionOutcomeLabel(false, ExecutionOutcome.UNCERTAIN)).toBe('结果不确定');
  });

  it('执行结果文本使用 outcome 文案', () => {
    const text = getExecutionResultText(0, false, '后台终止', ExecutionOutcome.INTERRUPTED);

    expect(text).toContain('执行中断');
    expect(text).not.toContain('失败');
    expect(text).toContain('后台终止');
  });
});
