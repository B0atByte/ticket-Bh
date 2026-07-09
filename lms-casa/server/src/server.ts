import './config/sentry.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDb, disconnectDb } from './config/db.js';
import { connectRedis, redis } from './config/redis.js';
import { startWorkers, stopWorkers, startScheduledJobs, stopScheduledJobs } from './jobs/queue.js';
import { initNotificationHub, stopNotificationHub } from './modules/notifications/notifications.hub.js';
import { Sentry, isSentryEnabled } from './config/sentry.js';

async function main(): Promise<void> {
  await connectDb();
  await connectRedis();
  await initNotificationHub();
  await startWorkers();
  await startScheduledJobs();

  // bcrypt runs on the libuv threadpool. Its default size (4) caps concurrent
  // password hashes and thus login throughput. UV_THREADPOOL_SIZE must be set as
  // a process env var BEFORE Node starts (see Dockerfile / docker-compose).
  const threadpoolSize = Number(process.env.UV_THREADPOOL_SIZE) || 4;
  logger.info(`libuv threadpool size: ${threadpoolSize}`);
  if (env.NODE_ENV === 'production' && threadpoolSize < 8) {
    logger.warn(
      'UV_THREADPOOL_SIZE is low (<8). bcrypt logins will bottleneck under load; ' +
        'set UV_THREADPOOL_SIZE>=16 and run multiple instances behind a load balancer.',
    );
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal} — shutting down`);
    server.close(() => logger.info('HTTP server closed'));
    await Promise.allSettled([
      stopWorkers(),
      stopScheduledJobs(),
      stopNotificationHub(),
      disconnectDb(),
      redis.quit(),
    ]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', reason);
    if (isSentryEnabled) {
      Sentry.captureException(reason);
    }
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', err);
    if (!isSentryEnabled) {
      process.exit(1);
    }
    Sentry.captureException(err);
    void Sentry.flush(2000).finally(() => process.exit(1));
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  if (!isSentryEnabled) {
    process.exit(1);
  }
  Sentry.captureException(err);
  void Sentry.flush(2000).finally(() => process.exit(1));
});
