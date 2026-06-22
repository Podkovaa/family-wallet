import { describe, it, expect } from 'vitest';
import {
  sumContributions, goalPct, goalRemaining, isGoalReached,
  daysUntil, monthsUntil, requiredMonthlySaving, deadlineLabel,
} from './goals';

describe('sumContributions', () => {
  it('cộng dồn, bỏ qua giá trị rác', () => {
    expect(sumContributions([{ amount: 1000 }, { amount: 2000 }])).toBe(3000);
    expect(sumContributions([])).toBe(0);
    // @ts-expect-error chủ ý truyền dữ liệu thiếu để kiểm tra phòng thủ
    expect(sumContributions([{ amount: '5' }, {}])).toBe(5);
  });
});

describe('goalPct', () => {
  it('kẹp trong [0,100] và làm tròn', () => {
    expect(goalPct(50, 200)).toBe(25);
    expect(goalPct(300, 200)).toBe(100); // không vượt 100
    expect(goalPct(-10, 200)).toBe(0);
    expect(goalPct(10, 0)).toBe(0);      // target không hợp lệ
  });
});

describe('goalRemaining / isGoalReached', () => {
  it('phần còn thiếu không âm', () => {
    expect(goalRemaining(30, 100)).toBe(70);
    expect(goalRemaining(120, 100)).toBe(0);
  });
  it('đạt mục tiêu khi current >= target', () => {
    expect(isGoalReached(100, 100)).toBe(true);
    expect(isGoalReached(99, 100)).toBe(false);
    expect(isGoalReached(10, 0)).toBe(false);
  });
});

describe('daysUntil', () => {
  it('dương khi trong tương lai, âm khi quá hạn, 0 khi đúng ngày', () => {
    expect(daysUntil('2026-06-30', '2026-06-20')).toBe(10);
    expect(daysUntil('2026-06-20', '2026-06-20')).toBe(0);
    expect(daysUntil('2026-06-10', '2026-06-20')).toBe(-10);
  });
  it('null khi không đặt hạn', () => {
    expect(daysUntil('', '2026-06-20')).toBeNull();
  });
});

describe('monthsUntil', () => {
  it('tính số tháng đủ, tối thiểu 0', () => {
    expect(monthsUntil('2026-12-20', '2026-06-20')).toBe(6);
    expect(monthsUntil('2026-12-10', '2026-06-20')).toBe(5); // chưa đủ tháng cuối
    expect(monthsUntil('2026-06-10', '2026-06-20')).toBe(0); // quá hạn → 0
    expect(monthsUntil('', '2026-06-20')).toBeNull();
  });
});

describe('requiredMonthlySaving', () => {
  it('chia đều phần còn thiếu cho số tháng (làm tròn lên)', () => {
    // còn thiếu 60tr, còn 6 tháng → 10tr/tháng
    expect(requiredMonthlySaving(40_000_000, 100_000_000, '2026-12-20', '2026-06-20')).toBe(10_000_000);
  });
  it('đã đủ tiền → 0', () => {
    expect(requiredMonthlySaving(100_000_000, 100_000_000, '2026-12-20', '2026-06-20')).toBe(0);
  });
  it('không đặt hạn → null', () => {
    expect(requiredMonthlySaving(0, 100, '', '2026-06-20')).toBeNull();
  });
  it('trong tháng cuối / quá hạn → cần gom toàn bộ phần còn thiếu', () => {
    expect(requiredMonthlySaving(70, 100, '2026-06-25', '2026-06-20')).toBe(30);
    expect(requiredMonthlySaving(70, 100, '2026-06-10', '2026-06-20')).toBe(30);
  });
});

describe('deadlineLabel', () => {
  it('phản ánh đúng trạng thái hạn', () => {
    expect(deadlineLabel('', '2026-06-20')).toBe('Không đặt hạn');
    expect(deadlineLabel('2026-06-20', '2026-06-20')).toBe('Đến hạn hôm nay');
    expect(deadlineLabel('2026-06-25', '2026-06-20')).toBe('Còn 5 ngày');
    expect(deadlineLabel('2026-06-15', '2026-06-20')).toBe('Quá hạn 5 ngày');
    expect(deadlineLabel('2026-12-20', '2026-06-20')).toBe('Còn ~6 tháng');
  });
});
