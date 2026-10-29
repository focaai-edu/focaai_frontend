import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 401 em chamada autenticada = sessão encerrada no servidor (backend#14). O
// AuthContext registra o ouvinte; login, /me e logout têm tratamento próprio (#45).
const OWN_401 = ['/api/auth/login', '/api/auth/me', '/api/auth/logout'];
const listeners = new Set();

export function onUnauthorized(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

api.interceptors.response.use(undefined, (error) => {
  if (error.response?.status === 401 && !OWN_401.includes(error.config?.url)) {
    listeners.forEach((listener) => listener(error));
  }
  return Promise.reject(error);
});

export default api;
