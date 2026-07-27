'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { authApi, setAccessToken, setUnauthenticatedHandler, type User } from '@/lib/api';
import { getSession, signOut } from '@/lib/auth-client';

interface AuthState {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string) => void;
  refresh: () => Promise<User | null>;
}

const AuthContext = createContext<AuthState | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Resolve the current user by trying both auth modes:
  //  1. Custom-JWT refresh cookie (existing email/JWT users) → access token + /me
  //  2. better-auth cookie session (Google OAuth users) → /me via cookie
  // Whichever yields a user wins. /me works for cookie-only users because the
  // backend requireAuth middleware falls back to the better-auth session.
  const resolveUser = useCallback(async (): Promise<User | null> => {
    // Mode 1: custom-JWT refresh.
    try {
      const res = await fetch(`${API_BASE}/api/custom-auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accessToken) {
          setAccessToken(data.accessToken);
          const u = await loadUser();
          if (u) return u;
        }
      }
    } catch {
      /* fall through to OAuth */
    }

    // Mode 2: better-auth cookie session.
    try {
      const session = await getSession();
      if (session?.data?.user) {
        setAccessToken(null); // cookie auth — no Bearer token
        const u = await loadUser();
        if (u) return u;
      }
    } catch {
      /* no session */
    }

    setUser(null);
    return null;
  }, [loadUser]);

  useEffect(() => {
    let active = true;
    resolveUser().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [resolveUser]);

  // When a protected request comes back unauthenticated (e.g. an expired OAuth
  // cookie with no Bearer token to refresh), drop the user so route guards send
  // them to /login. Only acts once loading has settled to avoid fighting the
  // initial probe, where a /me 401 is an expected "not logged in" signal.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  const logout = useCallback(async () => {
    // Clear both auth modes so a user signed in via either path is fully
    // logged out. Each is tolerant of the other mode having no session.
    await Promise.allSettled([
      authApi.logout(),
      signOut(),
    ]);
    setAccessToken(null);
    setUser(null);
  }, []);

  const setToken = useCallback((token: string) => {
    setAccessToken(token);
    loadUser();
  }, [loadUser]);

  const refresh = useCallback(() => resolveUser(), [resolveUser]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, setUser, setToken, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
