// Pure, framework-free threshold evaluation for the alert engine (Phase 4).
//
// The Google Apps Script backend mirrors this logic in `checkThresholds_` so the
// rules can be unit-tested in node and stay in sync with the server. Keep this
// file free of any GAS / React imports.

export type BudgetLevel = 'none' | 'warn' | 'over';

export interface BudgetEval {
  level: BudgetLevel;
  pct: number;
}

/**
 * Đánh giá ngưỡng ngân sách tháng.
 * - over: chi đã chạm/vượt 100% hạn mức.
 * - warn: chi đã chạm ngưỡng cảnh báo (warnPct%) nhưng chưa vượt.
 * - none: an toàn (hoặc chưa đặt hạn mức).
 */
export function evalBudget(spent: number, limit: number, warnPct: number): BudgetEval {
  if (!(limit > 0)) return { level: 'none', pct: 0 };
  const pct = Math.round((spent / limit) * 100);
  if (spent >= limit) return { level: 'over', pct };
  const warn = warnPct > 0 ? warnPct : 80;
  if (pct >= warn) return { level: 'warn', pct };
  return { level: 'none', pct };
}

/** Dòng tiền tháng âm: tổng chi vượt tổng thu. */
export function isCashflowNegative(income: number, expense: number): boolean {
  return (Number(expense) || 0) > (Number(income) || 0);
}

/** Hũ tụt dưới mức sàn (chỉ tính khi đã đặt sàn > 0). */
export function isBucketBelowFloor(balance: number, floor: number): boolean {
  if (!(floor > 0)) return false;
  return (Number(balance) || 0) < floor;
}

/**
 * Số tiền *kỳ vọng* đã tích luỹ tới hôm nay nếu để dành đều từ ngày tạo tới hạn.
 * null nếu không đủ dữ kiện (thiếu hạn/ngày tạo, hoặc hạn ≤ ngày tạo).
 */
export function goalExpectedAmount(
  target: number, createdAtISO: string, deadlineISO: string, todayISO: string,
): number | null {
  if (!deadlineISO || !createdAtISO) return null;
  const start = Date.parse(createdAtISO.slice(0, 10) + 'T00:00:00Z');
  const end = Date.parse(deadlineISO + 'T00:00:00Z');
  const now = Date.parse(todayISO + 'T00:00:00Z');
  if ([start, end, now].some(Number.isNaN)) return null;
  if (end <= start) return null;
  const frac = (now - start) / (end - start);
  const clamped = Math.max(0, Math.min(1, frac));
  return target * clamped;
}

/**
 * Mục tiêu chậm tiến độ: số đang có thấp hơn mức kỳ vọng theo thời gian.
 * Chỉ áp dụng cho mục tiêu có hạn & chưa đạt. Không hạn → không bao giờ "chậm".
 */
export function isGoalBehind(
  current: number, target: number, createdAtISO: string, deadlineISO: string, todayISO: string,
): boolean {
  if (!(target > 0)) return false;
  if (current >= target) return false; // đã đạt
  const expected = goalExpectedAmount(target, createdAtISO, deadlineISO, todayISO);
  if (expected === null) return false;
  return current < expected;
}
