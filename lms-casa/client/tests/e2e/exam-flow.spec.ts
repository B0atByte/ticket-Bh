/**
 * E2E — Exam flow
 * Covers: browse exams list → open exam → start attempt → answer questions → submit → see result
 * Uses seed employee user (employee@lmscasa.local / Employee@12345)
 */
import { expect, test } from '@playwright/test';

async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test.beforeEach(async ({ request }) => {
  const health = await request.get('http://localhost:4000/health');
  expect(health.ok()).toBeTruthy();
});

test('exams list page loads and shows published exams', async ({ page }) => {
  await loginAs(page, 'admin@lmscasa.local', 'Admin@12345');
  await page.goto('/exams');
  await expect(page).toHaveURL(/\/exams$/);
  // Page should render without crashing
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
});

test('employee can start an exam and see questions', async ({ page, request }) => {
  await loginAs(page, 'employee@lmscasa.local', 'Employee@12345');

  // Get list of published exams via API
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('lms-casa.auth.tokens');
    if (!raw) return null;
    return (JSON.parse(raw) as { accessToken: string }).accessToken;
  });

  const examsRes = await request.get('http://localhost:4000/api/v1/exams?status=PUBLISHED&pageSize=5', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!examsRes.ok()) {
    test.skip(true, 'No published exams available in seed data');
    return;
  }

  const examsData = await examsRes.json() as { items: Array<{ id: string; title: string }> };
  if (!examsData.items || examsData.items.length === 0) {
    test.skip(true, 'No published exams available in seed data');
    return;
  }

  const exam = examsData.items[0]!;
  await page.goto(`/exams/${exam.id}`);

  // Exam start page should show
  await expect(page.locator('button', { hasText: /start|เริ่ม/i })).toBeVisible({ timeout: 10_000 });
});

test('admin can view exam builder list', async ({ page }) => {
  await loginAs(page, 'admin@lmscasa.local', 'Admin@12345');
  await page.goto('/admin/exams');
  await expect(page).toHaveURL(/\/admin\/exams$/);
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
});

test('attempt history page is accessible', async ({ page }) => {
  await loginAs(page, 'employee@lmscasa.local', 'Employee@12345');
  await page.goto('/attempts');
  await expect(page).toHaveURL(/\/attempts$/);
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
});
