import { expect, test } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.locator('#identifier').fill('admin@lmscasa.local');
  await page.locator('#password').fill('Admin@12345');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeEach(async ({ page, request }) => {
  const health = await request.get('http://localhost:4000/health');
  expect(health.ok()).toBeTruthy();
});

test('admin can log in and see the main LMS navigation', async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
  await expect(page.locator('a[href="/courses"]')).toBeVisible();
  await expect(page.locator('a[href="/exams"]')).toBeVisible();
  await expect(page.locator('a[href="/admin"]')).toBeVisible();
  await expect(page.locator('a[href="/users"]')).toBeVisible();
});

test('dev quick login signs in as super admin', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.getByRole('button', { name: /Super Admin/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
  await expect(page.locator('a[href="/admin"]')).toBeVisible();
});

test('certificate surface is not exposed when certificates are disabled', async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.locator('a[href="/certificates"]')).toHaveCount(0);
  await page.goto('/certificates');
  await expect(page).toHaveURL(/\/dashboard$/);
});
