import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  enrollCount: vi.fn(),
  lpAggregate: vi.fn(),
  sendReport: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    enrollment: { count: mocks.enrollCount },
    lessonProgress: { aggregate: mocks.lpAggregate },
  },
}));
vi.mock('../../modules/email-templates/email-templates.js', () => ({
  sendWeeklyReport: mocks.sendReport,
}));
vi.mock('../../config/env.js', () => ({
  env: { APP_URL: 'http://localhost' },
}));

import { runWeeklyReport } from './weekly-report.job.js';

describe('runWeeklyReport', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
    mocks.sendReport.mockResolvedValue(undefined);
  });

  it('sends a weekly report to each user', async () => {
    mocks.userFindMany.mockResolvedValueOnce([
      { id: 1n, firstName: 'A', lastName: 'B', email: 'a@b.com' },
      { id: 2n, firstName: 'C', lastName: 'D', email: 'c@d.com' },
    ]);
    mocks.enrollCount.mockResolvedValue(3);
    mocks.lpAggregate.mockResolvedValue({ _sum: { secondsWatched: 7200 } });
    await runWeeklyReport();
    expect(mocks.sendReport).toHaveBeenCalledTimes(2);
    const payload = mocks.sendReport.mock.calls[0][0];
    expect(payload.userEmail).toBe('a@b.com');
    expect(payload.hoursLearned).toBe(2);
  });

  it('handles null secondsWatched', async () => {
    mocks.userFindMany.mockResolvedValueOnce([{ id: 1n, firstName: 'A', lastName: 'B', email: 'a@b.com' }]);
    mocks.enrollCount.mockResolvedValue(0);
    mocks.lpAggregate.mockResolvedValue({ _sum: { secondsWatched: null } });
    await runWeeklyReport();
    expect(mocks.sendReport.mock.calls[0][0].hoursLearned).toBe(0);
  });
});
