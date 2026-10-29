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
    patch: vi.fn(),
  },
}));

import TeacherClassLive from './ClassLive';

beforeEach(() => {
  setupEnvironment();
  // Sem microfone: o teste é sobre a sala do socket, não sobre o áudio.
  navigator.mediaDevices.getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
  socket.current.connected = true;
  socket.current.emit.mockClear();
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
});

async function renderLive() {
  render(
    <MemoryRouter initialEntries={['/teacher/classes/7/live']}>
      <Routes><Route path="/teacher/classes/:id/live" element={<TeacherClassLive />} /></Routes>
    </MemoryRouter>,
  );
  await flush();
  await flush();
}

describe('Aula ao vivo do professor — reconexão (#3 CA8, F08)', () => {
  it('ao reconectar, emite join_class de novo e os eventos seguintes aparecem na tela', async () => {
    await renderLive();
    expect(emitted(socket.current)).toEqual([['join_class']]);

    socket.current.trigger('disconnect', 'transport close');
    socket.current.trigger('connect');
    expect(emitted(socket.current)).toEqual([['join_class'], ['join_class']]);

    socket.current.trigger('new_transcription', { class_id: 7, content: 'A fotossíntese ocorre nos cloroplastos.', timestamp: '2026-10-29T12:00:05Z' });
    socket.current.trigger('student_joined', { student_id: 3, student_name: 'Ana Souza' });
    expect(screen.getByText('A fotossíntese ocorre nos cloroplastos.')).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();

    socket.current.trigger('student_left', { student_id: 3 });
    expect(screen.queryByText('Ana Souza')).toBeNull();
  });
});
