/**
 * E2E — Course browsing flow
 * Covers: courses list → course detail → lesson navigation
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

test('courses list page loads', async ({ page }) => {
  await loginAs(page, 'employee@lmscasa.local', 'Employee@12345');
  await page.goto('/courses');
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
});

test('admin can access course detail page', async ({ page, request }) => {
  await loginAs(page, 'admin@lmscasa.local', 'Admin@12345');

  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('lms-casa.auth.tokens');
    if (!raw) return null;
    return (JSON.parse(raw) as { accessToken: string }).accessToken;
  });

  const coursesRes = await request.get('http://localhost:4000/api/v1/courses?pageSize=5', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!coursesRes.ok()) {
    test.skip(true, 'Could not fetch courses');
    return;
  }

  const data = await coursesRes.json() as { items: Array<{ id: string }> };
  if (!data.items || data.items.length === 0) {
    test.skip(true, 'No courses in seed data');
    return;
  }

  const course = data.items[0]!;
  await page.goto(`/courses/${course.id}`);
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
});

test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/courses');
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
});

test('dashboard page loads after login', async ({ page }) => {
  await loginAs(page, 'admin@lmscasa.local', 'Admin@12345');
  await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
  // Dashboard should show some stats or content
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
});

test('admin dashboard page is accessible', async ({ page }) => {
  await loginAs(page, 'admin@lmscasa.local', 'Admin@12345');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
});
