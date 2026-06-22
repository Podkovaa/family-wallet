// Formatting helpers (VND-centric).

export function formatVND(n: number): string {
  return (Math.round(n || 0)).toLocaleString('vi-VN') + ' đ';
}

export function formatNumber(n: number): string {
  return (Math.round(n || 0)).toLocaleString('vi-VN');
}

/** "2026-06-20" -> "20/06/2026" */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Current month key, e.g. "2026-06". */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Today as "YYYY-MM-DD". */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
