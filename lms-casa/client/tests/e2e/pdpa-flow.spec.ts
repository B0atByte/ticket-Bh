/**
 * E2E — PDPA / Privacy flow
 * Covers: navigate to privacy page → export data button visible → delete account dialog
 * NOTE: We do NOT actually trigger delete (irreversible) — we verify the UI is correct.
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

test('privacy page is accessible to authenticated user', async ({ page }) => {
  await loginAs(page, 'employee@lmscasa.local', 'Employee@12345');
  await page.goto('/me/privacy');
  await expect(page).toHaveURL(/\/me\/privacy$/);
  await expect(page.locator('h1', { hasText: /privacy/i })).toBeVisible({ timeout: 10_000 });
});

test('export ZIP button is visible on privacy page', async ({ page }) => {
  await loginAs(page, 'employee@lmscasa.local', 'Employee@12345');
  await page.goto('/me/privacy');
  await expect(page.locator('button', { hasText: /export zip/i })).toBeVisible({ timeout: 10_000 });
});

test('delete account button opens confirmation dialog', async ({ page }) => {
  await loginAs(page, 'employee@lmscasa.local', 'Employee@12345');
  await page.goto('/me/privacy');

  // Click the delete account button
  await page.locator('button', { hasText: /delete my account/i }).click();

  // Dialog should appear with confirm input
  await expect(page.locator('#pdpa-confirm')).toBeVisible({ timeout: 5_000 });

  // Confirm button should be disabled until phrase is typed
  const confirmBtn = page.locator('button', { hasText: /confirm delete/i });
  await expect(confirmBtn).toBeDisabled();

  // Type wrong phrase — still disabled
  await page.locator('#pdpa-confirm').fill('wrong-phrase');
  await expect(confirmBtn).toBeDisabled();

  // Type correct phrase — button becomes enabled
  await page.locator('#pdpa-confirm').fill('delete-my-account');
  await expect(confirmBtn).toBeEnabled();

  // Close dialog without confirming
  await page.locator('button', { hasText: /cancel/i }).click();
  await expect(page.locator('#pdpa-confirm')).not.toBeVisible();
});

test('data export API returns ZIP for authenticated user', async ({ page, request }) => {
  await loginAs(page, 'employee@lmscasa.local', 'Employee@12345');

  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('lms-casa.auth.tokens');
    if (!raw) return null;
    return (JSON.parse(raw) as { accessToken: string }).accessToken;
  });

  const res = await request.get('http://localhost:4000/api/v1/me/data-export', {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.ok()).toBeTruthy();
  expect(res.headers()['content-type']).toContain('application/zip');

  const body = await res.body();
  // ZIP magic bytes: PK (0x50 0x4B)
  expect(body[0]).toBe(0x50);
  expect(body[1]).toBe(0x4b);
});
