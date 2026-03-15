// frontend/hooks/useAuth.js
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * AuthContext + useAuth hook
 *
 * Strategy:
 * - JWT stored in httpOnly cookie (set by server) for security
 * - User profile stored in localStorage for fast hydration
 * - Token refresh happens transparently every 14 minutes
 * - All authenticated API calls use the /api/* proxy route
 *   which injects the JWT from the httpOnly cookie server-side
 */

const AuthContext = createContext(null);

// ── Auth Provider (wrap in app/layout.jsx) ────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);
  const router = useRouter();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sp_user');
    const token  = localStorage.getItem('sp_token');
    if (stored && token) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.removeItem('sp_user'); }
    }
    setLoad(false);
  }, []);

  // Verify token with server (runs once on mount)
  useEffect(() => {
    if (!loading) verifySession();
  }, [loading]);

  // Silent token refresh every 14 minutes
  useEffect(() => {
    if (!user) return;
    const id = setInterval(refreshToken, 14 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  const verifySession = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const fresh = await res.json();
        setUser(fresh);
        localStorage.setItem('sp_user', JSON.stringify(fresh));
      } else if (res.status === 401) {
        clearSession();
      }
    } catch { /* offline — keep local state */ }
  };

  const refreshToken = async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method:'POST', credentials:'include' });
      if (!res.ok) clearSession();
    } catch {}
  };

  const clearSession = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sp_user');
    localStorage.removeItem('sp_token');
  }, []);

  // ── Login ────────────────────────────────────────────────────────
  const login = useCallback(async ({ identifier, password, remember = true }) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password, remember }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      setUser(data.user);
      localStorage.setItem('sp_user', JSON.stringify(data.user));
      // JWT is set as httpOnly cookie by server — not stored in localStorage
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // ── Register ─────────────────────────────────────────────────────
  const register = useCallback(async ({ name, email, username, password, trading_style, sectors }) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, username, password, trading_style, preferred_sectors: sectors }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');

      // Registration returns pending_verification — don't set user yet
      return { success: true, requiresOTP: true, email };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // ── Verify OTP ───────────────────────────────────────────────────
  const verifyOTP = useCallback(async ({ email, otp }) => {
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid OTP');

      setUser(data.user);
      localStorage.setItem('sp_user', JSON.stringify(data.user));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ── OAuth ────────────────────────────────────────────────────────
  const oauthLogin = useCallback((provider) => {
    const redirectUri = `${window.location.origin}/auth/callback/${provider}`;
    const urls = {
      google: `https://accounts.google.com/o/oauth2/auth?client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email profile`,
      github: `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email`,
    };
    window.location.href = urls[provider];
  }, []);

  // ── Logout ───────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method:'POST', credentials:'include' });
    } catch {}
    clearSession();
    router.push('/login');
  }, [clearSession, router]);

  // ── Update profile ───────────────────────────────────────────────
  const updateProfile = useCallback(async (updates) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setUser(updated);
      localStorage.setItem('sp_user', JSON.stringify(updated));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ── Change password ──────────────────────────────────────────────
  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, error, isAuthenticated: !!user,
      login, register, verifyOTP, oauthLogin, logout,
      updateProfile, changePassword, refresh: verifySession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── useAuth hook ──────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ── useWatchlist ──────────────────────────────────────────────────
export function useWatchlist() {
  const { user } = useAuth();
  const [watchlist, setWL]   = useState([]);
  const [loading, setLoad]   = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoad(true);
    fetch('/api/watchlist', { credentials:'include' })
      .then(r => r.json())
      .then(data => { setWL(data.stocks || []); setLoad(false); })
      .catch(() => setLoad(false));
  }, [user]);

  const add = useCallback(async (symbol) => {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ symbol }),
    });
    if (res.ok) setWL(prev => [...prev, { symbol }]);
  }, []);

  const remove = useCallback(async (symbol) => {
    await fetch(`/api/watchlist/${symbol}`, { method:'DELETE', credentials:'include' });
    setWL(prev => prev.filter(s => s.symbol !== symbol));
  }, []);

  const isWatching = useCallback((symbol) => watchlist.some(s => s.symbol === symbol), [watchlist]);

  return { watchlist, loading, add, remove, isWatching };
}

// ── useAlerts ─────────────────────────────────────────────────────
export function useAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/alerts', { credentials:'include' })
      .then(r => r.json())
      .then(data => setAlerts(data.alerts || []))
      .catch(() => {});
  }, [user]);

  const create = useCallback(async (alertData) => {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(alertData),
    });
    const newAlert = await res.json();
    setAlerts(prev => [newAlert, ...prev]);
    return newAlert;
  }, []);

  const toggle = useCallback(async (alertId) => {
    await fetch(`/api/alerts/${alertId}/toggle`, { method:'POST', credentials:'include' });
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_active: !a.is_active } : a));
  }, []);

  const deleteAlert = useCallback(async (alertId) => {
    await fetch(`/api/alerts/${alertId}`, { method:'DELETE', credentials:'include' });
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  return { alerts, create, toggle, deleteAlert };
}

// ── useNotifications ──────────────────────────────────────────────
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifs] = useState([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    fetch('/api/notifications?limit=50', { credentials:'include' })
      .then(r => r.json())
      .then(data => setNotifs(data.notifications || []))
      .catch(() => {});
  }, [user]);

  const markRead = useCallback(async (notifId) => {
    await fetch(`/api/notifications/${notifId}/read`, { method:'POST', credentials:'include' });
    setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch('/api/notifications/read-all', { method:'POST', credentials:'include' });
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  }, []);

  const clear = useCallback(async () => {
    await fetch('/api/notifications', { method:'DELETE', credentials:'include' });
    setNotifs([]);
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, clear };
}