import { describe, it, expect } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('giữ nguyên lựa chọn tường minh', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });
  it('"system" theo tuỳ chọn hệ điều hành', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
