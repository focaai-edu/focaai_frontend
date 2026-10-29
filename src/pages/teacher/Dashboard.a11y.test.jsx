import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { iconButtonsWithoutLabel } from '../../test/a11y';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }));

import api from '../../services/api';
import TeacherDashboard from './Dashboard';

const SCHEDULED = { id: 6, title: 'Química', status: 'scheduled', created_at: '2026-10-28T10:00:00Z' };

beforeEach(() => {
  api.get.mockReset();
  api.get.mockImplementation(async (url, { params }) => ({ data: { classes: params.status === 'scheduled' ? [SCHEDULED] : [] } }));
});
afterEach(cleanup);

async function renderDashboard() {
  render(<MemoryRouter><TeacherDashboard /></MemoryRouter>);
  await act(async () => {});
}

describe('Dashboard do professor — acessibilidade (#16)', () => {
  it('CA1–CA3: "Nova Aula" abre um dialog rotulado; Tab fica preso; Escape fecha e devolve o foco', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    const opener = screen.getByRole('button', { name: /Nova Aula/ });
    opener.focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'Nova Aula' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('CA4: botões só com ícone têm aria-label (fechar, editar, excluir)', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole('button', { name: /Agendadas/ }));
    expect(screen.getByRole('button', { name: 'Editar aula Química' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir aula Química' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Nova Aula/ }));
    expect(screen.getByRole('button', { name: 'Fechar janela' })).toBeTruthy();
    expect(iconButtonsWithoutLabel()).toEqual([]);
  });

  it('CA3: editar pelo lápis abre "Editar Aula" e devolve o foco ao lápis ao fechar', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole('button', { name: /Agendadas/ }));
    const pencil = screen.getByRole('button', { name: 'Editar aula Química' });
    await user.click(pencil);
    expect(screen.getByRole('dialog', { name: 'Editar Aula' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Fechar janela' }));
    expect(document.activeElement).toBe(pencil);
  });
});
