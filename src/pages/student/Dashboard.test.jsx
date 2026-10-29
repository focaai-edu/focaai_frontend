import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }));

import api from '../../services/api';
import StudentDashboard from './Dashboard';

const LIVE = { id: 7, title: 'Biologia', status: 'live' };

function classes(live) {
  api.get.mockImplementation(async (url, { params }) => ({ data: { classes: params.status === 'live' ? live : [] } }));
}
async function renderDashboard() {
  render(<MemoryRouter><StudentDashboard /></MemoryRouter>);
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  api.get.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Painel do aluno (#5)', () => {
  it('CA12: uma aula que fica ao vivo aparece em até 15 s, sem recarregar a página', async () => {
    classes([]);
    await renderDashboard();
    expect(screen.getByText('Nenhuma aula ao vivo no momento.')).toBeTruthy();
    classes([LIVE]);
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('CA12: ao focar a janela, recarrega na hora', async () => {
    classes([]);
    await renderDashboard();
    classes([LIVE]);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('CA10 (erro): backend fora mostra o erro, não o estado vazio; "Tentar de novo" recarrega', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));
    await renderDashboard();
    expect(screen.getByText('Não foi possível carregar.')).toBeTruthy();
    expect(screen.queryByText('Nenhuma aula ao vivo no momento.')).toBeNull();
    classes([LIVE]);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); });
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('CA10: uma falha na recarga periódica não apaga a lista que já estava na tela', async () => {
    classes([LIVE]);
    await renderDashboard();
    api.get.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });
});
