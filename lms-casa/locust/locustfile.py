"""
Locust load test for LMS Casa.

Mirrors the k6 load-test.js scenarios: login as one of 5 seed users, then exercise
the most-hit read endpoints: dashboard stats, courses, exams, leaderboard, and
attempts. Each virtual user reuses its token; failures are reported but do not
stop the run.

Run with the web UI:
    python -m locust -f lms-system/locust/locustfile.py --host=http://localhost:4000
    # then open http://localhost:8089

Run headless:
    python -m locust -f lms-system/locust/locustfile.py --host=http://localhost:4000 \
        --users=100 --spawn-rate=10 --run-time=60s --headless

Requires the backend running on http://localhost:4000 with the dev seed users.
"""

import random

from locust import HttpUser, between, task

API = "/api/v1"

SEED_USERS = [
    {"identifier": "admin@lmscasa.local", "password": "Admin@12345"},
    {"identifier": "hr@lmscasa.local", "password": "Hr@12345"},
    {"identifier": "manager@lmscasa.local", "password": "Manager@12345"},
    {"identifier": "instructor@lmscasa.local", "password": "Instructor@12345"},
    {"identifier": "employee@lmscasa.local", "password": "Employee@12345"},
]


class LmsUser(HttpUser):
    """Simulates a real logged-in user browsing the LMS."""

    # Think time between tasks: 1-3 seconds, realistic human pace.
    wait_time = between(1, 3)
    token: str | None = None

    def on_start(self) -> None:
        """Log in once per virtual user and cache the access token."""
        creds = random.choice(SEED_USERS)
        with self.client.post(
            f"{API}/auth/login",
            json=creds,
            name="POST /auth/login",
            catch_response=True,
        ) as res:
            if res.status_code != 200:
                res.failure(f"login {creds['identifier']} -> {res.status_code}")
                return

            data = res.json()
            self.token = data.get("tokens", {}).get("accessToken")
            if not self.token:
                res.failure("login response missing tokens.accessToken")

    @property
    def auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def _get(self, path: str, *, name: str | None = None) -> None:
        if not self.token:
            return

        self.client.get(
            path,
            headers=self.auth_headers,
            name=name or path,
        )

    # Weighted tasks. Higher @task(weight) values are picked more often.

    @task(5)
    def view_courses(self) -> None:
        self._get(f"{API}/courses?status=PUBLISHED&pageSize=50", name="GET /courses")

    @task(3)
    def view_exams(self) -> None:
        self._get(f"{API}/exams?pageSize=50", name="GET /exams")

    @task(3)
    def my_dashboard_stats(self) -> None:
        self._get(f"{API}/stats/me", name="GET /stats/me")

    @task(3)
    def my_points(self) -> None:
        self._get(f"{API}/points/me", name="GET /points/me")

    @task(2)
    def leaderboard_org(self) -> None:
        self._get(
            f"{API}/points/leaderboard?scope=org&limit=50",
            name="GET /points/leaderboard?scope=org",
        )

    @task(2)
    def leaderboard_dept(self) -> None:
        self._get(
            f"{API}/points/leaderboard?scope=department&limit=50",
            name="GET /points/leaderboard?scope=department",
        )

    @task(2)
    def my_attempts(self) -> None:
        self._get(f"{API}/attempts?pageSize=20", name="GET /attempts")

    @task(1)
    def me(self) -> None:
        self._get(f"{API}/auth/me", name="GET /auth/me")
