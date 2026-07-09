# Locust load tests — LMS Casa

Python-based load test that complements the existing k6 scripts.

## Install (once)

```cmd
pip install locust
```

The `locust` CLI is installed to `%APPDATA%\Python\Python314\Scripts\locust.exe`
(adjust Python version as needed). If that folder is not on your `PATH`, either:

- Add it to PATH, **or**
- Use the full path:
  `"%APPDATA%\Python\Python314\Scripts\locust.exe" -f locust/locustfile.py ...`

## Run with web UI

```cmd
cd lms-system
locust -f locust/locustfile.py --host=http://localhost:4000
```

Open <http://localhost:8089> → set Users + spawn rate → Start.

## Run headless (one-shot)

```cmd
locust -f locust/locustfile.py --host=http://localhost:4000 ^
       --users=100 --spawn-rate=10 --run-time=60s --headless ^
       --csv=locust/run-001
```

Outputs `run-001_stats.csv` + `run-001_failures.csv`.

## Prerequisites

- Backend running at `http://localhost:4000` (`npm run dev` in `server/`).
- Seed users present (default after `npm run seed`).
