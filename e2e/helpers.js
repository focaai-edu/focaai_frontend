// e2e da detecção de atenção (#11): câmera falsa (.y4m) → MediaPipe real no worker →
// useAttention → attention_update → linhas em attention_events no banco de TESTE.
// Modo parcial: só os clipes sintéticos feitos da foto; os de movimento aguardam
// gravações reais.
import { expect, request as pwRequest } from '@playwright/test';
import { clipPath } from './clips.js';

const API = 'http://localhost:5100';
const PASSWORD = 'senha-e2e-123';
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Chromium com a câmera falsa apontando para um clipe.
export const camera = (clip) => ({
  launchOptions: {
    ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      ...(clip ? [`--use-file-for-fake-video-capture=${clipPath(clip)}`] : []),
    ],
  },
});

async function register(ctx, role) {
  const email = `e2e-${role}-${uid()}@foca.test`;
  const res = await ctx.post(`${API}/api/auth/register`, { data: { name: `E2E ${role}`, email, password: PASSWORD, role } });
  expect(res.ok(), `cadastro do ${role}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).user;
}

// Professor cria e inicia uma aula no banco de teste; o aluno fica logado no contexto da página.
export async function liveClass(page) {
  const teacher = await pwRequest.newContext();
  await register(teacher, 'teacher');
  const created = await teacher.post(`${API}/api/classes`, { data: { title: `E2E ${uid()}` } });
  expect(created.status()).toBe(201);
  const cls = (await created.json()).class;
  expect((await teacher.patch(`${API}/api/classes/${cls.id}/start`)).ok()).toBeTruthy();
  const student = await register(page.request, 'student');
  return { teacher, cls, student };
}

export async function attentionStatuses(teacher, classId, studentId) {
  const res = await teacher.get(`${API}/api/classes/${classId}/attention-events`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).events
    .filter((e) => e.student_id === studentId && e.source === 'webcam')
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
    .map((e) => e.status);
}

// Rótulo de status exibido sobre a câmera (AttentionIndicator).
export const statusBadge = (page, label) => page.locator('[title]').filter({ hasText: new RegExp(`^${label}$`) }).first();

