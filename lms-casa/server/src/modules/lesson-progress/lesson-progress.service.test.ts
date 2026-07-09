import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  lessonFindFirst: vi.fn(),
  lpFindUnique: vi.fn(),
  lpUpsert: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    lesson: { findFirst: mocks.lessonFindFirst },
    lessonProgress: {
      findUnique: mocks.lpFindUnique,
      upsert: mocks.lpUpsert,
    },
  },
}));

import { getProgress, upsertProgress, resetProgress } from './lesson-progress.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('lesson-progress.service', () => {
  beforeEach(() => {
    mocks.lessonFindFirst.mockReset();
    mocks.lpFindUnique.mockReset();
    mocks.lpUpsert.mockReset();
  });

  it('resetProgress zeroes position/watched and clears completion (anti-AFK)', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.lpUpsert.mockResolvedValueOnce({ id: 1n, status: 'IN_PROGRESS', lastPositionSec: 0, secondsWatched: 0 });
    await resetProgress(5n, 9n);
    const arg = mocks.lpUpsert.mock.calls[0][0];
    expect(arg.update).toMatchObject({ status: 'IN_PROGRESS', lastPositionSec: 0, completedAt: null });
    expect(arg.update.secondsWatched).toEqual({ set: 0 });
    expect(arg.create).toMatchObject({ status: 'IN_PROGRESS', lastPositionSec: 0, secondsWatched: 0 });
  });

  it('resetProgress throws 404 when lesson missing', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce(null);
    await expect(resetProgress(5n, 9n)).rejects.toBeInstanceOf(HttpError);
  });

  it('getProgress returns existing progress', async () => {
    mocks.lpFindUnique.mockResolvedValueOnce({ id: 1n, status: 'IN_PROGRESS' });
    const out = await getProgress(5n, 9n);
    expect(out?.status).toBe('IN_PROGRESS');
    expect(mocks.lpFindUnique).toHaveBeenCalled();
  });

  it('upsertProgress throws 404 when lesson missing', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce(null);
    await expect(
      upsertProgress(5n, 9n, { secondsWatched: 10, lastPositionSec: 10 }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('marks COMPLETED when client says completed=true', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n, durationSeconds: null });
    mocks.lpUpsert.mockResolvedValueOnce({ status: 'COMPLETED' });
    await upsertProgress(5n, 9n, { secondsWatched: 5, lastPositionSec: 5, completed: true });
    const args = mocks.lpUpsert.mock.calls[0][0];
    expect(args.create.status).toBe('COMPLETED');
    expect(args.create.completedAt).toBeInstanceOf(Date);
    expect(args.update.status).toBe('COMPLETED');
  });

  it('auto-completes at >= 90% watched once enough real time has passed', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n, durationSeconds: 100 });
    // Existing row first created ~120s ago with 80s already credited → real elapsed
    // allows crediting up to 95s now, clearing the 90% bar legitimately.
    mocks.lpFindUnique.mockResolvedValueOnce({
      status: 'IN_PROGRESS',
      completedAt: null,
      secondsWatched: 80,
      createdAt: new Date(Date.now() - 120_000),
    });
    mocks.lpUpsert.mockResolvedValueOnce({ status: 'COMPLETED' });
    await upsertProgress(5n, 9n, { secondsWatched: 95, lastPositionSec: 95 });
    expect(mocks.lpUpsert.mock.calls[0][0].update.status).toBe('COMPLETED');
  });

  it('stays IN_PROGRESS below 90%', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n, durationSeconds: 100 });
    mocks.lpUpsert.mockResolvedValueOnce({ status: 'IN_PROGRESS' });
    await upsertProgress(5n, 9n, { secondsWatched: 50, lastPositionSec: 50 });
    expect(mocks.lpUpsert.mock.calls[0][0].create.status).toBe('IN_PROGRESS');
    expect(mocks.lpUpsert.mock.calls[0][0].create.completedAt).toBeNull();
  });

  // === Anti-spoof regression tests (Issue #4) ===

  it('a single first save claiming full watch does NOT complete a timed lesson', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n, durationSeconds: 100 });
    // No existing row → first save is capped to the grace window (30s), far below 90.
    mocks.lpUpsert.mockResolvedValueOnce({ status: 'IN_PROGRESS' });
    await upsertProgress(5n, 9n, { secondsWatched: 100, lastPositionSec: 100, completed: true });
    const args = mocks.lpUpsert.mock.calls[0][0];
    expect(args.create.status).toBe('IN_PROGRESS');
    expect(args.create.secondsWatched).toBe(30); // clamped by anti-fast-forward
  });

  it('client completed=true is IGNORED for a timed lesson', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n, durationSeconds: 100 });
    mocks.lpUpsert.mockResolvedValueOnce({ status: 'IN_PROGRESS' });
    await upsertProgress(5n, 9n, { secondsWatched: 10, lastPositionSec: 10, completed: true });
    expect(mocks.lpUpsert.mock.calls[0][0].create.status).toBe('IN_PROGRESS');
  });

  it('treats durationSeconds=0 as no duration (no auto-complete)', async () => {
    mocks.lessonFindFirst.mockResolvedValueOnce({ id: 5n, durationSeconds: 0 });
    mocks.lpUpsert.mockResolvedValueOnce({});
    await upsertProgress(5n, 9n, { secondsWatched: 999, lastPositionSec: 999 });
    expect(mocks.lpUpsert.mock.calls[0][0].create.status).toBe('IN_PROGRESS');
  });
});
