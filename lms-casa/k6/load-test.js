/**
 * k6 Load Test — LMS Casa
 *
 * Target: 500 concurrent virtual users, p95 < 500ms, error rate < 1%
 *
 * Run:
 *   k6 run k6/load-test.js
 *   k6 run --vus 500 --duration 60s k6/load-test.js
 *
 * Requires k6 installed: https://k6.io/docs/getting-started/installation/
 * Requires backend running: http://localhost:4000
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── custom metrics ───────────────────────────────────────────────────────────

const errorRate = new Rate('error_rate');
const loginDuration = new Trend('login_duration', true);
const courseListDuration = new Trend('course_list_duration', true);
const examListDuration = new Trend('exam_list_duration', true);
const dashboardDuration = new Trend('dashboard_duration', true);

// ─── test config ──────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Ramp up to 500 VUs over 30s, hold for 60s, ramp down 30s
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '30s', target: 300 },
        { duration: '30s', target: 500 },
        { duration: '60s', target: 500 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    // p95 response time < 500ms (per brief)
    http_req_duration: ['p(95)<500'],
    // Error rate < 1%
    error_rate: ['rate<0.01'],
    // Login specifically < 1s p95
    login_duration: ['p(95)<1000'],
    // Course list < 500ms p95
    course_list_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Seed users from prisma/seed.ts — rotate across VUs to spread load
const TEST_USERS = [
  { identifier: 'admin@lmscasa.local', password: 'Admin@12345' },
  { identifier: 'hr@lmscasa.local', password: 'Hr@12345' },
  { identifier: 'manager@lmscasa.local', password: 'Manager@12345' },
  { identifier: 'instructor@lmscasa.local', password: 'Instructor@12345' },
  { identifier: 'employee@lmscasa.local', password: 'Employee@12345' },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function pickUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ─── main scenario ────────────────────────────────────────────────────────────

export default function () {
  const user = pickUser();

  // ── 1. Health check ──────────────────────────────────────────────────────
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  sleep(0.1);

  // ── 2. Login ─────────────────────────────────────────────────────────────
  let accessToken = null;

  group('auth/login', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ identifier: user.identifier, password: user.password }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    loginDuration.add(Date.now() - start);

    const ok = check(res, {
      'login 200': (r) => r.status === 200,
      'login has accessToken': (r) => {
        try {
          return !!JSON.parse(r.body).tokens?.accessToken;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!ok);

    if (res.status === 200) {
      try {
        accessToken = JSON.parse(res.body).tokens.accessToken;
      } catch {
        // ignore parse error
      }
    }
  });

  if (!accessToken) {
    sleep(1);
    return;
  }

  const headers = authHeaders(accessToken);
  sleep(0.2);

  // ── 3. Get current user ──────────────────────────────────────────────────
  group('auth/me', () => {
    const res = http.get(`${BASE_URL}/api/v1/auth/me`, { headers });
    const ok = check(res, { 'me 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.2);

  // ── 4. Personal stats (dashboard) ────────────────────────────────────────
  group('stats/me', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/stats/me`, { headers });
    dashboardDuration.add(Date.now() - start);
    const ok = check(res, { 'stats/me 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.3);

  // ── 5. Course list ────────────────────────────────────────────────────────
  let firstCourseId = null;

  group('courses/list', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/courses?pageSize=10`, { headers });
    courseListDuration.add(Date.now() - start);

    const ok = check(res, {
      'courses 200': (r) => r.status === 200,
      'courses has items': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).items);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);

    if (res.status === 200) {
      try {
        const items = JSON.parse(res.body).items;
        if (items && items.length > 0) firstCourseId = items[0].id;
      } catch {
        // ignore
      }
    }
  });

  sleep(0.3);

  // ── 6. Course detail (if available) ──────────────────────────────────────
  if (firstCourseId) {
    group('courses/detail', () => {
      const res = http.get(`${BASE_URL}/api/v1/courses/${firstCourseId}`, { headers });
      const ok = check(res, { 'course detail 200': (r) => r.status === 200 });
      errorRate.add(!ok);
    });
    sleep(0.2);
  }

  // ── 7. Exam list ──────────────────────────────────────────────────────────
  group('exams/list', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/exams?pageSize=10`, { headers });
    examListDuration.add(Date.now() - start);
    const ok = check(res, { 'exams 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.3);

  // ── 8. Notifications ─────────────────────────────────────────────────────
  group('notifications/list', () => {
    const res = http.get(`${BASE_URL}/api/v1/notifications?pageSize=10`, { headers });
    const ok = check(res, { 'notifications 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.5);
}
