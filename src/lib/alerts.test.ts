import { describe, it, expect } from 'vitest';
import {
  evalBudget, isCashflowNegative, isBucketBelowFloor, goalExpectedAmount, isGoalBehind,
} from './alerts';

describe('evalBudget', () => {
  it('none khi an toàn hoặc chưa đặt hạn mức', () => {
    expect(evalBudget(5, 100, 80).level).toBe('none');
    expect(evalBudget(50, 0, 80).level).toBe('none');
  });
  it('warn khi chạm ngưỡng cảnh báo nhưng chưa vượt', () => {
    const r = evalBudget(85, 100, 80);
    expect(r.level).toBe('warn');
    expect(r.pct).toBe(85);
  });
  it('over khi chạm/vượt 100%', () => {
    expect(evalBudget(100, 100, 80).level).toBe('over');
    expect(evalBudget(120, 100, 80).level).toBe('over');
  });
  it('mặc định warn 80% khi warnPct không hợp lệ', () => {
    expect(evalBudget(80, 100, 0).level).toBe('warn');
  });
});

describe('isCashflowNegative', () => {
  it('âm khi chi > thu', () => {
    expect(isCashflowNegative(10, 15)).toBe(true);
    expect(isCashflowNegative(15, 10)).toBe(false);
    expect(isCashflowNegative(10, 10)).toBe(false);
  });
});

describe('isBucketBelowFloor', () => {
  it('chỉ cảnh báo khi có sàn > 0 và số dư thấp hơn', () => {
    expect(isBucketBelowFloor(500, 1000)).toBe(true);
    expect(isBucketBelowFloor(1500, 1000)).toBe(false);
    expect(isBucketBelowFloor(0, 0)).toBe(false); // chưa đặt sàn
  });
});

describe('goalExpectedAmount', () => {
  it('tỉ lệ theo thời gian đã trôi qua', () => {
    // tạo 2026-01-01, hạn 2026-12-31 (~365 ngày), hôm nay 2026-07-02 ~ nửa chặng
    const exp = goalExpectedAmount(100_000_000, '2026-01-01', '2026-12-31', '2026-07-02');
    expect(exp).not.toBeNull();
    expect(exp!).toBeGreaterThan(48_000_000);
    expect(exp!).toBeLessThan(52_000_000);
  });
  it('null khi thiếu hạn hoặc hạn ≤ ngày tạo', () => {
    expect(goalExpectedAmount(100, '2026-01-01', '', '2026-07-01')).toBeNull();
    expect(goalExpectedAmount(100, '2026-12-31', '2026-01-01', '2026-07-01')).toBeNull();
  });
  it('kẹp [0,1]: chưa tới ngày tạo → 0, quá hạn → đủ target', () => {
    expect(goalExpectedAmount(100, '2026-06-01', '2026-12-01', '2026-01-01')).toBe(0);
    expect(goalExpectedAmount(100, '2026-01-01', '2026-06-01', '2026-12-01')).toBe(100);
  });
});

describe('isGoalBehind', () => {
  it('chậm khi thực tế thấp hơn kỳ vọng', () => {
    // nửa chặng, kỳ vọng ~50tr, mới có 10tr → chậm
    expect(isGoalBehind(10_000_000, 100_000_000, '2026-01-01', '2026-12-31', '2026-07-02')).toBe(true);
  });
  it('không chậm khi vượt kỳ vọng hoặc đã đạt', () => {
    expect(isGoalBehind(60_000_000, 100_000_000, '2026-01-01', '2026-12-31', '2026-07-02')).toBe(false);
    expect(isGoalBehind(100_000_000, 100_000_000, '2026-01-01', '2026-12-31', '2026-07-02')).toBe(false);
  });
  it('không hạn → không bao giờ chậm', () => {
    expect(isGoalBehind(0, 100_000_000, '2026-01-01', '', '2026-07-02')).toBe(false);
  });
});
