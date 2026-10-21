import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, post } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Estrellitas apartadas en fichas que aún no se han jugado (se muestran ya descontadas)
  const [reserved, setReserved] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api('/auth/me');
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const { user } = await post('/auth/login', { username, password });
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (payload) => {
    const { user } = await post('/auth/register', payload);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const setStars = useCallback((stars) => {
    if (typeof stars === 'number') setUser((u) => (u ? { ...u, stars } : u));
  }, []);

  const patchUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, setStars, patchUser, reserved, setReserved }),
    [user, loading, login, register, logout, refresh, setStars, patchUser, reserved],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
