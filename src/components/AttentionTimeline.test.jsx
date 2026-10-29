import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import AttentionTimeline, { buildSegments } from './AttentionTimeline';

afterEach(cleanup);

const T0 = '2026-10-29T13:00:00Z';
const at = (min) => new Date(Date.parse(T0) + min * 60000).toISOString();

describe('AttentionTimeline (#5 CA6/CA7, F28)', () => {
  it('CA6: posição e largura proporcionais desde o início da aula; lacunas viram "Fora"', () => {
    const segs = buildSegments([
      { status: 'attentive', started_at: at(0), ended_at: at(5) },
      // saiu por 10 min
      { status: 'distracted', started_at: at(15), ended_at: at(20) },
    ], at(0), at(30));
    expect(segs.map((s) => [s.status, +s.left.toFixed(2), +s.width.toFixed(2)])).toEqual([
      ['attentive', 0, 16.67],
      ['disconnected', 16.67, 33.33],
      ['distracted', 50, 16.67],
      ['disconnected', 66.67, 33.33],
    ]);
  });

  it('CA6: começa no início da aula, não no primeiro evento', () => {
    const segs = buildSegments([{ status: 'attentive', started_at: at(10), ended_at: at(20) }], at(0), at(20));
    expect(segs.map((s) => s.status)).toEqual(['disconnected', 'attentive']);
    expect(segs[1].left).toBe(50);
  });

  it('CA7 (erro): aula com duração 0 não gera NaN nem Infinity', () => {
    const segs = buildSegments([{ status: 'attentive', started_at: at(0), ended_at: at(0) }], at(0), at(0));
    for (const s of segs) {
      expect(Number.isFinite(s.left)).toBe(true);
      expect(Number.isFinite(s.width)).toBe(true);
    }
    const { container } = render(<AttentionTimeline events={[]} classStart={at(0)} classEnd={at(0)} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('CA7 (erro): evento sem ended_at vai até o fim da aula', () => {
    const segs = buildSegments([{ status: 'distracted', started_at: at(6), ended_at: null }], at(0), at(12));
    expect(segs[segs.length - 1]).toMatchObject({ status: 'distracted', left: 50, width: 50 });
  });

  it('clicar num trecho desatento chama onPeriodClick com o evento; "Fora" não é clicável', () => {
    const onClick = vi.fn();
    const evt = { id: 9, status: 'distracted', started_at: at(0), ended_at: at(5) };
    const { container } = render(<AttentionTimeline events={[evt]} classStart={at(0)} classEnd={at(10)} onPeriodClick={onClick} />);
    fireEvent.click(container.querySelector('[data-status="distracted"]'));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
    fireEvent.click(container.querySelector('[data-status="disconnected"]'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-status="disconnected"]').getAttribute('title')).toMatch(/^Fora/);
  });
});
