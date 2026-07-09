/**
 * E2E walkthrough — runs only under the `walkthrough` project (headed + slowMo).
 * Opens every major page in sequence so a human can watch the system work.
 *
 * Run with:
 *   npm run e2e:walkthrough           # logs in as admin and walks the system
 *   npm run e2e:walkthrough -- --headed=false   # also works headless (CI sanity)
 */
import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@lmscasa.local', password: 'Admin@12345' };
const EMPLOYEE = { email: 'employee@lmscasa.local', password: 'Employee@12345' };

test.describe.configure({ mode: 'serial' });

function step(label: string) {
  // eslint-disable-next-line no-console
  console.log(`\n  ▸ ${label}`);
}

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.locator('#identifier').fill(who.email);
  await page.locator('#password').fill(who.password);
  await Promise.all([
    page.waitForURL(/\/dashboard$/, { timeout: 20_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

async function logout(page: Page) {
  const logoutBtn = page.getByRole('button', { name: /logout|ออกจากระบบ/i }).first();
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
    await page.waitForURL(/\/login$/, { timeout: 10_000 }).catch(() => undefined);
  }
}

test.beforeAll(async ({ request }) => {
  const health = await request.get('http://localhost:4000/health');
  expect(health.ok(), 'backend /health must be 200 — start `npm run dev` in lms-system/server').toBe(true);
});

test('full system walkthrough — admin perspective', async ({ page }) => {
  test.setTimeout(180_000);

  step('1. Login page');
  await page.goto('/login');
  await expect(page.locator('#identifier')).toBeVisible({ timeout: 10_000 });

  step('2. Login as admin');
  await login(page, ADMIN);

  step('3. Dashboard — XP banner + stats cards');
  await page.goto('/dashboard');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();

  step('4. Courses list — duration / instructor / lessons / enrollment');
  await page.goto('/courses');
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('5. Open first course detail (if any)');
  const firstCourseLink = page.locator('a[href^="/courses/"]').first();
  if (await firstCourseLink.isVisible().catch(() => false)) {
    await firstCourseLink.click();
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  } else {
    step('   (no course seed data — skipped)');
  }

  step('6. Exams list');
  await page.goto('/exams');
  await expect(page).toHaveURL(/\/exams$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('7. Leaderboard — XP summary + tabs');
  await page.goto('/leaderboard');
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  const orgTab = page.getByRole('tab', { name: /ทั้งองค์กร|Organization/i });
  const deptTab = page.getByRole('tab', { name: /แผนกของฉัน|department/i });
  if (await orgTab.isVisible().catch(() => false)) {
    await orgTab.click();
  }
  if (await deptTab.isVisible().catch(() => false)) {
    await deptTab.click();
  }

  step('8. Attempt history');
  await page.goto('/attempts');
  await expect(page).toHaveURL(/\/attempts$/);

  step('9. Privacy / PDPA page');
  await page.goto('/me/privacy');
  await expect(page).toHaveURL(/\/me\/privacy$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('10. Admin — Organization stats');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('11. Admin — Audit logs');
  await page.goto('/admin/audit');
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('12. Admin — Settings (branding)');
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('13. Admin — Question bank');
  await page.goto('/admin/questions');
  await expect(page).toHaveURL(/\/admin\/questions$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('14. Admin — Exam builder list');
  await page.goto('/admin/exams');
  await expect(page).toHaveURL(/\/admin\/exams$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('15. Users management');
  await page.goto('/users');
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('16. Logout admin');
  await logout(page);
});

test('employee perspective — learning + ranking', async ({ page }) => {
  test.setTimeout(120_000);

  step('1. Login as employee');
  await login(page, EMPLOYEE);

  step('2. Dashboard — XP banner shows current rank');
  await page.goto('/dashboard');
  const xpBanner = page.locator('a[href="/leaderboard"]').first();
  await expect(xpBanner).toBeVisible({ timeout: 10_000 });

  step('3. Click XP banner → leaderboard');
  await xpBanner.click();
  await expect(page).toHaveURL(/\/leaderboard$/);

  step('4. Browse courses as employee');
  await page.goto('/courses');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('5. Browse exams as employee');
  await page.goto('/exams');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('6. Privacy page (PDPA self-service)');
  await page.goto('/me/privacy');
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

  step('7. Logout employee');
  await logout(page);
});

test('unauthenticated redirect — protected route should bounce to /login', async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }).catch(() => undefined);
  await page.context().clearCookies();
  step('Visit /dashboard without auth');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
});
