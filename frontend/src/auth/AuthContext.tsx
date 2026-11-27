import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthUser, getMe, hasRole, login as apiLogin, logout as apiLogout, Role, setAuthHandlers } from '../api';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Convenience for hiding buttons; the backend enforces the real rule (BR4.9). */
  can: (minRole: Role) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return value;
}

/** Loads GET /auth/me on open; a 401 from any API call returns the screen to Login. No token is kept in the browser. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const anonymous = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let alive = true;
    setAuthHandlers({
      onUnauthorized: anonymous,
      // 403 on a write: the role may have been lowered; reload it so buttons disappear (read mode).
      onForbidden: () => {
        getMe()
          .then((me) => alive && setUser(me))
          .catch(() => undefined);
      },
    });
    getMe()
      .then((me) => {
        if (!alive) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => alive && anonymous());
    return () => {
      alive = false;
      setAuthHandlers({ onUnauthorized: null, onForbidden: null });
    };
  }, [anonymous]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      async login(email, password) {
        setUser(await apiLogin(email, password));
        setStatus('authenticated');
      },
      async logout() {
        try {
          await apiLogout();
        } catch {
          /* 401 or network error: either way this browser must show Login */
        }
        anonymous();
      },
      can: (minRole) => (user ? hasRole(user.role, minRole) : false),
    }),
    [status, user, anonymous],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
