// e2e #11 — CDN do MediaPipe bloqueado.
import { test, expect } from '@playwright/test';
import { camera, liveClass, attentionStatuses, statusBadge } from './helpers.js';

test.use(camera('frente'));


test('CA12: mostra o erro do detector e registra no_camera', async ({ page }) => {
  await page.route('**/cdn.jsdelivr.net/**', (route) => route.abort());
  const { teacher, cls, student } = await liveClass(page);
  await page.goto(`/student/classes/${cls.id}/live`);
  await expect(page.getByText('Não foi possível iniciar o detector de atenção.')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => attentionStatuses(teacher, cls.id, student.id)).toEqual(['no_camera']);
  await teacher.dispose();
});
