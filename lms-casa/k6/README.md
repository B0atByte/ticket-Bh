# k6 Load Tests — LMS Casa

## Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

```bash
# Windows (winget)
winget install k6 --source winget

# macOS
brew install k6
```

## Files

| File | Purpose |
|---|---|
| `smoke-test.js` | 1 VU, 1 iteration — quick sanity check all endpoints respond |
| `load-test.js` | Ramp to 500 VUs — full load test, p95 < 500ms threshold |

## Running

Make sure backend is running on `http://localhost:4000` first.

```bash
# Smoke test (run first)
k6 run k6/smoke-test.js

# Load test (default: ramp to 500 VUs over ~3 min)
k6 run k6/load-test.js

# Load test against different host
k6 run -e BASE_URL=http://your-server:4000 k6/load-test.js

# Quick load test (fewer VUs for local dev)
k6 run --vus 50 --duration 30s k6/load-test.js
```

## Thresholds

| Metric | Threshold |
|---|---|
| `http_req_duration` p95 | < 500ms |
| `error_rate` | < 1% |
| `login_duration` p95 | < 1000ms |
| `course_list_duration` p95 | < 500ms |

## Notes

- Load test uses 5 seed users (admin/hr/manager/instructor/employee) rotated randomly across VUs.
- SSE endpoint (`/notifications/stream`) is excluded — k6 does not support SSE natively.
- If `MUTATION_RATE_LIMIT_MAX` is hit during load test, increase `MUTATION_RATE_LIMIT_MAX` in `.env` for testing.
