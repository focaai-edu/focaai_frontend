import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../../services/socket', async () => {
  const { createFakeSocket } = await import('../../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }));

import api from '../../services/api';
import '../../services/socket';
import TeacherDashboard from './Dashboard';

const NOW = new Date('2026-10-29T12:00:00Z');
const LIVE = { id: 5, title: 'Biologia', status: 'live', started_at: '2026-10-29T10:55:00Z', created_at: '2026-10-28T10:00:00Z' };
const SCHEDULED = { id: 6, title: 'Química', status: 'scheduled', created_at: '2026-10-28T10:00:00Z' };

function classesBy(list) {
  return async (url, { params } = {}) => ({ data: { classes: list.filter((c) => c.status === params?.status) } });
}

function Probe() {
  return <p>rota ao vivo</p>;
}

async function renderDashboard(list) {
  api.get.mockImplementation(classesBy(list));
  render(
    <MemoryRouter initialEntries={['/teacher/dashboard']}>
      <Routes>
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/classes/:id/live" element={<Probe />} />
        <Route path="/room" element={<p>rota da sala</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  api.get.mockReset();
  api.patch.mockReset();
  socket.current.emit.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Dashboard do professor (#9)', () => {
  it('CA1: "Acessar" numa aula ao vivo leva para a tela ao vivo', async () => {
    await renderDashboard([LIVE]);
    fireEvent.click(screen.getByRole('button', { name: /Acessar/ }));
    expect(screen.getByText('rota ao vivo')).toBeTruthy();
  });

  it('CA1: a câmera da sala continua como opção secundária', async () => {
    await renderDashboard([LIVE]);
    fireEvent.click(screen.getByRole('button', { name: 'Câmera da sala' }));
    expect(screen.getByText('rota da sala')).toBeTruthy();
  });

  it('CA1/CA12: "Iniciar" faz só o PATCH e vai para a tela ao vivo, sem start_class no socket', async () => {
    await renderDashboard([SCHEDULED]);
    api.patch.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole('button', { name: /Agendadas/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Iniciar/ })); });
    expect(api.patch).toHaveBeenCalledWith('/api/classes/6/start');
    expect(screen.getByText('rota ao vivo')).toBeTruthy();
    expect(socket.current.emit).not.toHaveBeenCalled();
  });

  it('CA1 (erro): "Iniciar" com o PATCH falhando não navega', async () => {
    await renderDashboard([SCHEDULED]);
    api.patch.mockRejectedValue({ response: { data: { error: 'Aula não pode ser iniciada' } } });
    fireEvent.click(screen.getByRole('button', { name: /Agendadas/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Iniciar/ })); });
    expect(screen.queryByText('rota ao vivo')).toBeNull();
    expect(screen.getByText('Aula não pode ser iniciada')).toBeTruthy();
  });

  it('CA12: "Encerrar" faz só o PATCH, sem end_class no socket', async () => {
    await renderDashboard([LIVE]);
    api.patch.mockResolvedValue({ data: {} });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Encerrar' })); });
    expect(api.patch).toHaveBeenCalledWith('/api/classes/5/end');
    expect(socket.current.emit).not.toHaveBeenCalled();
  });

  it('CA8: o card ao vivo mostra há quanto tempo a aula está ao vivo', async () => {
    await renderDashboard([LIVE]);
    expect(screen.getByText('Ao vivo há 1 h 05 min')).toBeTruthy();
    expect(screen.queryByText(/Iniciada em/)).toBeNull();
  });

  it('CA10 (erro): backend fora mostra "Não foi possível carregar.", não "Nenhuma aula ao vivo"', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));
    render(
      <MemoryRouter initialEntries={['/teacher/dashboard']}>
        <Routes><Route path="/teacher/dashboard" element={<TeacherDashboard />} /></Routes>
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.getByText('Não foi possível carregar.')).toBeTruthy();
    expect(screen.queryByText('Nenhuma aula ao vivo')).toBeNull();
    api.get.mockImplementation(classesBy([LIVE]));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); });
    expect(screen.getByText('Biologia')).toBeTruthy();
  });
});
