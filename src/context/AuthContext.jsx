import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import socket from '../services/socket';
import { isLoadFailure } from '../lib/loadError';

const SESSION_ENDED_TEXT = 'Sua sessão terminou. Entre de novo para continuar.';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Sessão encerrada fora desta aba (logout em outra aba do mesmo login, #32).
  const [sessionEnded, setSessionEnded] = useState(false);

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

    // O servidor derruba as conexões de um login no logout (backend RN27). Com
    // "io server disconnect" o socket.io não reconecta sozinho: a aba confere a
    // sessão. Sem usuário → sessão encerrada; mesmo usuário → reconecta; sem
    // resposta → tenta de novo ao focar a janela ou voltar a ficar online (#32).
    let cancelled = false;
    let retryArmed = false;
    const disarmRetry = () => {
      if (!retryArmed) return;
      retryArmed = false;
      window.removeEventListener('focus', checkSession);
      window.removeEventListener('online', checkSession);
    };
    async function checkSession() {
      disarmRetry();
      try {
        const res = await api.get('/api/auth/me');
        if (cancelled) return;
        if (res.data.authenticated && res.data.user?.id === userId) socket.connect();
        else { setSessionEnded(true); setUser(null); }
      } catch (err) {
        if (cancelled) return;
        if (isLoadFailure(err)) {
          retryArmed = true;
          window.addEventListener('focus', checkSession);
          window.addEventListener('online', checkSession);
        } else {
          setSessionEnded(true);
          setUser(null);
        }
      }
    }
    const onDisconnect = (reason) => {
      if (reason === 'io server disconnect') checkSession();
    };
    socket.on('disconnect', onDisconnect);

    return () => {
      cancelled = true;
      disarmRetry();
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [userId]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    setSessionEnded(false);
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (name, email, password, role) => {
    const res = await api.post('/api/auth/register', { name, email, password, role });
    setSessionEnded(false);
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
      {sessionEnded && (
        <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] px-4 py-3 rounded-lg bg-primary text-text-primary-dark text-sm shadow-sm">
          {SESSION_ENDED_TEXT}
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
