import { describe, it, expect } from 'vitest';
import { formatVND, formatNumber, formatDate, currentMonthKey, todayISO } from './format';

// Tránh phụ thuộc ký tự phân tách của locale (ICU có thể khác giữa môi trường):
// chỉ kiểm tra chữ số được giữ nguyên và đuôi đơn vị.
function digits(s: string): string { return s.replace(/[^\d]/g, ''); }

describe('formatVND', () => {
  it('kết thúc bằng "đ" và giữ đúng chữ số, làm tròn', () => {
    expect(formatVND(0)).toBe('0 đ');
    expect(formatVND(1_234_567).endsWith('đ')).toBe(true);
    expect(digits(formatVND(1_234_567))).toBe('1234567');
    expect(digits(formatVND(1000.6))).toBe('1001'); // làm tròn
  });
});

describe('formatNumber', () => {
  it('giữ chữ số, không có đuôi đơn vị', () => {
    expect(digits(formatNumber(2_500_000))).toBe('2500000');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatDate', () => {
  it('YYYY-MM-DD → DD/MM/YYYY', () => {
    expect(formatDate('2026-06-20')).toBe('20/06/2026');
    expect(formatDate('')).toBe('');
  });
});

describe('currentMonthKey / todayISO', () => {
  it('đúng định dạng', () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // tháng của hôm nay phải khớp tiền tố của ngày hôm nay
    expect(todayISO().slice(0, 7)).toBe(currentMonthKey());
  });
});
