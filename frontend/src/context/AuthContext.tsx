'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { authApi, setAccessToken, type User } from '@/lib/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Try to refresh token on mount (uses httpOnly cookie)
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/custom-auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.accessToken) {
          setAccessToken(data.accessToken);
          return loadUser();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadUser]);

  const login = useCallback(async (email: string) => {
    const { accessToken } = await authApi.login(email);
    setAccessToken(accessToken);
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
  }, []);

  const setToken = useCallback((token: string) => {
    setAccessToken(token);
    loadUser();
  }, [loadUser]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
