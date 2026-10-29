// Harness da camada 2 (#8): worker, socket e câmera falsos para testar a detecção
// de atenção pela interface pública (<AttentionMonitor>), com tempo controlado.
import { vi } from 'vitest';
import { act } from '@testing-library/react';

export class FakeWorker {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.posted = [];
    this.terminated = false;
    this.onmessage = null;
    FakeWorker.instances.push(this);
  }
  postMessage(msg) { this.posted.push(msg); }
  terminate() { this.terminated = true; }
  send(data) { act(() => { this.onmessage?.({ data }); }); }
}

export const lastWorker = () => FakeWorker.instances[FakeWorker.instances.length - 1];

// Socket falso: registra emits em ordem e permite disparar eventos do servidor.
export function createFakeSocket() {
  const handlers = {};
  let n = 0;
  const s = {
    connected: true,
    id: 'sid-0',
    emit: vi.fn(),
    // Cada conexão nova ganha outro id, como no socket.io.
    connect: vi.fn(() => { s.connected = true; s.id = `sid-${++n}`; return s; }),
    disconnect: vi.fn(() => { s.connected = false; s.id = undefined; return s; }),
    on(ev, fn) { (handlers[ev] ||= []).push(fn); },
    off(ev, fn) { handlers[ev] = fn ? (handlers[ev] || []).filter((h) => h !== fn) : []; },
    trigger(ev, data) { act(() => { (handlers[ev] || []).forEach((h) => h(data)); }); },
  };
  return s;
}

// Sequência de emissões no formato da issue: ["attention_update", status] ou [evento].
export function emitted(socket) {
  return socket.emit.mock.calls.map(([ev, p]) => (ev === 'attention_update' ? [ev, p.status] : [ev]));
}
export const updates = (socket) => socket.emit.mock.calls.filter(([ev]) => ev === 'attention_update').map(([, p]) => p);

export function createFakeStream() {
  const listeners = {};
  const track = {
    kind: 'video',
    stop: vi.fn(),
    addEventListener(ev, fn) { (listeners[ev] ||= []).push(fn); },
    removeEventListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((h) => h !== fn); },
    // Simula a webcam desconectada.
    end() { act(() => { (listeners.ended || []).forEach((h) => h()); }); },
  };
  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}

export function setupEnvironment() {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
  const stream = createFakeStream();
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // jsdom não implementa rolagem; as listas de transcrição chamam scrollIntoView.
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  setVisibility('visible');
  return { stream, getUserMedia };
}

export function teardownEnvironment() {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

// Resolve promessas pendentes (getUserMedia, play) dentro do act.
export async function flush() {
  await act(async () => {});
}

// Avança o relógio em `ms`, chamando `each(tDoPasso)` a cada `step` ms (frames do worker).
export function advance(ms, each, step = 100) {
  for (let t = step; t <= ms; t += step) {
    act(() => { vi.advanceTimersByTime(step); });
    each?.(t);
  }
}

export function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true });
}
export function changeVisibility(state) {
  setVisibility(state);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

export const ATTENTIVE = { yaw: 0, pitch: 0, roll: 0, ear: 0.3 };
export const pose = (w, over = {}) => w.send({ type: 'pose', ...ATTENTIVE, ...over });
export const noFace = (w) => w.send({ type: 'no_face' });
