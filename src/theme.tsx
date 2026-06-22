// React context for theme. Toggling re-renders the tree so charts (which read
// `resolved`) recolor for the active scheme.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  type Theme, type ResolvedTheme,
  resolveTheme, getStoredTheme, storeTheme, systemPrefersDark, applyResolvedTheme,
} from './lib/theme';

interface ThemeState {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [prefersDark, setPrefersDark] = useState<boolean>(() => systemPrefersDark());

  // Theo dõi thay đổi của hệ thống khi đang ở chế độ 'system'.
  useEffect(() => {
    let mq: MediaQueryList;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); }
    catch { return; }
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolved = useMemo(() => resolveTheme(theme, prefersDark), [theme, prefersDark]);

  useEffect(() => { applyResolvedTheme(resolved); }, [resolved]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    storeTheme(t);
  }, []);

  const value = useMemo<ThemeState>(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
