import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from '@/components/ui';
import type { User, AwardedBadge } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'teacher';
  institution?: string;
}

const showAwardedBadgeToasts = (badges: AwardedBadge[] = []) => {
  badges.forEach((badge) => {
    toast(`🏅 Badge earned: ${badge.icon ? `${badge.icon} ` : ''}${badge.name}`, 'success');
  });
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    try {
      const { data } = await api.get('/users/me');
      setState({ user: data.user, token, isLoading: false, isAuthenticated: true });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => { fetchCurrentUser(); }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    setState({ user: data.user, token: data.token, isLoading: false, isAuthenticated: true });

    showAwardedBadgeToasts(Array.isArray(data.awardedBadges) ? data.awardedBadges : []);
  };

  const register = async (formData: RegisterData) => {
    const { data } = await api.post('/auth/register', formData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    setState({ user: data.user, token: data.token, isLoading: false, isAuthenticated: true });
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
  };

  const updateUser = (updates: Partial<User>) => {
    setState((s) => s.user ? { ...s, user: { ...s.user, ...updates } } : s);
  };

  const refreshUser = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
