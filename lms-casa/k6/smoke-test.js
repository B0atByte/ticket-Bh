/**
 * k6 Smoke Test — LMS Casa
 *
 * Quick sanity check: 1 VU, 1 iteration — verifies all critical endpoints respond correctly.
 * Run before load test to confirm the system is up.
 *
 * Run:
 *   k6 run k6/smoke-test.js
 */

import http from 'k6/http';
import { check, group } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  // ── Health ────────────────────────────────────────────────────────────────
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  let accessToken = null;

  group('login', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ identifier: 'admin@lmscasa.local', password: 'Admin@12345' }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    check(res, {
      'login 200': (r) => r.status === 200,
      'has accessToken': (r) => {
        try { return !!JSON.parse(r.body).tokens?.accessToken; } catch { return false; }
      },
      'has refreshToken': (r) => {
        try { return !!JSON.parse(r.body).tokens?.refreshToken; } catch { return false; }
      },
      'user has roles': (r) => {
        try { return Array.isArray(JSON.parse(r.body).user?.roles); } catch { return false; }
      },
    });

    if (res.status === 200) {
      try { accessToken = JSON.parse(res.body).tokens.accessToken; } catch { /* ignore */ }
    }
  });

  if (!accessToken) return;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // ── Auth/me ───────────────────────────────────────────────────────────────
  group('auth/me', () => {
    const res = http.get(`${BASE_URL}/api/v1/auth/me`, { headers });
    check(res, {
      'me 200': (r) => r.status === 200,
      'me has email': (r) => {
        try { return !!JSON.parse(r.body).user?.email; } catch { return false; }
      },
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  group('stats/me', () => {
    const res = http.get(`${BASE_URL}/api/v1/stats/me`, { headers });
    check(res, { 'stats/me 200': (r) => r.status === 200 });
  });

  group('stats/admin', () => {
    const res = http.get(`${BASE_URL}/api/v1/stats/admin`, { headers });
    check(res, { 'stats/admin 200': (r) => r.status === 200 });
  });

  // ── Courses ───────────────────────────────────────────────────────────────
  group('courses', () => {
    const res = http.get(`${BASE_URL}/api/v1/courses?pageSize=5`, { headers });
    check(res, {
      'courses 200': (r) => r.status === 200,
      'courses has items array': (r) => {
        try { return Array.isArray(JSON.parse(r.body).items); } catch { return false; }
      },
    });
  });

  // ── Exams ─────────────────────────────────────────────────────────────────
  group('exams', () => {
    const res = http.get(`${BASE_URL}/api/v1/exams?pageSize=5`, { headers });
    check(res, { 'exams 200': (r) => r.status === 200 });
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  group('users', () => {
    const res = http.get(`${BASE_URL}/api/v1/users?pageSize=5`, { headers });
    check(res, { 'users 200': (r) => r.status === 200 });
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  group('notifications', () => {
    const res = http.get(`${BASE_URL}/api/v1/notifications?pageSize=5`, { headers });
    check(res, { 'notifications 200': (r) => r.status === 200 });
  });

  // ── RBAC: 401 without token ───────────────────────────────────────────────
  group('rbac/no-token', () => {
    // tag: this request is expected to 4xx; exclude from http_req_failed threshold
    const res = http.get(`${BASE_URL}/api/v1/auth/me`, {
      tags: { expected_status: '401' },
      responseCallback: http.expectedStatuses(401),
    });
    check(res, { 'no-token returns 401': (r) => r.status === 401 });
  });

  // ── PDPA export ───────────────────────────────────────────────────────────
  group('me/data-export', () => {
    const res = http.get(`${BASE_URL}/api/v1/me/data-export`, { headers });
    check(res, {
      'data-export 200': (r) => r.status === 200,
      'data-export is zip': (r) => {
        const ct = r.headers['Content-Type'] || '';
        return ct.includes('zip');
      },
    });
  });
}
