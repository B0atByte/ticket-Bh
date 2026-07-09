import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  addMock: vi.fn(),
  infoMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('../../jobs/queue.js', () => ({
  getEmailQueue: () => ({ add: mocks.addMock }),
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: mocks.infoMock, error: mocks.errorMock, warn: vi.fn(), debug: vi.fn() },
}));

import {
  sendExamResult,
  sendCourseAssigned,
  sendWeeklyReport,
} from './email-templates.js';

describe('email templates', () => {
  beforeEach(() => {
    mocks.addMock.mockReset().mockResolvedValue(undefined);
    mocks.infoMock.mockReset();
    mocks.errorMock.mockReset();
  });

  it('sendExamResult marks passed vs failed', async () => {
    await sendExamResult({
      userName: 'A',
      userEmail: 'a@x.com',
      courseName: 'C',
      examName: 'Final',
      score: 88,
      passed: true,
      attemptUrl: 'u',
    });
    expect(mocks.addMock.mock.calls[0][1].subject).toContain('Passed');
    expect(mocks.addMock.mock.calls[0][1].html).toContain('PASSED');

    await sendExamResult({
      userName: 'A',
      userEmail: 'a@x.com',
      courseName: 'C',
      examName: 'Final',
      score: 30,
      passed: false,
      attemptUrl: 'u',
    });
    expect(mocks.addMock.mock.calls[1][1].subject).toContain('Failed');
    expect(mocks.addMock.mock.calls[1][1].html).toContain('NOT PASSED');
  });

  it('sendCourseAssigned includes dueDate when provided', async () => {
    await sendCourseAssigned({
      userName: 'A',
      userEmail: 'a@x.com',
      courseName: 'C',
      assignedBy: 'Boss',
      courseUrl: 'u',
      dueDate: new Date('2027-12-31'),
    });
    expect(mocks.addMock.mock.calls[0][1].html).toContain('Due Date');

    await sendCourseAssigned({
      userName: 'A',
      userEmail: 'a@x.com',
      courseName: 'C',
      assignedBy: 'Boss',
      courseUrl: 'u',
    });
    expect(mocks.addMock.mock.calls[1][1].html).not.toContain('Due Date');
  });

  it('sendWeeklyReport includes metric numbers', async () => {
    await sendWeeklyReport({
      userName: 'A',
      userEmail: 'a@x.com',
      managerName: 'M',
      coursesCompleted: 3,
      coursesInProgress: 1,
      hoursLearned: 12,
      reportUrl: 'u',
    });
    const html = mocks.addMock.mock.calls[0][1].html;
    expect(html).toContain('3');
    expect(html).toContain('12');
  });

  it('swallows queue.add failure and logs error', async () => {
    mocks.addMock.mockRejectedValueOnce(new Error('redis down'));
    await expect(
      sendExamResult({
        userName: 'A',
        userEmail: 'a@x.com',
        courseName: 'C',
        examName: 'Final',
        score: 88,
        passed: true,
        attemptUrl: 'u',
      }),
    ).resolves.toBeUndefined();
    expect(mocks.errorMock).toHaveBeenCalled();
  });
});
