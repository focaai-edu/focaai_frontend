import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { setupEnvironment, teardownEnvironment, flush, emitted, advance, lastWorker, pose } from '../../test/attentionHarness';
import api from '../../services/api';

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

const LIVE = { id: 7, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention', started_at: '2026-10-29T11:50:00Z' };

function Review() {
  return <p>Tela de revisão</p>;
}

async function renderLive() {
  render(
    <MemoryRouter initialEntries={['/student/classes/7/live']}>
      <Routes>
        <Route path="/student/classes/:id/live" element={<StudentClassLive />} />
        <Route path="/student/classes/:id/review" element={<Review />} />
      </Routes>
    </MemoryRouter>,
  );
  await flush();
  await flush();
}

// Aluno com distracted confirmado na aula ao vivo.
async function renderDistracted() {
  await renderLive();
  const w = lastWorker();
  w.send({ type: 'ready' });
  pose(w);
  pose(w, { yaw: 40 });
  advance(1100, () => pose(w, { yaw: 40 }));
  return w;
}

beforeEach(() => {
  api.get.mockResolvedValue({ data: { class: LIVE } });
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

describe('Aula ao vivo do aluno — reconexão (#3 CA3; #8 CA21)', () => {
  it('ao reconectar, emite join_class e em seguida o status confirmado', async () => {
    await renderDistracted();
    const before = emitted(socket.current).length;
    socket.current.connected = false;
    socket.current.trigger('disconnect', 'transport close');
    socket.current.connected = true;
    socket.current.trigger('connect');
    await flush();
    expect(emitted(socket.current).slice(before)).toEqual([['join_class'], ['attention_update', 'distracted']]);
  });

  it('entrando com o socket desconectado, conecta e emite um único join_class', async () => {
    socket.current.connected = false;
    await renderLive();
    expect(socket.current.connect).toHaveBeenCalled();
    expect(emitted(socket.current)).toEqual([]);
    socket.current.connected = true;
    socket.current.trigger('connect');
    await flush();
    expect(emitted(socket.current)).toEqual([['join_class']]);
  });

  it('reconectando durante o break, só emite join_class', async () => {
    api.get.mockResolvedValue({ data: { class: { ...LIVE, monitoring_mode: 'break' } } });
    await renderLive();
    socket.current.trigger('connect');
    await flush();
    expect(emitted(socket.current)).toEqual([['join_class'], ['join_class']]);
  });

  it('CA6 (F07): ao reconectar com a aula já encerrada, para a câmera e vai para a revisão', async () => {
    const w = await renderDistracted();
    api.get.mockResolvedValue({ data: { class: { ...LIVE, status: 'ended' } } });
    socket.current.trigger('connect');
    await flush();
    await flush();
    expect(api.get).toHaveBeenLastCalledWith('/api/classes/7');
    expect(screen.getByText('Tela de revisão')).toBeTruthy();
    expect(env.stream.track.stop).toHaveBeenCalled();
    expect(w.terminated).toBe(true);
  });

  it('CA6: ao reconectar com a aula ainda ao vivo, continua na tela', async () => {
    await renderDistracted();
    socket.current.trigger('connect');
    await flush();
    await flush();
    expect(screen.queryByText('Tela de revisão')).toBeNull();
  });

  it('CA7 (F07, erro): error do servidor ao reentrar faz a mesma consulta e vai para a revisão', async () => {
    await renderDistracted();
    api.get.mockClear();
    api.get.mockResolvedValue({ data: { class: { ...LIVE, status: 'ended' } } });
    socket.current.trigger('error', { message: 'Aula nao esta ao vivo' });
    await flush();
    await flush();
    expect(api.get).toHaveBeenCalledWith('/api/classes/7');
    expect(screen.getByText('Tela de revisão')).toBeTruthy();
  });
});

describe('Aula ao vivo do aluno — contrato de identidade (#7 CA6)', () => {
  it('join_class leva só class_id; attention_update leva class_id, status, source e o student_id da sessão', async () => {
    const w = (await renderLive(), lastWorker());
    w.send({ type: 'ready' });
    pose(w);
    const calls = socket.current.emit.mock.calls;
    const join = calls.find(([ev]) => ev === 'join_class')[1];
    const update = calls.find(([ev]) => ev === 'attention_update')[1];
    expect(join).toEqual({ class_id: 7 });
    expect(update).toMatchObject({ class_id: 7, status: 'attentive', source: 'webcam' });
    // Compatibilidade até focaai_backend#7: o mesmo id do usuário autenticado (useAuth).
    expect(update.student_id).toBe(3);
  });
});

describe('Aula ao vivo do aluno — professor desconectado (#9 CA4–CA6)', () => {
  const away = (classId = 7) => ({ class_id: classId, connected: false, changed_at: '2026-10-29T11:58:00Z' });
  const back = (classId = 7) => ({ class_id: classId, connected: true, changed_at: '2026-10-29T11:59:00Z' });

  it('CA4: teacher_presence false mostra o aviso (role=status) até chegar true', async () => {
    await renderLive();
    expect(screen.queryByText('Professor desconectado')).toBeNull();
    socket.current.trigger('teacher_presence', away());
    expect(screen.getByText('Professor desconectado').closest('[role="status"]')).toBeTruthy();
    socket.current.trigger('teacher_presence', back());
    expect(screen.queryByText('Professor desconectado')).toBeNull();
  });

  it('CA5: class_state com teacher_presence.connected false já mostra o aviso', async () => {
    await renderLive();
    socket.current.trigger('class_state', { class: LIVE, teacher_presence: away() });
    expect(screen.getByText('Professor desconectado')).toBeTruthy();
    socket.current.trigger('class_state', { class: LIVE, teacher_presence: back() });
    expect(screen.queryByText('Professor desconectado')).toBeNull();
  });

  it('CA5: class_state sem teacher_presence (backend antigo) não mostra o aviso', async () => {
    await renderLive();
    socket.current.trigger('class_state', { class: LIVE });
    expect(screen.queryByText('Professor desconectado')).toBeNull();
  });

  it('CA6 (erro): teacher_presence de outra aula não muda o aviso', async () => {
    await renderLive();
    socket.current.trigger('teacher_presence', away(99));
    expect(screen.queryByText('Professor desconectado')).toBeNull();
    socket.current.trigger('teacher_presence', away());
    socket.current.trigger('teacher_presence', back(99));
    expect(screen.getByText('Professor desconectado')).toBeTruthy();
  });
});

describe('Aula ao vivo do aluno — duração (#9 CA14)', () => {
  it('mostra a duração com o formatador único', async () => {
    // started_at 11:50, agora 12:00 (setupEnvironment)
    await renderLive();
    expect(screen.getByText(/10 min · Atenção/)).toBeTruthy();
  });

  it('acima de 24 h, mostra a duração e o aviso de aula aberta', async () => {
    api.get.mockResolvedValue({ data: { class: { ...LIVE, started_at: '2026-10-28T09:50:00Z' } } });
    await renderLive();
    expect(screen.getByText(/26 h 10 min/)).toBeTruthy();
    expect(screen.getByText('Aula aberta há mais de 24 horas. Encerre-a se ela já terminou.')).toBeTruthy();
  });
});
