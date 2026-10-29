import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { iconButtonsWithoutLabel } from '../../test/a11y';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, role: 'student' } }) }));
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }));

import api from '../../services/api';
import StudentClassReview from './ClassReview';

const CLASS = { id: 7, title: 'Biologia', status: 'ended', started_at: '2026-10-29T13:00:00Z', ended_at: '2026-10-29T13:30:00Z' };
const D1 = { attention_event_id: 1, started_at: '2026-10-29T13:05:00Z', ended_at: '2026-10-29T13:06:00Z', duration_seconds: 60, summary: 'Primeiro resumo' };
const D2 = { started_at: '2026-10-29T13:10:00Z', ended_at: '2026-10-29T13:11:00Z', duration_seconds: 60, summary: 'Segundo resumo' };

beforeEach(() => {
  api.get.mockReset();
  api.get.mockImplementation(async (url) => {
    if (url === '/api/classes/7') return { data: { class: CLASS } };
    if (url === '/api/classes/7/report/3') return { data: { student_data: { attention_percentage: 80, time_attentive_minutes: 20, time_distracted_minutes: 2, time_no_camera_minutes: 0, distraction_events: [D1, D2] } } };
    if (url === '/api/classes/7/attention-events') return { data: { events: [{ id: 1, status: 'distracted', started_at: D1.started_at, ended_at: D1.ended_at }] } };
    return { data: { transcriptions: [] } };
  });
});
afterEach(cleanup);

async function renderReview() {
  render(
    <MemoryRouter initialEntries={['/student/classes/7/review']}>
      <Routes><Route path="/student/classes/:id/review" element={<StudentClassReview />} /></Routes>
    </MemoryRouter>,
  );
  await act(async () => {});
  await act(async () => {});
}

describe('Revisão — acessibilidade (#16 CA5/CA6)', () => {
  it('CA5: cada distração da lista é um <button type="button"> com foco visível', async () => {
    await renderReview();
    const items = screen.getAllByRole('button', { name: /resumo/ }).filter((b) => b.closest('ul, [data-distraction-list]'));
    expect(items).toHaveLength(2);
    for (const b of items) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('type')).toBe('button');
      expect(b.className).toMatch(/w-full/);
      expect(b.className).toMatch(/text-left/);
      expect(b.className).toMatch(/focus-visible:ring-2/);
      expect(b.className).toMatch(/focus-visible:ring-primary/);
    }
  });

  it('CA5/CA6: Enter e Espaço abrem o resumo; Escape fecha e devolve o foco ao item', async () => {
    const user = userEvent.setup();
    await renderReview();
    const [first, second] = screen.getAllByRole('button', { name: /resumo/ }).filter((b) => b.closest('[data-distraction-list]'));
    first.focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Primeiro resumo');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(first);

    second.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog').textContent).toContain('Segundo resumo');
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    }
  });

  it('CA4: o "×" do painel tem aria-label; nenhum botão só com ícone fica sem rótulo', async () => {
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getAllByRole('button', { name: /resumo/ }).find((b) => b.closest('[data-distraction-list]')));
    expect(screen.getByRole('button', { name: 'Fechar resumo' })).toBeTruthy();
    expect(iconButtonsWithoutLabel()).toEqual([]);
  });

  it('CA6: o trecho desatento da linha do tempo também abre pelo teclado', async () => {
    const user = userEvent.setup();
    await renderReview();
    const segment = document.querySelector('[data-status="distracted"]');
    expect(segment.tagName).toBe('BUTTON');
    segment.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog').textContent).toContain('Primeiro resumo');
  });
});
