'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens, SessionUser } from './api';

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setUser(tokens.user);
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
  };

  const logout = () => {
    api.logout();
    setUser(null);
    router.push('/login');
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPERVISOR: 'Supervisor',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Sheikh / Teacher',
  STUDENT: 'Student',
};

export const canEdit = (role?: string) =>
  role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN' || role === 'TEACHER';
export const isAdmin = (role?: string) => role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN';
