// e2e #11 — sem rosto (padrão de teste do Chrome).
import { test, expect } from '@playwright/test';
import { camera, liveClass, attentionStatuses, statusBadge } from './helpers.js';

test.use(camera(null));


test('CA11: "Sem câmera" em até 8 s + carga do modelo, e o banco registra no_camera', async ({ page }) => {
  const { teacher, cls, student } = await liveClass(page);
  await page.goto(`/student/classes/${cls.id}/live`);
  await expect(statusBadge(page, 'Sem câmera')).toBeVisible({ timeout: 14_000 + 4_000 });
  await expect.poll(() => attentionStatuses(teacher, cls.id, student.id)).toEqual(['no_camera']);
  await teacher.dispose();
});
