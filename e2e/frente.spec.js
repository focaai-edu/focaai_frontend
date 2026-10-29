// e2e #11 — rosto de frente o tempo todo.
import { test, expect } from '@playwright/test';
import { camera, liveClass, attentionStatuses, statusBadge } from './helpers.js';

test.use(camera('frente'));


test('CA5: fica "Atento" e o banco tem uma única linha attentive', async ({ page }) => {
  const { teacher, cls, student } = await liveClass(page);
  await page.goto(`/student/classes/${cls.id}/live`);
  await expect(statusBadge(page, 'Atento')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(8_000);
  await expect(statusBadge(page, 'Atento')).toBeVisible();
  await expect.poll(() => attentionStatuses(teacher, cls.id, student.id)).toEqual(['attentive']);
  await teacher.dispose();
});
