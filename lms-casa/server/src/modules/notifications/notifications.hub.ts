import '../../utils/bigintJson.js'; // ensure BigInt → string when serializing payloads
import type { Notification } from '@prisma/client';
import type Redis from 'ioredis';
import { redis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

// Cross-instance fan-out channel. With multiple server replicas behind a load
// balancer, an SSE client may be connected to a DIFFERENT replica than the one
// that created the notification. Publishing through Redis pub/sub lets ANY
// replica deliver to ANY connected user. Each replica delivers only to its own
// locally-held connections (deliverLocal).
const CHANNEL = 'sse:notifications';

type Client = {
  id: number;
  userId: string;
  write: (event: string, data: unknown) => void;
};

let nextId = 1;
const clients = new Map<number, Client>();
let subscriber: Redis | null = null;

export function addClient(userId: string, write: Client['write']): () => void {
  const id = nextId;
  nextId += 1;
  clients.set(id, { id, userId, write });
  return () => {
    clients.delete(id);
  };
}

/** Deliver to this instance's local SSE streams for one user. */
function deliverLocal(userId: string, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.userId === userId) client.write(event, data);
  }
}

/**
 * Publish an event to a user across ALL instances. The originating instance
 * receives it back through its own subscription, so there is a single delivery
 * path (no double-send). Fails open: if Redis publish errors, the notification
 * is still persisted in the DB and shown on the user's next fetch.
 */
export function publishToUser(userId: string, event: string, data: unknown): void {
  redis
    .publish(CHANNEL, JSON.stringify({ userId, event, data }))
    .catch((err) => logger.warn(`SSE publish failed: ${(err as Error).message}`));
}

export function publishNotification(notification: Notification): void {
  publishToUser(notification.userId.toString(), 'notification', notification);
}

/** Subscribe this instance to the SSE channel. Call once at startup. */
export async function initNotificationHub(): Promise<void> {
  if (subscriber) return;
  subscriber = redis.duplicate();
  subscriber.on('error', (err) => logger.error('SSE subscriber error', err));
  subscriber.on('message', (_channel: string, payload: string) => {
    try {
      const { userId, event, data } = JSON.parse(payload) as {
        userId: string;
        event: string;
        data: unknown;
      };
      deliverLocal(userId, event, data);
    } catch (err) {
      logger.warn(`SSE message parse failed: ${(err as Error).message}`);
    }
  });
  await subscriber.subscribe(CHANNEL);
  logger.info('SSE notification hub subscribed (multi-instance ready)');
}

export async function stopNotificationHub(): Promise<void> {
  if (subscriber) {
    await subscriber.quit().catch(() => undefined);
    subscriber = null;
  }
}
