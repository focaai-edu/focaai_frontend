import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, screen, act } from '@testing-library/react';
import { Routes, Route } from 'react-router';
import { setupEnvironment, teardownEnvironment, flush, lastWorker, pose } from '../test/attentionHarness';
import { renderRoutes } from '../test/router';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../services/socket', async () => {
  const { createFakeSocket } = await import('../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() }, onUnauthorized: () => () => {} }));

import api from '../services/api';
import '../services/socket';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import StudentClassLive from '../pages/student/ClassLive';

const ANA = { id: 3, name: 'Ana Souza', role: 'student' };
const LIVE = { id: 7, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention', started_at: '2026-10-29T11:50:00Z' };
const ENDED_TEXT = 'Sua sessão terminou. Entre de novo para continuar.';

let me; // resposta atual de /api/auth/me: objeto, ou função que lança
let env;

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route path="/student/dashboard" element={<ProtectedRoute role="student"><p>Painel do aluno</p></ProtectedRoute>} />
        <Route path="/student/classes/:id/live" element={<ProtectedRoute role="student"><StudentClassLive /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}

async function renderAt(path) {
  const utils = renderRoutes([{ path: '*', element: <App /> }], path);
  await flush();
  await flush();
  return utils;
}

const meCalls = () => api.get.mock.calls.filter(([u]) => u === '/api/auth/me').length;
async function serverDisconnect(reason = 'io server disconnect') {
  socket.current.connected = false;
  socket.current.trigger('disconnect', reason);
  await flush();
  await flush();
}

beforeEach(() => {
  env = setupEnvironment();
  window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  socket.current.connected = false;
  socket.current.connect.mockClear();
  socket.current.disconnect.mockClear();
  socket.current.emit.mockClear();
  me = { data: { authenticated: true, user: ANA } };
  api.get.mockReset();
  api.get.mockImplementation(async (url) => {
    if (url === '/api/auth/me') { if (typeof me === 'function') return me(); return me; }
    if (url === '/api/classes/7') return { data: { class: LIVE } };
    throw new Error(`url inesperada ${url}`);
  });
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
});

describe('Sessão encerrada em outra aba (#32)', () => {
  it('CA1: io server disconnect com /me sem usuário mostra o aviso e vai para /login', async () => {
    await renderAt('/student/dashboard');
    expect(screen.getByText('Painel do aluno')).toBeTruthy();
    me = { data: { authenticated: false } };
    await serverDisconnect();
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(ENDED_TEXT);
  });

  it('CA1: /me com 401 também encerra a sessão local', async () => {
    await renderAt('/student/dashboard');
    me = () => { throw Object.assign(new Error('401'), { response: { status: 401 } }); };
    await serverDisconnect();
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(screen.getByText(ENDED_TEXT)).toBeTruthy();
  });

  it('CA2: na aula ao vivo, para câmera e detector e não emite mais nada', async () => {
    await renderAt('/student/classes/7/live');
    const w = lastWorker();
    w.send({ type: 'ready' });
    pose(w);
    me = { data: { authenticated: false } };
    await serverDisconnect();
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(w.terminated).toBe(true);
    expect(env.stream.track.stop).toHaveBeenCalled();
    socket.current.emit.mockClear();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(socket.current.emit).not.toHaveBeenCalled();
  });

  it('CA3 (erro): /me com o mesmo usuário reconecta o socket, sem aviso', async () => {
    await renderAt('/student/dashboard');
    socket.current.connect.mockClear();
    await serverDisconnect();
    expect(socket.current.connect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Painel do aluno')).toBeTruthy();
    expect(screen.queryByText(ENDED_TEXT)).toBeNull();
  });

  it('CA4 (erro): /me com falha de rede não desloga; tenta de novo ao focar a janela', async () => {
    await renderAt('/student/dashboard');
    me = () => { throw Object.assign(new Error('Network Error'), { request: {} }); };
    await serverDisconnect();
    expect(screen.getByText('Painel do aluno')).toBeTruthy();
    expect(screen.queryByText(ENDED_TEXT)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    me = { data: { authenticated: false } };
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(screen.getByText('Tela de login')).toBeTruthy();
  });

  it('CA4: depois de uma falha de rede, voltar a ficar online também confere de novo', async () => {
    await renderAt('/student/dashboard');
    me = () => { throw Object.assign(new Error('Network Error'), { request: {} }); };
    await serverDisconnect();
    me = { data: { authenticated: true, user: ANA } };
    socket.current.connect.mockClear();
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await flush();
    expect(socket.current.connect).toHaveBeenCalledTimes(1);
    // Uma vez conferido, focar a janela não consulta de novo.
    const calls = meCalls();
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(meCalls()).toBe(calls);
  });

  it('CA5: outros motivos de disconnect não consultam /me', async () => {
    await renderAt('/student/dashboard');
    const calls = meCalls();
    await serverDisconnect('transport close');
    await serverDisconnect('ping timeout');
    expect(meCalls()).toBe(calls);
    expect(screen.getByText('Painel do aluno')).toBeTruthy();
  });

  it('CA6: logout na própria aba (io client disconnect) não mostra o aviso', async () => {
    await renderAt('/student/dashboard');
    const calls = meCalls();
    await serverDisconnect('io client disconnect');
    expect(meCalls()).toBe(calls);
    expect(screen.queryByText(ENDED_TEXT)).toBeNull();
  });
});
