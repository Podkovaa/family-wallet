// Theme (light / dark / system) — pure helpers + DOM application.
//
// The actual React wiring lives in src/theme.tsx; this file keeps the storage
// key, the pure resolution rule (testable in node) and the DOM side-effects.

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'fw-theme';

/** Quy tắc thuần: 'system' → theo prefersDark; còn lại giữ nguyên. */
export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

/** Đọc lựa chọn đã lưu (mặc định 'dark'). An toàn khi không có localStorage. */
export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* SSR / chặn storage */ }
  return 'dark';
}

export function storeTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* bỏ qua */ }
}

export function systemPrefersDark(): boolean {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
  catch { return false; }
}

/** Gắn data-theme lên <html> + cập nhật meta theme-color cho thanh trình duyệt. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  try {
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#11151c' : '#5b8def');
  } catch { /* không có DOM */ }
}
