import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Notification } from '@prisma/client';

// Mock Redis so publish() synchronously drives the subscriber's message handler,
// simulating the cross-instance pub/sub round-trip in-process (Issue #13).
const h = vi.hoisted(() => {
  const state: { handler: ((ch: string, payload: string) => void) | null } = { handler: null };
  const subscriber = {
    on: (evt: string, cb: (ch: string, payload: string) => void) => {
      if (evt === 'message') state.handler = cb;
    },
    subscribe: () => Promise.resolve(),
    quit: () => Promise.resolve(),
  };
  const redis = {
    publish: (ch: string, payload: string) => {
      state.handler?.(ch, payload);
      return Promise.resolve(1);
    },
    duplicate: () => subscriber,
  };
  return { state, redis };
});

vi.mock('../../config/redis.js', () => ({ redis: h.redis }));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  addClient,
  publishNotification,
  publishToUser,
  initNotificationHub,
} from './notifications.hub.js';

function makeNotif(userId: bigint, id = 1n): Notification {
  return {
    id,
    userId,
    type: 'TEST',
    title: 't',
    body: 'b',
    data: null,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('notifications hub (Redis pub/sub)', () => {
  beforeAll(async () => {
    await initNotificationHub();
  });

  it('delivers notification to matching userId only', () => {
    const writeA = vi.fn();
    const writeB = vi.fn();
    const cleanA = addClient('5', writeA);
    const cleanB = addClient('9', writeB);

    publishNotification(makeNotif(5n));

    expect(writeA).toHaveBeenCalledTimes(1);
    expect(writeA.mock.calls[0][0]).toBe('notification');
    expect(writeB).not.toHaveBeenCalled();

    cleanA();
    cleanB();
  });

  it('cleanup removes client', () => {
    const write = vi.fn();
    const clean = addClient('7', write);
    clean();
    publishNotification(makeNotif(7n));
    expect(write).not.toHaveBeenCalled();
  });

  it('supports multiple clients for same user', () => {
    const w1 = vi.fn();
    const w2 = vi.fn();
    const c1 = addClient('11', w1);
    const c2 = addClient('11', w2);
    publishNotification(makeNotif(11n));
    expect(w1).toHaveBeenCalledTimes(1);
    expect(w2).toHaveBeenCalledTimes(1);
    c1();
    c2();
  });

  it('publishToUser sends a custom event only to that user', () => {
    const writeA = vi.fn();
    const writeB = vi.fn();
    const cleanA = addClient('21', writeA);
    const cleanB = addClient('22', writeB);

    publishToUser('21', 'session-revoked', { reason: 'NEW_LOGIN' });

    expect(writeA).toHaveBeenCalledTimes(1);
    expect(writeA.mock.calls[0][0]).toBe('session-revoked');
    expect(writeA.mock.calls[0][1]).toMatchObject({ reason: 'NEW_LOGIN' });
    expect(writeB).not.toHaveBeenCalled();

    cleanA();
    cleanB();
  });
});
