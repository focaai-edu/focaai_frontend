import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import socket from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    let cancelled = false;
    api.get('/api/auth/me')
      .then(res => {
        if (!cancelled && res.data.authenticated) {
          setUser(res.data.user);
        }
      })
      .catch(() => {
        // Session expired or server unreachable
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // O socket pertence à sessão: o servidor guarda o usuário da conexão no
  // handshake, então ele só conecta com alguém autenticado e cai junto com a
  // sessão. Trocar de conta na mesma aba abre uma conexão nova (#7, F06).
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId === null) {
      socket.disconnect();
      return undefined;
    }
    if (!socket.connected) socket.connect();
    return () => socket.disconnect();
  }, [userId]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (name, email, password, role) => {
    const res = await api.post('/api/auth/register', { name, email, password, role });
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    // Antes de tudo: nada mais sai por esta conexão em nome do usuário que saiu.
    socket.disconnect();
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Even if server call fails, clear local state
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
