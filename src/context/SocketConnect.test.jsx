import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { cleanup, screen } from '@testing-library/react';
import { Routes, Route } from 'react-router';
import { setupEnvironment, teardownEnvironment, flush } from '../test/attentionHarness';
import { renderRoutes } from '../test/router';

// Socket com a semântica do socket.io-client 4.8 que importa aqui: o engine já
// está aberto, então connect() envia um CONNECT na hora; `connected` só vira
// true quando o servidor responde; `active` vale enquanto conecta ou está
// conectado. connect() com um CONNECT pendente manda outro CONNECT, e o
// servidor recusa o duplicado com 44 "Unable to connect" (#49).
const socket = vi.hoisted(() => ({ current: null }));
vi.mock('socket.io-client', async () => {
  const { createFakeSocket } = await import('../test/attentionHarness');
  const s = createFakeSocket();
  Object.assign(s, {
    connected: false,
    active: false,
    connectPackets: 0,
    duplicates: 0,
    connect: vi.fn(() => {
      if (s.connected) return s;
      if (s.active) s.duplicates++;
      s.active = true;
      s.connectPackets++;
      return s;
    }),
    disconnect: vi.fn(() => { s.active = false; s.connected = false; return s; }),
    accept() { s.connected = true; s.trigger('connect'); },
  });
  socket.current = s;
  return { io: () => s };
});
vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  onUnauthorized: () => () => {},
}));

import api from '../services/api';
import { connectSocket } from '../services/socket';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import RoomCamera from '../pages/room/RoomCamera';
import StudentClassLive from '../pages/student/ClassLive';
import TeacherClassLive from '../pages/teacher/ClassLive';

const LIVE = { id: 26, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention', started_at: '2026-10-29T11:50:00Z', teacher_id: 1 };
let user;

function App() {
  return (
    <StrictMode>
      <AuthProvider>
        <Routes>
          <Route path="/room" element={<ProtectedRoute role="teacher"><RoomCamera /></ProtectedRoute>} />
          <Route path="/teacher/classes/:id/live" element={<ProtectedRoute role="teacher"><TeacherClassLive /></ProtectedRoute>} />
          <Route path="/student/classes/:id/live" element={<ProtectedRoute role="student"><StudentClassLive /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </StrictMode>
  );
}

async function renderAt(path) {
  renderRoutes([{ path: '*', element: <App /> }], path);
  for (let i = 0; i < 4; i++) await flush();
}

beforeEach(() => {
  setupEnvironment();
  window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  Object.assign(socket.current, { connected: false, active: false, connectPackets: 0, duplicates: 0 });
  socket.current.connect.mockClear();
  socket.current.emit.mockClear();
  user = { id: 1, name: 'Ana', role: 'teacher' };
  api.get.mockReset();
  api.get.mockImplementation(async (url) => {
    if (url === '/api/auth/me') return { data: { authenticated: true, user } };
    if (url === '/api/classes') return { data: { classes: [LIVE] } };
    if (url === '/api/classes/26') return { data: { class: LIVE } };
    return { data: {} };
  });
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
});

describe('uma conexão Socket.IO por vez (#49)', () => {
  it.each([
    ['/room', 'teacher'],
    ['/teacher/classes/26/live', 'teacher'],
    ['/student/classes/26/live', 'student'],
  ])('CA1: em StrictMode, AuthContext + %s não mandam CONNECT duplicado', async (path, role) => {
    user = { ...user, role };
    await renderAt(path);
    expect(socket.current.duplicates).toBe(0);
    expect(socket.current.active).toBe(true);
    // depois que o servidor aceita, a página entra na sala pela conexão única
    socket.current.accept();
    await flush();
    expect(socket.current.duplicates).toBe(0);
    expect(socket.current.emit.mock.calls.map(([ev]) => ev)).toContain('join_class');
  });

  it('CA2: socket inativo (ex.: depois de um disconnect) volta a conectar', async () => {
    await renderAt('/room');
    socket.current.accept();
    const before = socket.current.connectPackets;
    socket.current.disconnect();
    connectSocket();
    expect(socket.current.connectPackets).toBe(before + 1);
    expect(socket.current.duplicates).toBe(0);
    expect(screen.queryByText('Carregando...')).toBeNull();
  });

  it('CA4: connect_error do servidor vai para o console com o motivo', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    socket.current.trigger('connect_error', new Error('Unable to connect'));
    expect(error).toHaveBeenCalledWith('[socket] conexão recusada:', 'Unable to connect');
  });
});
