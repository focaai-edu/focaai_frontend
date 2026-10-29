import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }));

import api from '../../services/api';
import TeacherDashboard from './Dashboard';

const ENDED = [
  { id: 8, title: 'Biologia', status: 'ended', ended_at: '2026-10-29T13:30:00Z' },
  { id: 9, title: 'Física', status: 'ended', ended_at: '2026-10-29T14:30:00Z' },
];
const SCHEDULED = { id: 6, title: 'Química', status: 'scheduled', created_at: '2026-10-28T10:00:00Z' };
const ENDED_TEXT = 'Tem certeza que deseja excluir a aula "Biologia"? A transcrição, os eventos de atenção e os resumos dessa aula serão removidos permanentemente. Esta ação não pode ser desfeita.';

beforeEach(() => {
  api.get.mockReset();
  api.delete.mockReset();
  api.get.mockImplementation(async (url, { params }) => ({
    data: { classes: params.status === 'ended' ? ENDED : params.status === 'scheduled' ? [SCHEDULED] : [] },
  }));
  vi.spyOn(window, 'confirm');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderEnded() {
  const user = userEvent.setup();
  render(<MemoryRouter><TeacherDashboard /></MemoryRouter>);
  await act(async () => {});
  await user.click(screen.getByRole('button', { name: /Encerradas/ }));
  return user;
}
const getCalls = () => api.get.mock.calls.length;

describe('Excluir aula no dashboard (#20)', () => {
  it('CA1: cada aula encerrada tem a lixeira "Excluir aula <título>"', async () => {
    await renderEnded();
    expect(screen.getByRole('button', { name: 'Excluir aula Biologia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir aula Física' })).toBeTruthy();
  });

  it('CA2: abre o Dialog com a mensagem completa e os botões Cancelar/Excluir aula', async () => {
    const user = await renderEnded();
    await user.click(screen.getByRole('button', { name: 'Excluir aula Biologia' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain(ENDED_TEXT);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Excluir aula' }).className).toMatch(/bg-danger/);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('CA3/CA4: confirmar faz o DELETE, mostra "Excluindo…", remove o card sem recarregar, decrementa o contador e avisa', async () => {
    const user = await renderEnded();
    let resolve;
    api.delete.mockReturnValue(new Promise((r) => { resolve = r; }));
    await user.click(screen.getByRole('button', { name: 'Excluir aula Biologia' }));
    const before = getCalls();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir aula' }));
    expect(api.delete).toHaveBeenCalledWith('/api/classes/8');
    const busy = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluindo…' });
    expect(busy.disabled).toBe(true);
    await act(async () => { resolve({ status: 204 }); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Biologia')).toBeNull();
    expect(screen.getByText('Física')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Encerradas/ }).textContent).toMatch(/1/);
    expect(screen.getByRole('status').textContent).toBe('Aula excluída com sucesso.');
    expect(getCalls()).toBe(before);
  });

  it('CA5 (erro): falha no DELETE mantém o card, fecha o diálogo e mostra o alerta', async () => {
    const user = await renderEnded();
    api.delete.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500 } }));
    await user.click(screen.getByRole('button', { name: 'Excluir aula Biologia' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir aula' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Biologia')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível excluir a aula. Tente novamente.');
  });

  it('CA6: Cancelar ou Escape não disparam DELETE e o card fica', async () => {
    const user = await renderEnded();
    const trash = screen.getByRole('button', { name: 'Excluir aula Biologia' });
    await user.click(trash);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(document.activeElement).toBe(trash);
    await user.click(trash);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Biologia')).toBeTruthy();
  });

  it('CA7: aula agendada usa o mesmo diálogo com a mensagem curta', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TeacherDashboard /></MemoryRouter>);
    await act(async () => {});
    await user.click(screen.getByRole('button', { name: /Agendadas/ }));
    await user.click(screen.getByRole('button', { name: 'Excluir aula Química' }));
    const text = screen.getByRole('dialog').textContent;
    expect(text).toContain('Tem certeza que deseja excluir a aula "Química"? Esta ação não pode ser desfeita.');
    expect(text).not.toMatch(/transcrição/);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
