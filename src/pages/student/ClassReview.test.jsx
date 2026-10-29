import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, role: 'student' } }) }));
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }));

import api from '../../services/api';
import StudentClassReview from './ClassReview';

const NOW = Date.parse('2026-10-29T13:30:00Z');
const iso = (min) => new Date(Date.parse('2026-10-29T13:00:00Z') + min * 60000).toISOString().replace('.000Z', 'Z');
const CLASS = { id: 7, title: 'Biologia', status: 'ended', started_at: iso(0), ended_at: iso(30) };

function respond({ cls = CLASS, report, events = [], transcriptions = [] }) {
  api.get.mockImplementation(async (url) => {
    if (url === '/api/classes/7') return { data: { class: cls } };
    if (url === '/api/classes/7/report/3') return typeof report === 'function' ? report() : { data: { student_data: report } };
    if (url === '/api/classes/7/attention-events') return { data: { events } };
    if (url === '/api/classes/7/transcriptions') return { data: { transcriptions } };
    throw new Error(`url inesperada ${url}`);
  });
}

const studentData = (distraction_events) => ({
  attention_percentage: 80, time_attentive_minutes: 20, time_distracted_minutes: 2, time_no_camera_minutes: 0,
  distraction_events,
});

async function renderReview() {
  render(
    <MemoryRouter initialEntries={['/student/classes/7/review']}>
      <Routes><Route path="/student/classes/:id/review" element={<StudentClassReview />} /></Routes>
    </MemoryRouter>,
  );
  await act(async () => {});
  await act(async () => {});
}

const reportCalls = () => api.get.mock.calls.filter(([u]) => u === '/api/classes/7/report/3').length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
  api.get.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Revisão da aula (#5)', () => {
  it('CA8: a duração da distração aparece em segundos ("20 s", "1 min 35 s")', async () => {
    respond({ report: studentData([
      { started_at: iso(5), ended_at: iso(5.333), duration_seconds: 20, summary: 'a' },
      { started_at: iso(10), ended_at: iso(11.583), duration_seconds: 95, summary: 'b' },
    ]) });
    await renderReview();
    expect(screen.getByText('20 s')).toBeTruthy();
    expect(screen.getByText('1 min 35 s')).toBeTruthy();
    expect(screen.queryByText('0 min')).toBeNull();
  });

  it('CA13/CA14: o painel mostra o resumo em Markdown, sem HTML cru; a prévia não tem marcadores', async () => {
    const summary = '# Fotossíntese\n- A taxa depende de **luz**\n- <b>cru</b>';
    respond({ report: studentData([{ started_at: iso(5), ended_at: iso(6), duration_seconds: 60, summary }]) });
    await renderReview();
    expect(screen.getByText(/Fotossíntese A taxa depende de luz/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Fotossíntese A taxa depende de luz/));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('h4').textContent).toBe('Fotossíntese');
    expect(dialog.querySelector('strong').textContent).toBe('luz');
    expect(dialog.querySelector('b')).toBeNull();
    expect(dialog.textContent).toContain('<b>cru</b>');
  });

  it('CA9 (F22): reproduz o casamento por string — "+00:00" num endpoint e "Z" no outro ainda mostram o resumo', async () => {
    respond({
      report: studentData([{ started_at: '2026-10-29T13:05:00Z', ended_at: '2026-10-29T13:06:00Z', duration_seconds: 60, summary: 'Resumo certo' }]),
      events: [{ id: 41, status: 'distracted', started_at: '2026-10-29T13:05:00+00:00', ended_at: '2026-10-29T13:06:00+00:00' }],
    });
    await renderReview();
    fireEvent.click(document.querySelector('[data-status="distracted"]'));
    expect(screen.getByRole('dialog').textContent).toContain('Resumo certo');
  });

  it('CA9: com attention_event_id, casa pelo id mesmo com instantes diferentes', async () => {
    respond({
      report: studentData([{ attention_event_id: 41, started_at: iso(5.01), ended_at: iso(6), duration_seconds: 59, summary: 'Pelo id' }]),
      events: [{ id: 41, status: 'distracted', started_at: iso(5), ended_at: iso(6) }],
    });
    await renderReview();
    fireEvent.click(document.querySelector('[data-status="distracted"]'));
    expect(screen.getByRole('dialog').textContent).toContain('Pelo id');
  });

  it('CA6: a linha do tempo usa o início e o fim da aula e mostra a lacuna como "Fora"', async () => {
    respond({
      report: studentData([]),
      events: [
        { id: 1, status: 'attentive', started_at: iso(0), ended_at: iso(5) },
        { id: 2, status: 'attentive', started_at: iso(15), ended_at: iso(30) },
      ],
    });
    await renderReview();
    const fora = [...document.querySelectorAll('[data-status="disconnected"]')];
    expect(fora).toHaveLength(1);
    expect(fora[0].style.left).toMatch(/^16\.66/);
    expect(fora[0].style.width).toMatch(/^33\.33/);
  });

  it('CA4/CA5: sem resumo e aula encerrada há menos de 60 s, mostra "Gerando resumo…" e recarrega a cada 5 s até chegar', async () => {
    vi.setSystemTime(Date.parse(CLASS.ended_at) + 10000);
    let summary = null;
    respond({ report: () => ({ data: { student_data: studentData([{ started_at: iso(5), ended_at: iso(6), duration_seconds: 60, summary }]) } }) });
    await renderReview();
    expect(screen.getByText('Gerando resumo…')).toBeTruthy();
    expect(reportCalls()).toBe(1);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(reportCalls()).toBe(2);
    summary = 'Chegou o resumo';
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Chegou o resumo')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(reportCalls()).toBe(3);
  });

  it('CA4/CA5: passado 60 s do fim sem resumo, para de recarregar e mostra "Resumo não disponível para este trecho."', async () => {
    vi.setSystemTime(Date.parse(CLASS.ended_at) + 50000);
    respond({ report: studentData([{ started_at: iso(5), ended_at: iso(6), duration_seconds: 60, summary: null }]) });
    await renderReview();
    expect(screen.getByText('Gerando resumo…')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(5000); });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Resumo não disponível para este trecho.')).toBeTruthy();
    const calls = reportCalls();
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(reportCalls()).toBe(calls);
  });

  it('CA4: aula encerrada há muito tempo, sem resumo, não recarrega', async () => {
    vi.setSystemTime(Date.parse(CLASS.ended_at) + 10 * 60000);
    respond({ report: studentData([{ started_at: iso(5), ended_at: iso(6), duration_seconds: 60, summary: null }]) });
    await renderReview();
    expect(screen.getByText('Resumo não disponível para este trecho.')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(reportCalls()).toBe(1);
  });

  it('CA10 (erro): backend fora do ar mostra "Não foi possível carregar." e "Tentar de novo" refaz', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));
    await renderReview();
    expect(screen.getByText('Não foi possível carregar.')).toBeTruthy();
    expect(screen.queryByText(/Você não participou desta aula/)).toBeNull();
    respond({ report: studentData([]) });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); });
    await act(async () => {});
    expect(screen.queryByText('Não foi possível carregar.')).toBeNull();
    expect(screen.getByText('Biologia')).toBeTruthy();
  });

  it('CA10: 403/404 (não participou) continua com o estado vazio, não com erro', async () => {
    respond({ report: () => { throw Object.assign(new Error('403'), { response: { status: 403 } }); } });
    await renderReview();
    expect(screen.getByText(/Você não participou desta aula/)).toBeTruthy();
    expect(screen.queryByText('Não foi possível carregar.')).toBeNull();
  });
});
