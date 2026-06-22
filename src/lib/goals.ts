// Pure, framework-free logic for financial goals (Phase 3).
//
// The backend computes the *current* amount of a goal (bucket balance, or the
// sum of contributions). Everything derived from it — percentage, remaining,
// countdown, the monthly saving still required — lives here so it can be unit
// tested with vitest and reused by both the screen and the dashboard highlight.

export interface ContributionLike {
  amount: number;
}

/** Tổng số tiền đã đóng góp (kiểu contribution). */
export function sumContributions(contribs: ContributionLike[]): number {
  return (contribs ?? []).reduce((s, c) => s + (Number(c?.amount) || 0), 0);
}

/** Phần trăm tiến độ, kẹp trong [0, 100], làm tròn. */
export function goalPct(current: number, target: number): number {
  if (!(target > 0)) return 0;
  const pct = Math.round((current / target) * 100);
  return Math.max(0, Math.min(100, pct));
}

/** Số tiền còn thiếu để đạt mục tiêu (không âm). */
export function goalRemaining(current: number, target: number): number {
  return Math.max(0, (Number(target) || 0) - (Number(current) || 0));
}

/** Mục tiêu đã đạt khi current >= target (target hợp lệ). */
export function isGoalReached(current: number, target: number): boolean {
  return target > 0 && current >= target;
}

/**
 * Số ngày còn lại đến hạn (âm nếu đã quá hạn). null nếu không đặt hạn.
 * So sánh theo mốc UTC 00:00 để tránh lệch timezone.
 */
export function daysUntil(deadlineISO: string, todayISO: string): number | null {
  if (!deadlineISO) return null;
  const a = Date.parse(deadlineISO + 'T00:00:00Z');
  const b = Date.parse(todayISO + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/**
 * Số tháng (đủ) còn lại đến hạn, tối thiểu 0. null nếu không đặt hạn.
 * "Đủ tháng": nếu ngày trong tháng của hạn nhỏ hơn của hôm nay thì trừ 1.
 */
export function monthsUntil(deadlineISO: string, todayISO: string): number | null {
  if (!deadlineISO) return null;
  const d = deadlineISO.split('-').map(Number);
  const t = todayISO.split('-').map(Number);
  if (d.length < 3 || t.length < 3 || !d[0] || !t[0]) return null;
  let months = (d[0] - t[0]) * 12 + (d[1] - t[1]);
  if (d[2] < t[2]) months -= 1;
  return Math.max(0, months);
}

/**
 * Cần để dành mỗi tháng để đạt mục tiêu đúng hạn.
 * - Đã đủ tiền → 0.
 * - Không đặt hạn → null (không có cơ sở để chia đều).
 * - Còn ≤ 0 tháng (trong tháng cuối / quá hạn) → cần gom toàn bộ phần còn thiếu ngay.
 * Kết quả làm tròn lên (đồng nguyên).
 */
export function requiredMonthlySaving(
  current: number,
  target: number,
  deadlineISO: string,
  todayISO: string,
): number | null {
  const remaining = goalRemaining(current, target);
  if (remaining <= 0) return 0;
  const months = monthsUntil(deadlineISO, todayISO);
  if (months === null) return null;
  if (months <= 0) return remaining;
  return Math.ceil(remaining / months);
}

/** Nhãn đếm ngược thân thiện cho UI. */
export function deadlineLabel(deadlineISO: string, todayISO: string): string {
  const days = daysUntil(deadlineISO, todayISO);
  if (days === null) return 'Không đặt hạn';
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Đến hạn hôm nay';
  if (days < 31) return `Còn ${days} ngày`;
  const months = monthsUntil(deadlineISO, todayISO) ?? 0;
  return `Còn ~${months} tháng`;
}
