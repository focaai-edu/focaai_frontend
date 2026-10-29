import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { setupEnvironment, teardownEnvironment, flush, emitted } from '../../test/attentionHarness';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../../services/socket', async () => {
  const { createFakeSocket } = await import('../../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { class: { id: 7, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention', started_at: '2026-10-29T11:50:00Z' } },
    }),
  },
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, role: 'student' } }) }));

import StudentClassLive from './ClassLive';

let env;
beforeEach(() => {
  env = setupEnvironment();
  socket.current.connected = true;
  socket.current.emit.mockClear();
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
});

describe('Aula ao vivo do aluno — câmera negada (#8 CA5)', () => {
  it('emite join_class e, depois, um único attention_update no_camera', async () => {
    env.getUserMedia.mockRejectedValue(Object.assign(new Error('negada'), { name: 'NotAllowedError' }));
    render(
      <MemoryRouter initialEntries={['/student/classes/7/live']}>
        <Routes><Route path="/student/classes/:id/live" element={<StudentClassLive />} /></Routes>
      </MemoryRouter>,
    );
    await flush();
    await flush();
    expect(emitted(socket.current)).toEqual([['join_class'], ['attention_update', 'no_camera']]);
    expect(screen.getByText('Não foi possível acessar a câmera. Seu professor verá você como sem câmera.')).toBeTruthy();
  });
});
