// Global app state + a small data-fetching hook (replaces the old Ts()/Co() pair).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { callGAS } from './lib/rpc';
import { currentMonthKey } from './lib/format';
import type { TimeRange } from './types';

interface AppState {
  /** Bump to force all data hooks to refetch. */
  refreshKey: number;
  refresh: () => void;
  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  quickAddOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('6T');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey());
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const value = useMemo<AppState>(() => ({
    refreshKey,
    refresh: () => setRefreshKey((k) => k + 1),
    timeRange,
    setTimeRange,
    selectedMonth,
    setSelectedMonth,
    quickAddOpen,
    openQuickAdd: () => setQuickAddOpen(true),
    closeQuickAdd: () => setQuickAddOpen(false),
  }), [refreshKey, timeRange, selectedMonth, quickAddOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/**
 * Fetch data from a backend function, refetching whenever `deps` or the global
 * refreshKey changes. Returns {data, loading, error, reload}.
 */
export function useRpc<T>(fn: string, args: unknown[] = [], deps: unknown[] = []) {
  const { refreshKey } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const argsRef = useRef(args);
  argsRef.current = args;

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    callGAS<T>(fn, ...argsRef.current)
      .then((res) => setData(res))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, refreshKey, ...deps]);

  return { data, loading, error, reload: run };
}
