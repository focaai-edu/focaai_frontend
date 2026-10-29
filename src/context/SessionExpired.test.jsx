import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, screen, fireEvent } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router';
import { flush } from '../test/attentionHarness';
import { renderRoutes } from '../test/router';
import { fakeAdapter } from '../test/fakeAdapter';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../services/socket', async () => {
  const { createFakeSocket, fakeSocketModule } = await import('../test/attentionHarness');
  socket.current = createFakeSocket();
  return fakeSocketModule(socket.current);
});

import api from '../services/api';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Login from '../pages/Login';

const ANA = { id: 3, name: 'Ana Souza', role: 'teacher' };
const ENDED_TEXT = 'Sua sessão terminou. Entre de novo para continuar.';
const original = api.defaults.adapter;
let classes; // status de /api/classes
let calls;

// Tela protegida com duas cargas paralelas, como o painel do professor.
function Panel() {
  const [error, setError] = useState(null);
  useEffect(() => {
    Promise.all([api.get('/api/classes'), api.get('/api/classes')]).catch(() => setError('Erro ao carregar.'));
  }, []);
  return <p>{error ?? 'Painel do professor'}</p>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/teacher/dashboard" element={<ProtectedRoute role="teacher"><Panel /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}

async function renderAt(path) {
  const utils = renderRoutes([{ path: '*', element: <App /> }], path);
  for (let i = 0; i < 4; i++) await flush();
  return utils;
}

beforeEach(() => {
  window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  socket.current.connected = false;
  socket.current.connect.mockClear();
  socket.current.disconnect.mockClear();
  classes = 200;
  calls = [];
  api.defaults.adapter = fakeAdapter((url, config) => {
    calls.push(`${config.method} ${url}`);
    if (url === '/api/auth/me') return { data: { authenticated: true, user: ANA } };
    if (url === '/api/classes') return { status: classes, data: classes === 401 ? { error: 'Não autenticado.' } : { classes: [] } };
    if (url === '/api/auth/login') return { status: 401, data: { error: 'Credenciais inválidas.' } };
    throw new Error(`url inesperada ${url}`);
  });
});
afterEach(() => {
  cleanup();
  api.defaults.adapter = original;
});

describe('sessão expirada no meio do uso (#45)', () => {
  it('CA1 e CA4: 401 nas cargas do painel limpa o usuário, derruba o socket e vai uma vez para /login com o aviso', async () => {
    classes = 401;
    const { router } = await renderAt('/teacher/dashboard');

    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getAllByText(ENDED_TEXT)).toHaveLength(1);
    expect(socket.current.disconnect).toHaveBeenCalled();
    expect(screen.queryByText('Painel do professor')).toBeNull();
    // sem loop: o /login não refaz chamadas protegidas
    const before = calls.length;
    for (let i = 0; i < 4; i++) await flush();
    expect(calls.length).toBe(before);
    expect(calls.filter((c) => c === 'get /api/classes')).toHaveLength(2);
  });

  it('CA5: sem 401 o painel segue logado', async () => {
    classes = 500;
    const { router } = await renderAt('/teacher/dashboard');
    expect(router.state.location.pathname).toBe('/teacher/dashboard');
    expect(screen.getByText('Erro ao carregar.')).toBeTruthy();
    expect(screen.queryByText(ENDED_TEXT)).toBeNull();
  });

  it('CA2: credencial errada no login mostra o erro do login, não o aviso de sessão', async () => {
    api.defaults.adapter = fakeAdapter((url) => {
      if (url === '/api/auth/me') return { data: { authenticated: false } };
      if (url === '/api/auth/login') return { status: 401, data: { error: 'Credenciais inválidas.' } };
      throw new Error(`url inesperada ${url}`);
    });
    await renderAt('/login');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.test' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } });
    fireEvent.submit(screen.getByLabelText('Senha').closest('form'));
    for (let i = 0; i < 4; i++) await flush();
    expect(screen.getByText('E-mail ou senha inválidos.')).toBeTruthy();
    expect(screen.queryByText(ENDED_TEXT)).toBeNull();
  });
});
