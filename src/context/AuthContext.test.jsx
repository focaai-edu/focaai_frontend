import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../services/socket', async () => {
  const { createFakeSocket } = await import('../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// A Sidebar desenha partículas num canvas; irrelevante aqui.
vi.mock('../components/ParticleField', () => ({ default: () => null }));

import api from '../services/api';
import '../services/socket';
import { AuthProvider, useAuth } from './AuthContext';
import Sidebar from '../components/Sidebar';

const ANA = { id: 3, name: 'Ana Souza', role: 'student' };

function LoginPage() {
  // Registra em que estado estava o socket quando a tela de login apareceu.
  socket.current.connectedAtLogin = socket.current.connected;
  return <p>Tela de login</p>;
}

async function renderApp(path = '/student/dashboard') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/student/dashboard" element={<Sidebar role="student" />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  await act(async () => {});
}

beforeEach(() => {
  window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  socket.current.connected = false;
  socket.current.connect.mockClear();
  socket.current.disconnect.mockClear();
  api.get.mockReset();
  api.post.mockReset();
});
afterEach(cleanup);

describe('Ciclo do socket com a sessão (#7, F06)', () => {
  it('CA1: "Sair" desconecta o socket antes de ir para /login', async () => {
    api.get.mockResolvedValue({ data: { authenticated: true, user: ANA } });
    api.post.mockResolvedValue({ data: {} });
    await renderApp();
    expect(socket.current.connected).toBe(true);

    await act(async () => { fireEvent.click(screen.getByTitle('Sair')); });
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(socket.current.disconnect).toHaveBeenCalled();
    expect(socket.current.connectedAtLogin).toBe(false);
    expect(socket.current.connected).toBe(false);
  });

  it('CA2: sem usuário autenticado, a tela pública não conecta o socket', async () => {
    api.get.mockResolvedValue({ data: { authenticated: false } });
    await renderApp('/login');
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(socket.current.connect).not.toHaveBeenCalled();
    expect(socket.current.connected).toBe(false);
  });

  it('CA4 (erro): logout com o servidor fora desconecta e limpa a sessão local', async () => {
    api.get.mockResolvedValue({ data: { authenticated: true, user: ANA } });
    api.post.mockRejectedValue(new Error('Network Error'));
    await renderApp();
    await act(async () => { fireEvent.click(screen.getByTitle('Sair')); });
    expect(socket.current.disconnect).toHaveBeenCalled();
    expect(socket.current.connected).toBe(false);
    expect(screen.getByText('Tela de login')).toBeTruthy();
  });

  it('CA5 (erro): /api/auth/me com 401 não deixa o socket conectado', async () => {
    socket.current.connected = true; // ex.: conexão sobrando de antes
    api.get.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }));
    await renderApp('/login');
    expect(socket.current.connect).not.toHaveBeenCalled();
    expect(socket.current.connected).toBe(false);
  });
});

// Tela mínima para trocar de conta na mesma aba.
function AccountSwitcher() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <p>usuário: {user ? user.name : 'ninguém'}</p>
      <button onClick={() => login('b@x', 'senha')}>Entrar como B</button>
      <button onClick={() => logout()}>Sair</button>
    </div>
  );
}

describe('Troca de conta na mesma aba (#7 CA3)', () => {
  it('CA3: A sai, B entra sem recarregar; o socket de B é uma conexão nova, aberta depois do login', async () => {
    const BRUNO = { id: 4, name: 'Bruno Lima', role: 'student' };
    api.get.mockResolvedValue({ data: { authenticated: true, user: ANA } });
    api.post.mockImplementation(async (url) => (url === '/api/auth/login' ? { data: { user: BRUNO } } : { data: {} }));
    render(<AuthProvider><AccountSwitcher /></AuthProvider>);
    await act(async () => {});
    const idOfA = socket.current.id;
    expect(socket.current.connected).toBe(true);

    await act(async () => { fireEvent.click(screen.getByText('Sair')); });
    expect(socket.current.connected).toBe(false);
    const connectsBeforeB = socket.current.connect.mock.calls.length;

    await act(async () => { fireEvent.click(screen.getByText('Entrar como B')); });
    expect(screen.getByText('usuário: Bruno Lima')).toBeTruthy();
    expect(socket.current.connect.mock.calls.length).toBe(connectsBeforeB + 1);
    expect(socket.current.connected).toBe(true);
    expect(socket.current.id).not.toBe(idOfA);
  });

  it('CA3: login direto de B, sem logout de A, também reabre a conexão', async () => {
    const BRUNO = { id: 4, name: 'Bruno Lima', role: 'student' };
    api.get.mockResolvedValue({ data: { authenticated: true, user: ANA } });
    api.post.mockResolvedValue({ data: { user: BRUNO } });
    render(<AuthProvider><AccountSwitcher /></AuthProvider>);
    await act(async () => {});
    const idOfA = socket.current.id;
    await act(async () => { fireEvent.click(screen.getByText('Entrar como B')); });
    expect(socket.current.disconnect).toHaveBeenCalled();
    expect(socket.current.connected).toBe(true);
    expect(socket.current.id).not.toBe(idOfA);
  });
});
