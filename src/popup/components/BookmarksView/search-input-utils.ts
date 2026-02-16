export const getInputValueFromEventTarget = (target: EventTarget | null, fallbackValue = ''): string => {
  if (!target || typeof target !== 'object') {
    return fallbackValue;
  }

  const value = (target as { value?: unknown }).value;
  return typeof value === 'string' ? value : fallbackValue;
};
