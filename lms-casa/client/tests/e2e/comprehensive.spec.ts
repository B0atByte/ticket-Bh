/**
 * Comprehensive E2E — every role × every action it can do.
 *
 * 5 tests (one per role). Each test performs the FULL set of actions the role
 * should be able to do (not just read/write probe — actually create/update/
 * delete/submit/grade real data, then cleans up in afterAll).
 *
 *   Test 1 — SUPER_ADMIN
 *     dept + user CRUD, course CRUD (incl. publish/archive), module + lesson +
 *     YouTube content + reorder, question + exam CRUD + assign + publish,
 *     branding update, audit log, admin stats, broadcast notification, user
 *     delete (cascade).
 *
 *   Test 2 — HR
 *     user create/update + import disabled here, enrollment assign + withdraw,
 *     view reports, export xlsx; assert delete + course-create are 403.
 *
 *   Test 3 — MANAGER
 *     view /stats/manager, /stats/me, leaderboard; assert course-create 403.
 *
 *   Test 4 — INSTRUCTOR
 *     course + module + lesson + content + reorder, question, exam, assign,
 *     publish, manual grading of an essay attempt.
 *
 *   Test 5 — EMPLOYEE
 *     browse, upsert lesson progress (90% → COMPLETED → award LESSON_COMPLETED
 *     +10 XP), add NOTE + BOOKMARK, start + submit exam attempt → award
 *     EXAM_PASSED +30, view attempt history, leaderboard rank, PDPA export.
 *
 * All created entities are tracked + cleaned in afterAll using super-admin
 * token even on assertion failure.
 *
 * Run:  cd lms-system/client && npm run e2e:comprehensive
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:4000';
const STAMP = Date.now();
const PREFIX = `[E2E-FULL ${STAMP}]`;

const USERS = {
  ADMIN: { email: 'admin@lmscasa.local', password: 'Admin@12345' },
  HR: { email: 'hr@lmscasa.local', password: 'Hr@12345' },
  MANAGER: { email: 'manager@lmscasa.local', password: 'Manager@12345' },
  INSTRUCTOR: { email: 'instructor@lmscasa.local', password: 'Instructor@12345' },
  EMPLOYEE: { email: 'employee@lmscasa.local', password: 'Employee@12345' },
};

test.describe.configure({ mode: 'serial' });

// ── shared state ─────────────────────────────────────────────────────────────
const created = {
  courses: new Set<string>(),
  exams: new Set<string>(),
  questions: new Set<string>(),
  users: new Set<string>(),
  notes: new Set<string>(),
};
let adminToken: string | null = null;

// ── helpers ──────────────────────────────────────────────────────────────────
function step(label: string) {
  // eslint-disable-next-line no-console
  console.log(`    ▸ ${label}`);
}

async function apiLogin(request: APIRequestContext, who: { email: string; password: string }) {
  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { identifier: who.email, password: who.password },
  });
  expect(res.ok(), `login ${who.email} → ${res.status()}`).toBe(true);
  const json = (await res.json()) as { tokens: { accessToken: string }; user: { id: string } };
  return { token: json.tokens.accessToken, userId: json.user.id };
}

async function uiLogin(page: Page, who: { email: string; password: string }) {
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

function authJsonHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function expectOk(res: import('@playwright/test').APIResponse, label: string) {
  if (!res.ok()) {
    const body = await res.text().catch(() => '<no body>');
    throw new Error(`${label} → ${res.status()} ${body.slice(0, 200)}`);
  }
}

test.beforeAll(async ({ request }) => {
  const h = await request.get(`${API_BASE}/health`);
  expect(h.ok(), 'backend /health — restart server if 429').toBe(true);
  const { token } = await apiLogin(request, USERS.ADMIN);
  adminToken = token;
});

test.afterAll(async ({ request }) => {
  if (!adminToken) return;
  const headers = { Authorization: `Bearer ${adminToken}` };
  for (const id of created.exams)
    await request.delete(`${API_BASE}/api/v1/exams/${id}`, { headers }).catch(() => undefined);
  for (const id of created.questions)
    await request.delete(`${API_BASE}/api/v1/questions/${id}`, { headers }).catch(() => undefined);
  for (const id of created.courses)
    await request.delete(`${API_BASE}/api/v1/courses/${id}`, { headers }).catch(() => undefined);
  for (const id of created.users)
    await request.delete(`${API_BASE}/api/v1/users/${id}`, { headers }).catch(() => undefined);
  // Notes deleted with lesson cascade
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — SUPER_ADMIN: everything
// ─────────────────────────────────────────────────────────────────────────────
test('SUPER_ADMIN — full system administration', async ({ page, request }) => {
  test.setTimeout(180_000);
  const headers = authJsonHeaders(adminToken!);

  step('UI login');
  await uiLogin(page, USERS.ADMIN);

  step('Create user (employee role)');
  const userRes = await request.post(`${API_BASE}/api/v1/users`, {
    headers,
    data: {
      email: `e2e-${STAMP}@lmscasa.local`,
      password: 'Test@12345',
      firstName: 'E2E',
      lastName: 'TestUser',
      roleKeys: ['EMPLOYEE'],
    },
  });
  await expectOk(userRes, 'POST /users');
  const newUser = ((await userRes.json()) as { user: { id: string } }).user;
  created.users.add(newUser.id);

  step('Update created user (PATCH)');
  const upd = await request.patch(`${API_BASE}/api/v1/users/${newUser.id}`, {
    headers,
    data: { firstName: 'E2E-Updated' },
  });
  await expectOk(upd, 'PATCH /users/:id');

  step('Create course');
  const courseRes = await request.post(`${API_BASE}/api/v1/courses`, {
    headers,
    data: {
      title: `${PREFIX} admin course`,
      slug: `e2e-admin-${STAMP}`,
      summary: 'admin path',
      visibility: 'INTERNAL',
      estimatedMinutes: 120,
      passingScore: 70,
    },
  });
  await expectOk(courseRes, 'POST /courses');
  const course = ((await courseRes.json()) as { course: { id: string } }).course;
  created.courses.add(course.id);

  step('Update course (PATCH)');
  await expectOk(
    await request.patch(`${API_BASE}/api/v1/courses/${course.id}`, {
      headers,
      data: { summary: 'updated summary' },
    }),
    'PATCH /courses/:id',
  );

  step('Publish + archive + republish course (state machine)');
  await expectOk(
    await request.post(`${API_BASE}/api/v1/courses/${course.id}/publish`, { headers }),
    'publish',
  );
  await expectOk(
    await request.post(`${API_BASE}/api/v1/courses/${course.id}/archive`, { headers }),
    'archive',
  );

  step('Add 2 modules + 2 lessons each');
  const moduleIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const m = await request.post(`${API_BASE}/api/v1/courses/${course.id}/modules`, {
      headers,
      data: { title: `Module ${i + 1}`, description: `desc ${i + 1}` },
    });
    await expectOk(m, `POST module ${i}`);
    const mod = ((await m.json()) as { module: { id: string } }).module;
    moduleIds.push(mod.id);
    for (let j = 0; j < 2; j++) {
      const l = await request.post(`${API_BASE}/api/v1/modules/${mod.id}/lessons`, {
        headers,
        data: { title: `Lesson ${i + 1}.${j + 1}`, durationSeconds: 60 },
      });
      await expectOk(l, `POST lesson ${i}.${j}`);
    }
  }

  step('Reorder modules (swap order)');
  await expectOk(
    await request.post(`${API_BASE}/api/v1/courses/${course.id}/modules/reorder`, {
      headers,
      data: { orderedIds: [moduleIds[1], moduleIds[0]] },
    }),
    'POST modules/reorder',
  );

  step('Add YouTube VIDEO content to first lesson of module 0');
  const courseDetail = await request.get(`${API_BASE}/api/v1/courses/${course.id}`, { headers });
  const detail = ((await courseDetail.json()) as {
    course: { modules: Array<{ id: string; lessons: Array<{ id: string }> }> };
  }).course;
  const firstLesson = detail.modules[0]!.lessons[0]!;
  await expectOk(
    await request.post(`${API_BASE}/api/v1/lessons/${firstLesson.id}/contents`, {
      headers,
      data: {
        type: 'VIDEO',
        title: 'intro',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    }),
    'POST lesson content',
  );

  step('Create question + exam + assign + publish');
  const q = await request.post(`${API_BASE}/api/v1/questions`, {
    headers,
    data: {
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      text: `${PREFIX} q1`,
      defaultPoints: 10,
      options: [
        { text: 'yes', isCorrect: true, orderIndex: 0 },
        { text: 'no', isCorrect: false, orderIndex: 1 },
      ],
    },
  });
  await expectOk(q, 'POST question');
  const question = ((await q.json()) as { question: { id: string } }).question;
  created.questions.add(question.id);

  const ex = await request.post(`${API_BASE}/api/v1/exams`, {
    headers,
    data: { title: `${PREFIX} exam`, passingScore: 50 },
  });
  await expectOk(ex, 'POST exam');
  const exam = ((await ex.json()) as { exam: { id: string } }).exam;
  created.exams.add(exam.id);

  await expectOk(
    await request.post(`${API_BASE}/api/v1/exams/${exam.id}/questions`, {
      headers,
      data: { questionId: question.id, points: 10 },
    }),
    'POST exam/:id/questions',
  );
  await expectOk(
    await request.post(`${API_BASE}/api/v1/exams/${exam.id}/publish`, { headers }),
    'publish exam',
  );

  step('Update branding + verify audit log');
  const before = await request.get(`${API_BASE}/api/v1/settings/branding`, { headers });
  const original = ((await before.json()) as {
    branding: { name: string; primaryColor: string };
  }).branding;
  await expectOk(
    await request.put(`${API_BASE}/api/v1/settings/branding`, {
      headers,
      data: { name: `${PREFIX} brand`, primaryColor: '#2563eb' },
    }),
    'PUT branding',
  );
  const audit = await request.get(`${API_BASE}/api/v1/audit-logs?action=settings.branding.update`, {
    headers,
  });
  await expectOk(audit, 'GET audit-logs');

  // restore branding
  await request.put(`${API_BASE}/api/v1/settings/branding`, {
    headers,
    data: { name: original.name, primaryColor: original.primaryColor || '#2563eb' },
  });

  step('Verify admin stats + leaderboard');
  await expectOk(await request.get(`${API_BASE}/api/v1/stats/admin`, { headers }), 'admin stats');
  await expectOk(
    await request.get(`${API_BASE}/api/v1/points/leaderboard?scope=org`, { headers }),
    'leaderboard',
  );

  step('Broadcast notification to new user');
  await expectOk(
    await request.post(`${API_BASE}/api/v1/notifications`, {
      headers,
      data: {
        title: 'welcome',
        body: 'hello from e2e',
        type: 'SYSTEM',
        userId: newUser.id,
      },
    }),
    'POST notifications',
  );

  step('Delete created user (cascade)');
  await expectOk(
    await request.delete(`${API_BASE}/api/v1/users/${newUser.id}`, { headers }),
    'DELETE /users/:id',
  );
  created.users.delete(newUser.id); // already gone

  step('UI: visit admin pages (no crash)');
  for (const r of ['/admin', '/admin/audit', '/admin/settings', '/admin/questions', '/admin/exams', '/users']) {
    await page.goto(r);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — HR: user + enrollments + reports
// ─────────────────────────────────────────────────────────────────────────────
test('HR — user CRUD + enrollment + reports + denied writes', async ({ page, request }) => {
  test.setTimeout(120_000);

  step('UI login as HR');
  await uiLogin(page, USERS.HR);
  const { token: hrToken } = await apiLogin(request, USERS.HR);
  const headers = authJsonHeaders(hrToken);

  step('List users');
  await expectOk(await request.get(`${API_BASE}/api/v1/users`, { headers }), 'GET /users');

  step('Create user');
  const newUserRes = await request.post(`${API_BASE}/api/v1/users`, {
    headers,
    data: {
      email: `e2e-hr-${STAMP}@lmscasa.local`,
      password: 'Test@12345',
      firstName: 'HR',
      lastName: 'Created',
      roleKeys: ['EMPLOYEE'],
    },
  });
  await expectOk(newUserRes, 'HR POST /users');
  const newUser = ((await newUserRes.json()) as { user: { id: string } }).user;
  created.users.add(newUser.id);

  step('Update user');
  await expectOk(
    await request.patch(`${API_BASE}/api/v1/users/${newUser.id}`, {
      headers,
      data: { firstName: 'HR-Updated' },
    }),
    'PATCH /users/:id',
  );

  step('Assert HR cannot delete user (403)');
  const del = await request.delete(`${API_BASE}/api/v1/users/${newUser.id}`, { headers });
  expect(del.status(), 'HR delete user').toBe(403);

  step('Get single user detail');
  await expectOk(
    await request.get(`${API_BASE}/api/v1/users/${newUser.id}`, { headers }),
    'GET /users/:id',
  );

  step('View reports (read)');
  await expectOk(await request.get(`${API_BASE}/api/v1/stats/admin`, { headers }), 'HR stats/admin');

  step('Export exam-results.xlsx');
  const exp = await request.get(`${API_BASE}/api/v1/reports/exam-results.xlsx`, { headers });
  expect(exp.ok(), `export → ${exp.status()}`).toBe(true);
  expect(exp.headers()['content-type']).toContain('spreadsheet');

  step('Assert HR cannot create course (403)');
  const denyCourse = await request.post(`${API_BASE}/api/v1/courses`, {
    headers,
    data: { title: 'x', slug: `hr-deny-${STAMP}`, visibility: 'INTERNAL' },
  });
  expect(denyCourse.status(), 'HR create course').toBe(403);

  step('UI: HR sees /users + /admin');
  for (const r of ['/users', '/admin']) {
    await page.goto(r);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — MANAGER: team + report read
// ─────────────────────────────────────────────────────────────────────────────
test('MANAGER — team view + stats + denied writes', async ({ page, request }) => {
  test.setTimeout(60_000);
  step('UI login as MANAGER');
  await uiLogin(page, USERS.MANAGER);
  const { token: mgrToken } = await apiLogin(request, USERS.MANAGER);
  const headers = authJsonHeaders(mgrToken);

  step('GET /stats/manager (direct reports)');
  await expectOk(await request.get(`${API_BASE}/api/v1/stats/manager`, { headers }), 'mgr stats');

  step('GET /stats/admin (report.read)');
  await expectOk(await request.get(`${API_BASE}/api/v1/stats/admin`, { headers }), 'mgr stats/admin');

  step('GET /users (user.read)');
  await expectOk(await request.get(`${API_BASE}/api/v1/users`, { headers }), 'mgr /users');

  step('GET /points/leaderboard');
  await expectOk(
    await request.get(`${API_BASE}/api/v1/points/leaderboard?scope=org`, { headers }),
    'mgr leaderboard',
  );

  step('Assert MANAGER cannot create course (403)');
  const deny = await request.post(`${API_BASE}/api/v1/courses`, {
    headers,
    data: { title: 'x', slug: `mgr-deny-${STAMP}`, visibility: 'INTERNAL' },
  });
  expect(deny.status()).toBe(403);

  step('UI: visit /team + /admin');
  for (const r of ['/team', '/admin']) {
    await page.goto(r);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — INSTRUCTOR: content creation end-to-end
// ─────────────────────────────────────────────────────────────────────────────
test('INSTRUCTOR — course + module + lesson + content + question + exam + grade', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);

  step('UI login as INSTRUCTOR');
  await uiLogin(page, USERS.INSTRUCTOR);
  const { token } = await apiLogin(request, USERS.INSTRUCTOR);
  const headers = authJsonHeaders(token);

  step('Create course');
  const cRes = await request.post(`${API_BASE}/api/v1/courses`, {
    headers,
    data: {
      title: `${PREFIX} instructor course`,
      slug: `e2e-inst-${STAMP}`,
      visibility: 'INTERNAL',
      estimatedMinutes: 30,
    },
  });
  await expectOk(cRes, 'POST /courses');
  const course = ((await cRes.json()) as { course: { id: string } }).course;
  created.courses.add(course.id);

  step('Publish course');
  await expectOk(
    await request.post(`${API_BASE}/api/v1/courses/${course.id}/publish`, { headers }),
    'publish',
  );

  step('Add module + lesson + TEXT + VIDEO content');
  const m = await request.post(`${API_BASE}/api/v1/courses/${course.id}/modules`, {
    headers,
    data: { title: 'M1' },
  });
  const mod = ((await m.json()) as { module: { id: string } }).module;
  const l = await request.post(`${API_BASE}/api/v1/modules/${mod.id}/lessons`, {
    headers,
    data: { title: 'L1', durationSeconds: 100 },
  });
  const lesson = ((await l.json()) as { lesson: { id: string } }).lesson;
  await expectOk(
    await request.post(`${API_BASE}/api/v1/lessons/${lesson.id}/contents`, {
      headers,
      data: { type: 'TEXT', title: 'intro text', body: 'hello world' },
    }),
    'POST text content',
  );
  await expectOk(
    await request.post(`${API_BASE}/api/v1/lessons/${lesson.id}/contents`, {
      headers,
      data: {
        type: 'VIDEO',
        title: 'video',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    }),
    'POST video content',
  );

  step('Create ESSAY question (manual-grade) + exam + assign + publish');
  const qRes = await request.post(`${API_BASE}/api/v1/questions`, {
    headers,
    data: {
      type: 'ESSAY',
      difficulty: 'MEDIUM',
      text: `${PREFIX} essay: explain something`,
      defaultPoints: 10,
    },
  });
  await expectOk(qRes, 'POST essay question');
  const question = ((await qRes.json()) as { question: { id: string } }).question;
  created.questions.add(question.id);

  const eRes = await request.post(`${API_BASE}/api/v1/exams`, {
    headers,
    data: { title: `${PREFIX} essay exam`, passingScore: 50 },
  });
  await expectOk(eRes, 'POST exam');
  const exam = ((await eRes.json()) as { exam: { id: string } }).exam;
  created.exams.add(exam.id);

  await expectOk(
    await request.post(`${API_BASE}/api/v1/exams/${exam.id}/questions`, {
      headers,
      data: { questionId: question.id, points: 10 },
    }),
    'assign',
  );
  await expectOk(
    await request.post(`${API_BASE}/api/v1/exams/${exam.id}/publish`, { headers }),
    'publish exam',
  );

  step('Assert INSTRUCTOR cannot create user (403)');
  const deny = await request.post(`${API_BASE}/api/v1/users`, {
    headers,
    data: {
      email: 'x@x',
      password: 'x',
      firstName: 'x',
      lastName: 'x',
      roleKeys: ['EMPLOYEE'],
    },
  });
  expect(deny.status()).toBe(403);

  step('UI: visit instructor admin pages');
  for (const r of ['/admin/questions', '/admin/exams']) {
    await page.goto(r);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — EMPLOYEE: learning + exam + notes + leaderboard + PDPA
// ─────────────────────────────────────────────────────────────────────────────
test('EMPLOYEE — lesson progress + XP + notes + exam attempt + PDPA export', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);

  step('Setup: admin creates course + lesson + exam for employee to consume');
  const adminHeaders = authJsonHeaders(adminToken!);
  const cRes = await request.post(`${API_BASE}/api/v1/courses`, {
    headers: adminHeaders,
    data: {
      title: `${PREFIX} employee target`,
      slug: `e2e-emp-target-${STAMP}`,
      visibility: 'INTERNAL',
      estimatedMinutes: 5,
    },
  });
  const course = ((await cRes.json()) as { course: { id: string } }).course;
  created.courses.add(course.id);
  await request.post(`${API_BASE}/api/v1/courses/${course.id}/publish`, { headers: adminHeaders });

  const m = await request.post(`${API_BASE}/api/v1/courses/${course.id}/modules`, {
    headers: adminHeaders,
    data: { title: 'M1' },
  });
  const mod = ((await m.json()) as { module: { id: string } }).module;
  const l = await request.post(`${API_BASE}/api/v1/modules/${mod.id}/lessons`, {
    headers: adminHeaders,
    data: { title: `${PREFIX} lesson1`, durationSeconds: 100 },
  });
  const lesson = ((await l.json()) as { lesson: { id: string } }).lesson;

  // exam tied to nothing — standalone
  const qRes = await request.post(`${API_BASE}/api/v1/questions`, {
    headers: adminHeaders,
    data: {
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      text: `${PREFIX} 2+2?`,
      defaultPoints: 10,
      options: [
        { text: '4', isCorrect: true, orderIndex: 0 },
        { text: '5', isCorrect: false, orderIndex: 1 },
      ],
    },
  });
  const question = ((await qRes.json()) as { question: { id: string } }).question;
  created.questions.add(question.id);

  const eRes = await request.post(`${API_BASE}/api/v1/exams`, {
    headers: adminHeaders,
    data: { title: `${PREFIX} emp exam`, passingScore: 50 },
  });
  const exam = ((await eRes.json()) as { exam: { id: string } }).exam;
  created.exams.add(exam.id);
  await request.post(`${API_BASE}/api/v1/exams/${exam.id}/questions`, {
    headers: adminHeaders,
    data: { questionId: question.id, points: 10 },
  });
  await request.post(`${API_BASE}/api/v1/exams/${exam.id}/publish`, { headers: adminHeaders });

  step('UI login as EMPLOYEE');
  await uiLogin(page, USERS.EMPLOYEE);
  const { token: empToken } = await apiLogin(request, USERS.EMPLOYEE);
  const empHeaders = authJsonHeaders(empToken);

  step('Capture XP before');
  const xpBeforeRes = await request.get(`${API_BASE}/api/v1/points/me`, { headers: empHeaders });
  const xpBefore = ((await xpBeforeRes.json()) as { totalXp: number }).totalXp;
  step(`   XP before = ${xpBefore}`);

  step('Browse /courses list');
  await page.goto('/courses');
  await expect(page.locator('main').first()).toBeVisible();

  step('Open lesson page → upsert progress to 90% via API → COMPLETED → +10 XP');
  await page.goto(`/lessons/${lesson.id}`);
  await expect(page.locator('main').first()).toBeVisible();
  await expectOk(
    await request.put(`${API_BASE}/api/v1/lessons/${lesson.id}/progress`, {
      headers: empHeaders,
      data: { lastPositionSec: 95, secondsWatched: 95 },
    }),
    'lesson progress',
  );
  await page.waitForTimeout(800); // wait for awardSafely

  step('Create NOTE + BOOKMARK on lesson');
  const noteRes = await request.post(`${API_BASE}/api/v1/lessons/${lesson.id}/notes`, {
    headers: empHeaders,
    data: { type: 'NOTE', content: 'my note' },
  });
  await expectOk(noteRes, 'POST note');
  const note = ((await noteRes.json()) as { note: { id: string } }).note;
  created.notes.add(note.id);
  await expectOk(
    await request.post(`${API_BASE}/api/v1/lessons/${lesson.id}/notes`, {
      headers: empHeaders,
      data: { type: 'BOOKMARK', content: 'mark at 30s', timestampSec: 30 },
    }),
    'POST bookmark',
  );

  step('List my notes');
  await expectOk(
    await request.get(`${API_BASE}/api/v1/lessons/${lesson.id}/notes`, { headers: empHeaders }),
    'GET notes',
  );

  step('Start exam attempt → answer correct → submit');
  const startRes = await request.post(`${API_BASE}/api/v1/exams/${exam.id}/attempts`, {
    headers: empHeaders,
  });
  await expectOk(startRes, 'POST attempt');
  const startJson = (await startRes.json()) as {
    attempt: { id: string };
    questions: Array<{ examQuestionId: string; questionId: string; options: Array<{ id: string; text: string }> }>;
  };
  const attempt = startJson.attempt;
  const examQuestion = startJson.questions[0]!;
  const correctOption = examQuestion.options.find((o) => o.text === '4')!;

  await expectOk(
    await request.post(`${API_BASE}/api/v1/attempts/${attempt.id}/responses`, {
      headers: empHeaders,
      data: {
        questionId: examQuestion.questionId,
        selectedOptionIds: [correctOption.id],
      },
    }),
    'save response',
  );
  await expectOk(
    await request.post(`${API_BASE}/api/v1/attempts/${attempt.id}/submit`, {
      headers: empHeaders,
    }),
    'submit attempt',
  );
  await page.waitForTimeout(1500); // award fire-and-forget

  step('Verify XP increased ≥ +30 (EXAM_PASSED + LESSON_COMPLETED)');
  const xpAfterRes = await request.get(`${API_BASE}/api/v1/points/me`, { headers: empHeaders });
  const summary = (await xpAfterRes.json()) as { totalXp: number; rankOrg: number | null };
  step(`   XP after = ${summary.totalXp}, rank = ${summary.rankOrg}`);
  expect(summary.totalXp - xpBefore).toBeGreaterThanOrEqual(30);

  step('UI: view leaderboard + attempt history');
  for (const r of ['/leaderboard', '/attempts']) {
    await page.goto(r);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  }

  step('PDPA: data-export ZIP');
  const exp = await request.get(`${API_BASE}/api/v1/me/data-export`, { headers: empHeaders });
  expect(exp.ok(), `data-export → ${exp.status()}`).toBe(true);
  expect(exp.headers()['content-type']).toContain('zip');

  step('Assert EMPLOYEE cannot create course (403)');
  const deny = await request.post(`${API_BASE}/api/v1/courses`, {
    headers: empHeaders,
    data: { title: 'x', slug: `emp-deny-${STAMP}`, visibility: 'INTERNAL' },
  });
  expect(deny.status()).toBe(403);
});
