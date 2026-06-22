// Shared, pure validation rules for transactions.
//
// These mirror the Google Apps Script backend `validateTx_` so the UI can show
// inline errors BEFORE a round-trip, and the backend stays the source of truth.
// Keep this file framework-free so it can be unit-tested with vitest.

import type { TxType, TxInput } from '../types';

/** Trần hợp lý cho một giao dịch: 100 tỷ VND. Trên mức này coi là nhập nhầm. */
export const MAX_AMOUNT = 100_000_000_000;

export interface FieldError {
  ok: boolean;
  message?: string;
}

const OK: FieldError = { ok: true };

/**
 * Chuyển chuỗi người dùng gõ thành số nguyên VND.
 * Bỏ mọi ký tự không phải chữ số (kể cả dấu trừ, dấu chấm, phẩy, khoảng trắng)
 * → không thể nhập số âm hay thập phân ngay từ ô input.
 */
export function parseAmountInput(raw: string): number {
  const digits = (raw ?? '').replace(/[^\d]/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
}

/** Kiểm tra số tiền: phải là số nguyên dương, không vượt trần. */
export function validateAmount(amount: number): FieldError {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'Số tiền phải lớn hơn 0.' };
  }
  if (!Number.isInteger(amount)) {
    return { ok: false, message: 'Số tiền (VND) phải là số nguyên, không có số lẻ.' };
  }
  if (amount > MAX_AMOUNT) {
    return { ok: false, message: 'Số tiền quá lớn — kiểm tra lại xem có nhập nhầm không.' };
  }
  return OK;
}

/** Ngày không được ở tương lai. So sánh theo chuỗi YYYY-MM-DD (an toàn về timezone). */
export function validateDate(dateISO: string, todayISO: string): FieldError {
  if (!dateISO) return { ok: false, message: 'Cần chọn ngày giao dịch.' };
  if (dateISO > todayISO) {
    return { ok: false, message: 'Không thể ghi giao dịch ở ngày tương lai.' };
  }
  return OK;
}

/**
 * Validate toàn bộ payload giao dịch (shape + giá trị), mirror backend.
 * KHÔNG kiểm tra số dư hũ (việc đó cần dữ liệu server) — chỉ tính hợp lệ về hình thức.
 */
export function validateTx(tx: TxInput, todayISO: string): FieldError {
  const amountCheck = validateAmount(Number(tx.amount));
  if (!amountCheck.ok) return amountCheck;

  const type: TxType = tx.type || 'expense';
  if (!['income', 'expense', 'transfer'].includes(type)) {
    return { ok: false, message: 'Loại giao dịch không hợp lệ.' };
  }

  if (type === 'expense' && !tx.fromBucketId) {
    return { ok: false, message: 'Chi tiêu cần chọn mục nguồn.' };
  }
  if (type === 'income' && !tx.toBucketId) {
    return { ok: false, message: 'Thu nhập cần chọn mục đích.' };
  }
  if (type === 'transfer' && (!tx.fromBucketId || !tx.toBucketId)) {
    return { ok: false, message: 'Phân bổ cần chọn mục nguồn và đích.' };
  }
  if (type === 'transfer' && tx.fromBucketId === tx.toBucketId) {
    return { ok: false, message: 'Không thể phân bổ vào cùng một mục.' };
  }

  if (tx.date) {
    const dateCheck = validateDate(tx.date, todayISO);
    if (!dateCheck.ok) return dateCheck;
  }

  return OK;
}
