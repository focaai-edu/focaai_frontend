// e2e #11 — rosto sai do quadro e volta.
import { test, expect } from '@playwright/test';
import { camera, liveClass, attentionStatuses, statusBadge } from './helpers.js';

test.use(camera('fora'));


test('CA10: "Atento" → "Sem câmera" ~8 s depois de sair → "Atento"; banco attentive, no_camera, attentive', async ({ page }) => {
  const { teacher, cls, student } = await liveClass(page);
  await page.goto(`/student/classes/${cls.id}/live`);
  await expect(statusBadge(page, 'Atento')).toBeVisible({ timeout: 20_000 });
  // Rosto sai em 8 s do clipe; no_camera sai 8 s depois (RF07), com folga de carga do modelo.
  const left = Date.now();
  await expect(statusBadge(page, 'Sem câmera')).toBeVisible({ timeout: 20_000 });
  const noCameraAfter = (Date.now() - left) / 1000;
  await expect(statusBadge(page, 'Atento')).toBeVisible({ timeout: 10_000 });
  expect(noCameraAfter).toBeGreaterThan(2);
  await expect.poll(() => attentionStatuses(teacher, cls.id, student.id)).toEqual(['attentive', 'no_camera', 'attentive']);
  await teacher.dispose();
});
