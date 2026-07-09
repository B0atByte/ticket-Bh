import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.locator('#identifier').fill('admin@lmscasa.local');
  await page.locator('#password').fill('Admin@12345');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function expectNoCriticalAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const seriousViolations = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious',
  );

  expect(seriousViolations).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  const health = await request.get('http://localhost:4000/health');
  expect(health.ok()).toBeTruthy();
});

test('login page has no serious axe violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('main')).toBeVisible();
  await expectNoCriticalAxeViolations(page);
});

test('dashboard has no serious axe violations', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  await expectNoCriticalAxeViolations(page);
});

test('admin page has no serious axe violations', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  await expectNoCriticalAxeViolations(page);
});
