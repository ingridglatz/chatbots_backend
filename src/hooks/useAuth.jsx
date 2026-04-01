import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { authService } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('cb_token'));
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('cb_token'));

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    authService.getMe()
      .then((res) => { setUser(res.data.data.user); setTenant(res.data.data.tenant); })
      .catch(() => { localStorage.removeItem('cb_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await authService.login(email, password);
    const tk = res.data.data.token;
    localStorage.setItem('cb_token', tk);
    setToken(tk);
    return res;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authService.register(data);
    const tk = res.data.data.token;
    localStorage.setItem('cb_token', tk);
    setToken(tk);
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cb_token');
    setToken(null);
    setUser(null);
    setTenant(null);
    toast.success('Até logo!');
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, tenant, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
