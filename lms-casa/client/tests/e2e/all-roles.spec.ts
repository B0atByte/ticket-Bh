/**
 * E2E — full role × permission matrix.
 *
 * For each of the 5 seed roles (SUPER_ADMIN, HR, MANAGER, INSTRUCTOR, EMPLOYEE):
 *   1. Login via UI → verify /dashboard loads
 *   2. Capture access token
 *   3. Probe every major API endpoint → assert HTTP status matches the role's permissions
 *   4. Navigate every major UI route → assert no crash
 *
 * Roles + expected statuses are encoded in `MATRIX` below. Run:
 *   cd lms-system/client && npm run e2e:all-roles
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:4000';
const STAMP = Date.now();
const PREFIX = `[E2E-ROLE ${STAMP}]`;

type Role = 'SUPER_ADMIN' | 'HR' | 'MANAGER' | 'INSTRUCTOR' | 'EMPLOYEE';

interface RoleUser {
  role: Role;
  email: string;
  password: string;
}

const ROLES: RoleUser[] = [
  { role: 'SUPER_ADMIN', email: 'admin@lmscasa.local', password: 'Admin@12345' },
  { role: 'HR', email: 'hr@lmscasa.local', password: 'Hr@12345' },
  { role: 'MANAGER', email: 'manager@lmscasa.local', password: 'Manager@12345' },
  { role: 'INSTRUCTOR', email: 'instructor@lmscasa.local', password: 'Instructor@12345' },
  { role: 'EMPLOYEE', email: 'employee@lmscasa.local', password: 'Employee@12345' },
];

// Status matrix: 2 = OK family (200/201/204), 4 = Forbidden (403)
type Expected = 'OK' | 'FORBIDDEN';

interface ApiProbe {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: () => unknown;
  expect: Record<Role, Expected>;
  /** If POST returns an id we should remember (for cleanup) */
  capture?: 'course' | 'exam' | 'question';
}

const PROBES: ApiProbe[] = [
  // ─ Reads (most roles allowed) ─
  {
    label: 'GET /auth/me',
    method: 'GET',
    path: '/api/v1/auth/me',
    expect: { SUPER_ADMIN: 'OK', HR: 'OK', MANAGER: 'OK', INSTRUCTOR: 'OK', EMPLOYEE: 'OK' },
  },
  {
    label: 'GET /courses',
    method: 'GET',
    path: '/api/v1/courses',
    expect: { SUPER_ADMIN: 'OK', HR: 'OK', MANAGER: 'OK', INSTRUCTOR: 'OK', EMPLOYEE: 'OK' },
  },
  {
    label: 'GET /exams',
    method: 'GET',
    path: '/api/v1/exams',
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'FORBIDDEN',
      MANAGER: 'FORBIDDEN',
      INSTRUCTOR: 'OK',
      EMPLOYEE: 'OK',
    },
  },
  {
    label: 'GET /points/me',
    method: 'GET',
    path: '/api/v1/points/me',
    expect: { SUPER_ADMIN: 'OK', HR: 'OK', MANAGER: 'OK', INSTRUCTOR: 'OK', EMPLOYEE: 'OK' },
  },
  {
    label: 'GET /points/leaderboard',
    method: 'GET',
    path: '/api/v1/points/leaderboard?scope=org',
    expect: { SUPER_ADMIN: 'OK', HR: 'OK', MANAGER: 'OK', INSTRUCTOR: 'OK', EMPLOYEE: 'OK' },
  },
  {
    label: 'GET /users',
    method: 'GET',
    path: '/api/v1/users',
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'OK',
      MANAGER: 'OK',
      INSTRUCTOR: 'FORBIDDEN',
      EMPLOYEE: 'FORBIDDEN',
    },
  },
  {
    label: 'GET /audit-logs',
    method: 'GET',
    path: '/api/v1/audit-logs',
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'FORBIDDEN',
      MANAGER: 'FORBIDDEN',
      INSTRUCTOR: 'FORBIDDEN',
      EMPLOYEE: 'FORBIDDEN',
    },
  },
  {
    label: 'GET /stats/admin',
    method: 'GET',
    path: '/api/v1/stats/admin',
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'OK',
      MANAGER: 'OK',
      INSTRUCTOR: 'FORBIDDEN',
      EMPLOYEE: 'FORBIDDEN',
    },
  },
  // ─ Writes (only specific roles allowed) ─
  {
    label: 'POST /courses (create)',
    method: 'POST',
    path: '/api/v1/courses',
    body: () => ({
      title: `${PREFIX} course`,
      slug: `e2e-role-course-${STAMP}-${Math.random().toString(36).slice(2, 8)}`,
      visibility: 'INTERNAL',
    }),
    capture: 'course',
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'FORBIDDEN',
      MANAGER: 'FORBIDDEN',
      INSTRUCTOR: 'OK',
      EMPLOYEE: 'FORBIDDEN',
    },
  },
  {
    label: 'POST /exams (create)',
    method: 'POST',
    path: '/api/v1/exams',
    body: () => ({
      title: `${PREFIX} exam ${Math.random().toString(36).slice(2, 6)}`,
      passingScore: 50,
    }),
    capture: 'exam',
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'FORBIDDEN',
      MANAGER: 'FORBIDDEN',
      INSTRUCTOR: 'OK',
      EMPLOYEE: 'FORBIDDEN',
    },
  },
  {
    label: 'POST /questions (create)',
    method: 'POST',
    path: '/api/v1/questions',
    body: () => ({
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      text: `${PREFIX} q ${Math.random().toString(36).slice(2, 6)}`,
      defaultPoints: 1,
      options: [
        { text: 'A', isCorrect: true, orderIndex: 0 },
        { text: 'B', isCorrect: false, orderIndex: 1 },
      ],
    }),
    capture: 'question',
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'FORBIDDEN',
      MANAGER: 'FORBIDDEN',
      INSTRUCTOR: 'OK',
      EMPLOYEE: 'FORBIDDEN',
    },
  },
  {
    label: 'PUT /settings/branding (admin only)',
    method: 'PUT',
    path: '/api/v1/settings/branding',
    body: () => ({ name: `${PREFIX} brand`, primaryColor: '#2563eb' }),
    expect: {
      SUPER_ADMIN: 'OK',
      HR: 'FORBIDDEN',
      MANAGER: 'FORBIDDEN',
      INSTRUCTOR: 'FORBIDDEN',
      EMPLOYEE: 'FORBIDDEN',
    },
  },
];

const UI_ROUTES = ['/dashboard', '/courses', '/exams', '/leaderboard', '/me/privacy'];

const created = {
  courses: [] as string[],
  exams: [] as string[],
  questions: [] as string[],
};
let superAdminToken: string | null = null;

function step(label: string) {
  // eslint-disable-next-line no-console
  console.log(`    ▸ ${label}`);
}

async function loginUI(page: Page, who: RoleUser): Promise<string> {
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
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('lms-casa.auth.tokens');
    return raw ? (JSON.parse(raw) as { accessToken: string }).accessToken : null;
  });
  expect(token, `token for ${who.role}`).toBeTruthy();
  return token!;
}

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

function isForbidden(status: number): boolean {
  return status === 403;
}

function describeStatus(s: number): string {
  if (isOk(s)) return `OK (${s})`;
  if (isForbidden(s)) return `FORBIDDEN (${s})`;
  return `OTHER (${s})`;
}

async function captureFromBody(probe: ApiProbe, request: APIRequestContext, res: import('@playwright/test').APIResponse) {
  if (!probe.capture || !isOk(res.status())) return;
  try {
    const body = (await res.json()) as Record<string, { id?: string }>;
    const id = body[probe.capture]?.id;
    if (id) created[`${probe.capture}s` as 'courses' | 'exams' | 'questions'].push(String(id));
  } catch {
    // ignore non-JSON
  }
}

test.beforeAll(async ({ request }) => {
  const health = await request.get(`${API_BASE}/health`);
  expect(health.ok(), 'backend /health — restart server if 429').toBe(true);
});

test.afterAll(async ({ request }) => {
  // Cleanup using super-admin token (captured from the first role test)
  if (!superAdminToken) {
    try {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { identifier: ROLES[0]!.email, password: ROLES[0]!.password },
      });
      if (res.ok()) {
        superAdminToken = ((await res.json()) as { tokens: { accessToken: string } }).tokens
          .accessToken;
      }
    } catch {
      // best-effort
    }
  }
  if (!superAdminToken) return;
  const headers = { Authorization: `Bearer ${superAdminToken}` };
  for (const id of created.exams) {
    await request.delete(`${API_BASE}/api/v1/exams/${id}`, { headers }).catch(() => undefined);
  }
  for (const id of created.questions) {
    await request.delete(`${API_BASE}/api/v1/questions/${id}`, { headers }).catch(() => undefined);
  }
  for (const id of created.courses) {
    await request.delete(`${API_BASE}/api/v1/courses/${id}`, { headers }).catch(() => undefined);
  }
});

for (const user of ROLES) {
  test(`${user.role} — login + UI routes + API permission matrix`, async ({ page, request }) => {
    test.setTimeout(90_000);

    step(`Login UI as ${user.email}`);
    const token = await loginUI(page, user);
    if (user.role === 'SUPER_ADMIN') superAdminToken = token;
    const headers = { Authorization: `Bearer ${token}` };

    step('Visit every main UI route (no crash check)');
    for (const route of UI_ROUTES) {
      await page.goto(route);
      await expect(page.locator('main, [role="main"]').first()).toBeVisible({
        timeout: 10_000,
      });
    }

    step('Run API permission matrix');
    const failures: string[] = [];
    for (const probe of PROBES) {
      const expected = probe.expect[user.role];
      const opts: { headers: Record<string, string>; data?: unknown } = {
        headers: { ...headers },
      };
      if (probe.body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.data = probe.body();
      }
      let res: import('@playwright/test').APIResponse;
      switch (probe.method) {
        case 'GET':
          res = await request.get(`${API_BASE}${probe.path}`, opts);
          break;
        case 'POST':
          res = await request.post(`${API_BASE}${probe.path}`, opts);
          break;
        case 'PUT':
          res = await request.put(`${API_BASE}${probe.path}`, opts);
          break;
        case 'DELETE':
          res = await request.delete(`${API_BASE}${probe.path}`, opts);
          break;
      }
      const status = res.status();
      const actual: Expected | 'OTHER' = isOk(status)
        ? 'OK'
        : isForbidden(status)
          ? 'FORBIDDEN'
          : 'OTHER';
      const pass = actual === expected;
      const symbol = pass ? '✓' : '✗';
      // eslint-disable-next-line no-console
      console.log(`      ${symbol} ${probe.label} → ${describeStatus(status)} (expect ${expected})`);
      if (!pass) {
        failures.push(`${probe.label}: expected ${expected}, got ${describeStatus(status)}`);
      }
      await captureFromBody(probe, request, res);
    }

    expect(failures, `permission matrix mismatches for ${user.role}:\n  - ${failures.join('\n  - ')}`).toEqual([]);
  });
}
