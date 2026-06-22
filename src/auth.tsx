// Auth context: fetches the signed-in Google user once at boot and exposes it
// app-wide. The login gate (in App.tsx) uses `authorized` to decide whether to
// render the app or an "access denied" screen.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { callGAS } from './lib/rpc';
import type { CurrentUser } from './types';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    callGAS<CurrentUser>('getCurrentUser')
      .then(setUser)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return <Ctx.Provider value={{ user, loading, error, reload }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Tiện ích: user đã đăng nhập & được cấp quyền (chỉ gọi sau cổng đăng nhập). */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth();
  if (!user) throw new Error('Chưa có thông tin người dùng');
  return user;
}
