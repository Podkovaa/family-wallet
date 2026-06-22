import { describe, it, expect } from 'vitest';
import { parseAmountInput, validateAmount, validateDate, validateTx, MAX_AMOUNT } from './validation';

describe('parseAmountInput', () => {
  it('strips non-digits → không thể nhập số âm', () => {
    expect(parseAmountInput('-50000')).toBe(50000);
    expect(parseAmountInput('1.000,5')).toBe(10005); // mọi ký tự không phải số bị loại
    expect(parseAmountInput('abc')).toBe(0);
    expect(parseAmountInput('250 000 đ')).toBe(250000);
  });
});

describe('validateAmount', () => {
  it('chặn số <= 0', () => {
    expect(validateAmount(0).ok).toBe(false);
    expect(validateAmount(-1).ok).toBe(false);
  });
  it('chặn số thập phân', () => {
    expect(validateAmount(1000.5).ok).toBe(false);
  });
  it('chặn số vượt trần', () => {
    expect(validateAmount(MAX_AMOUNT + 1).ok).toBe(false);
  });
  it('chấp nhận số nguyên dương hợp lệ', () => {
    expect(validateAmount(250000).ok).toBe(true);
  });
});

describe('validateDate', () => {
  it('chặn ngày tương lai', () => {
    expect(validateDate('2999-01-01', '2026-06-20').ok).toBe(false);
  });
  it('chấp nhận hôm nay và quá khứ', () => {
    expect(validateDate('2026-06-20', '2026-06-20').ok).toBe(true);
    expect(validateDate('2020-01-01', '2026-06-20').ok).toBe(true);
  });
});

describe('validateTx', () => {
  const today = '2026-06-20';
  it('expense cần hũ nguồn', () => {
    expect(validateTx({ type: 'expense', amount: 1000 }, today).ok).toBe(false);
    expect(validateTx({ type: 'expense', amount: 1000, fromBucketId: 'a' }, today).ok).toBe(true);
  });
  it('income cần hũ đích', () => {
    expect(validateTx({ type: 'income', amount: 1000 }, today).ok).toBe(false);
    expect(validateTx({ type: 'income', amount: 1000, toBucketId: 'a' }, today).ok).toBe(true);
  });
  it('transfer không cho cùng hũ', () => {
    expect(validateTx({ type: 'transfer', amount: 1000, fromBucketId: 'a', toBucketId: 'a' }, today).ok).toBe(false);
    expect(validateTx({ type: 'transfer', amount: 1000, fromBucketId: 'a', toBucketId: 'b' }, today).ok).toBe(true);
  });
  it('chặn số âm ở mọi loại', () => {
    expect(validateTx({ type: 'transfer', amount: -5, fromBucketId: 'a', toBucketId: 'b' }, today).ok).toBe(false);
  });
});
