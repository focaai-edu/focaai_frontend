import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import {
  setupEnvironment, teardownEnvironment, flush, advance, lastWorker,
  emitted, updates, pose, noFace, changeVisibility,
} from '../test/attentionHarness';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../services/socket', async () => {
  const { createFakeSocket } = await import('../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});

import AttentionMonitor from './AttentionMonitor';

let env;

async function mount(props = {}) {
  const utils = render(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" {...props} />);
  await flush();
  const w = lastWorker();
  w.send({ type: 'ready' });
  return { ...utils, w };
}

beforeEach(() => {
  env = setupEnvironment();
  socket.current.connected = true;
  socket.current.emit.mockClear();
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
});

describe('AttentionMonitor — sequência de attention_update (#8, camada 2)', () => {
  it('CA14 (RF06): o primeiro frame atento é confirmado na hora', async () => {
    const { w } = await mount();
    pose(w);
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);
  });

  it('CA15 (RF06): desatento por 900 ms não emite; por 1000 ms emite um distracted em 1000 ms', async () => {
    const { w } = await mount();
    pose(w);
    // 900 ms desatento (frames em 0..900) e volta a atento.
    pose(w, { yaw: 40 });
    advance(900, () => pose(w, { yaw: 40 }));
    advance(300, () => pose(w));
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);

    const start = Date.now();
    pose(w, { yaw: 40 });
    let at = null;
    advance(1500, (t) => {
      pose(w, { yaw: 40 });
      if (at === null && emitted(socket.current).length === 2) at = t;
    });
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'distracted']]);
    expect(Math.abs(at - 1000)).toBeLessThanOrEqual(50);
    expect(Date.now() - start).toBe(1500);
  });

  it('CA16 (RF07): no_face contínuo vira no_camera em 8 s, sem estabilização', async () => {
    const { w } = await mount();
    pose(w);
    let at = null;
    noFace(w);
    advance(9000, (t) => {
      noFace(w);
      if (at === null && emitted(socket.current).length === 2) at = t;
    });
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'no_camera']]);
    expect(Math.abs(at - 8000)).toBeLessThanOrEqual(100);
  });

  it('CA16 (RF07): um frame com rosto zera a contagem de ausência', async () => {
    const { w } = await mount();
    pose(w);
    noFace(w);
    advance(5000, (t) => (t === 5000 ? pose(w) : noFace(w)));
    let at = null;
    advance(9000, (t) => {
      noFace(w);
      if (at === null && emitted(socket.current).length === 2) at = t;
    });
    // 8 s contados a partir do frame com rosto (em 5 s), não do primeiro no_face.
    expect(Math.abs(at - 8000)).toBeLessThanOrEqual(100);
  });

  it('CA18 (RF08, erro): com o socket desconectado nada é emitido', async () => {
    socket.current.connected = false;
    const { w } = await mount();
    pose(w);
    advance(2000, () => pose(w, { yaw: 40 }));
    expect(emitted(socket.current)).toEqual([]);
  });

  it('CA18 (RF08): payload com ângulos e EAR; no_camera sem ângulos', async () => {
    const { w } = await mount();
    pose(w, { yaw: 1, pitch: 2, roll: 3, ear: 0.31 });
    noFace(w);
    advance(8500, () => noFace(w));
    const [first, second] = updates(socket.current);
    expect(first).toMatchObject({
      class_id: 7, status: 'attentive', source: 'webcam', monitoring_mode: 'full_attention',
      yaw: 1, pitch: 2, roll: 3, ear: 0.31,
    });
    expect(second).toMatchObject({ class_id: 7, status: 'no_camera', source: 'webcam', monitoring_mode: 'full_attention' });
    for (const k of ['yaw', 'pitch', 'roll', 'ear']) expect(second).not.toHaveProperty(k);
  });

  it('CA19/CA1 (F01): depois de mudar para exam, cabeça para baixo não emite distracted', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="exam" />);
    pose(w, { pitch: -30 });
    advance(2000, () => pose(w, { pitch: -30 }));
    // O segundo attentive é a reemissão da troca de modo (RF09, #3), não um distracted.
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'attentive']]);
  });

  it('CA19 (controle): em full_attention a mesma entrada emite distracted em 1 s', async () => {
    const { w } = await mount();
    pose(w);
    pose(w, { pitch: -30 });
    let at = null;
    advance(2000, (t) => {
      pose(w, { pitch: -30 });
      if (at === null && emitted(socket.current).length === 2) at = t;
    });
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'distracted']]);
    expect(Math.abs(at - 1000)).toBeLessThanOrEqual(50);
  });

  it('CA1 (F01): depois de mudar para activity, o attention_update carrega o modo novo', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="activity" />);
    // Em activity, olhar para baixo é permitido; virar o rosto continua desatento.
    pose(w, { pitch: -40 });
    advance(1500, () => pose(w, { pitch: -40 }));
    pose(w, { yaw: 40 });
    advance(1500, () => pose(w, { yaw: 40 }));
    const ups = updates(socket.current);
    // attentive, reemissão da troca de modo (RF09, #3) e o distracted do yaw.
    expect(ups.map((u) => u.status)).toEqual(['attentive', 'attentive', 'distracted']);
    expect(ups[2].monitoring_mode).toBe('activity');
  });

  it('CA17 (RF05) / CA2: em break, 30 s de frames desatentos e sem rosto não emitem nada', async () => {
    const { w } = await mount({ monitoringMode: 'break' });
    advance(30000, (t) => (t % 200 === 0 ? pose(w, { yaw: 60, ear: 0.05 }) : noFace(w)));
    expect(emitted(socket.current)).toEqual([]);
  });

  it('CA2 (F01): ao entrar em break, um aluno atento não vira distracted', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="break" />);
    advance(5000, () => pose(w, { yaw: 60 }));
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);
  });

  it('CA7 (F14): depois de um break sem rosto, no_camera só sai 8 s após a saída do break', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="break" />);
    advance(600000, () => noFace(w), 1000); // 10 min de intervalo sem rosto
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    let at = null;
    noFace(w);
    advance(9000, (t) => {
      noFace(w);
      if (at === null && emitted(socket.current).length === 3) at = t;
    });
    // O attentive do meio é a reemissão ao sair do break (RF09, #3 CA2).
    expect(emitted(socket.current)).toEqual([
      ['attention_update', 'attentive'], ['attention_update', 'attentive'], ['attention_update', 'no_camera'],
    ]);
    expect(Math.abs(at - 8000)).toBeLessThanOrEqual(100);
  });

  it('CA7 (F14): detector que demora 12 s para carregar — a contagem começa no 1º frame', async () => {
    render(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    await flush();
    advance(12000);
    const w = lastWorker();
    w.send({ type: 'ready' });
    let at = null;
    noFace(w);
    advance(9000, (t) => {
      noFace(w);
      if (at === null && emitted(socket.current).length === 1) at = t;
    });
    expect(emitted(socket.current)).toEqual([['attention_update', 'no_camera']]);
    expect(Math.abs(at - 8000)).toBeLessThanOrEqual(100);
  });

  it('CA22/CA3 (F02): aba oculta por 1,5 s emite distracted em 1 s; ao voltar, atento por 1 s emite attentive', async () => {
    const { w } = await mount();
    pose(w);
    changeVisibility('hidden');
    let at = null;
    advance(1500, (t) => {
      if (at === null && emitted(socket.current).length === 2) at = t;
    });
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'distracted']]);
    expect(Math.abs(at - 1000)).toBeLessThanOrEqual(50);

    changeVisibility('visible');
    pose(w);
    advance(1200, () => pose(w));
    expect(emitted(socket.current)).toEqual([
      ['attention_update', 'attentive'], ['attention_update', 'distracted'], ['attention_update', 'attentive'],
    ]);
  });

  it('CA3 (F02): aba oculta por menos de 1 s não emite nada', async () => {
    const { w } = await mount();
    pose(w);
    changeVisibility('hidden');
    advance(800);
    changeVisibility('visible');
    advance(2000, () => pose(w));
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);
  });

  it('CA3 (F02): frames que chegam com a aba oculta não desfazem o distracted', async () => {
    const { w } = await mount();
    pose(w);
    changeVisibility('hidden');
    advance(3000, () => pose(w));
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'distracted']]);
  });

  it('CA4/CA22 (F02): em break, a aba oculta não emite nada', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="break" />);
    changeVisibility('hidden');
    advance(1500);
    changeVisibility('visible');
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);
  });
});

describe('AttentionMonitor — câmera indisponível (#8 CA5/CA6)', () => {
  const NO_CAMERA_TEXT = 'Não foi possível acessar a câmera. Seu professor verá você como sem câmera.';

  it.each([['NotAllowedError'], ['NotFoundError']])('CA5: getUserMedia com %s emite no_camera uma vez e mostra o aviso', async (name) => {
    env.getUserMedia.mockRejectedValueOnce(Object.assign(new Error(name), { name }));
    const { w } = await mount();
    advance(10000, () => noFace(w));
    expect(emitted(socket.current)).toEqual([['attention_update', 'no_camera']]);
    expect(screen.getByText(NO_CAMERA_TEXT)).toBeTruthy();
  });

  it('CA6: track de vídeo que termina emite no_camera sem esperar 8 s', async () => {
    const { w } = await mount();
    pose(w);
    env.stream.track.end();
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'no_camera']]);
    expect(screen.getByText(NO_CAMERA_TEXT)).toBeTruthy();
  });

  it('CA5: câmera negada durante o break emite no_camera quando o break termina', async () => {
    env.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    const { rerender } = await mount({ monitoringMode: 'break' });
    expect(emitted(socket.current)).toEqual([]);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    expect(emitted(socket.current)).toEqual([['attention_update', 'no_camera']]);
  });
});

describe('AttentionMonitor — falha do detector (#8 CA8/CA9/CA23)', () => {
  const INIT_ERROR_TEXT = 'Não foi possível iniciar o detector de atenção.';
  // O componente registra o erro do worker com console.warn; aqui ele é esperado.
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });

  async function mountWithInitError() {
    const utils = render(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    await flush();
    const w = lastWorker();
    w.send({ type: 'error', message: 'Failed to load MediaPipe: network' });
    return { ...utils, w };
  }

  it('CA8/CA23: erro na inicialização emite só no_camera e troca "Carregando detector..." pela mensagem', async () => {
    await mountWithInitError();
    expect(emitted(socket.current)).toEqual([['attention_update', 'no_camera']]);
    expect(screen.getByText(INIT_ERROR_TEXT)).toBeTruthy();
    expect(screen.queryByText(/Carregando detector/)).toBeNull();
  });

  it('CA8: "Tentar de novo" recria o worker, e o novo worker volta a decidir', async () => {
    const { w } = await mountWithInitError();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    const w2 = lastWorker();
    expect(w2).not.toBe(w);
    expect(w.terminated).toBe(true);
    expect(w2.posted).toContainEqual({ type: 'init' });
    expect(screen.queryByText(INIT_ERROR_TEXT)).toBeNull();
    w2.send({ type: 'ready' });
    w2.send({ type: 'pose', yaw: 0, pitch: 0, roll: 0, ear: 0.3 });
    advance(1200, () => pose(w2));
    expect(emitted(socket.current)).toEqual([['attention_update', 'no_camera'], ['attention_update', 'attentive']]);
  });

  it('CA9: erro num frame depois de pronto não mostra mensagem e o próximo frame é processado', async () => {
    const { w } = await mount();
    w.send({ type: 'error', message: 'Frame processing error: x' });
    expect(screen.queryByText(INIT_ERROR_TEXT)).toBeNull();
    pose(w);
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);
  });
});

describe('AttentionMonitor — reemissão na troca de modo (#3, RF09; #8 CA20)', () => {
  it('CA1/CA20: attentive em full_attention, troca para activity reemite attentive com o modo novo', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="activity" />);
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'attentive']]);
    expect(updates(socket.current)[1].monitoring_mode).toBe('activity');
  });

  it('CA1: distracted confirmado é reemitido na troca de modo', async () => {
    const { w, rerender } = await mount();
    pose(w);
    pose(w, { yaw: 40 });
    advance(1100, () => pose(w, { yaw: 40 }));
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="exam" />);
    expect(emitted(socket.current)).toEqual([
      ['attention_update', 'attentive'], ['attention_update', 'distracted'], ['attention_update', 'distracted'],
    ]);
    expect(updates(socket.current)[2]).toMatchObject({ monitoring_mode: 'exam', yaw: 40 });
  });

  it('CA1: no_camera confirmado é reemitido na troca de modo, sem ângulos', async () => {
    env.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    const { rerender } = await mount();
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="activity" />);
    expect(emitted(socket.current)).toEqual([['attention_update', 'no_camera'], ['attention_update', 'no_camera']]);
    expect(updates(socket.current)[1]).not.toHaveProperty('yaw');
  });

  it('CA2/CA20: entrar em break não emite; sair de break emite o status uma vez', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="break" />);
    advance(3000, () => pose(w));
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    advance(500, () => pose(w));
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'attentive']]);
    expect(updates(socket.current)[1].monitoring_mode).toBe('full_attention');
  });

  it('CA2: mesmo modo de novo (rerender sem troca) não reemite', async () => {
    const { w, rerender } = await mount();
    pose(w);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive']]);
  });

  it('CA5 (F27): distracted congela no break, mesmo com 1 s+ de rosto atento, e sai ao fim do intervalo', async () => {
    const { w, rerender } = await mount();
    pose(w);
    pose(w, { yaw: 40 });
    advance(1100, () => pose(w, { yaw: 40 }));
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="break" />);
    advance(3000, () => pose(w));
    expect(emitted(socket.current)).toEqual([['attention_update', 'attentive'], ['attention_update', 'distracted']]);
    rerender(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    expect(emitted(socket.current)).toEqual([
      ['attention_update', 'attentive'], ['attention_update', 'distracted'], ['attention_update', 'distracted'],
    ]);
  });
});

describe('AttentionMonitor — permissão concedida depois de sair (#4 CA10, F11)', () => {
  it('a track da webcam é parada assim que a permissão chega', async () => {
    let grant;
    env.getUserMedia.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
    const { unmount } = render(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    await flush();
    unmount();
    await act(async () => { grant(env.stream); });
    expect(env.stream.track.stop).toHaveBeenCalled();
  });

  it('play() interrompido (AbortError) também para a track daquela tentativa', async () => {
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(Object.assign(new Error('interrompido'), { name: 'AbortError' }));
    render(<AttentionMonitor classId={7} studentId={3} monitoringMode="full_attention" />);
    await flush();
    expect(env.stream.track.stop).toHaveBeenCalled();
  });
});
