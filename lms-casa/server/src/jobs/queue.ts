import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const connection: ConnectionOptions = (() => {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
})();

// ─── Job types ───────────────────────────────────────────────────────────────

export type ScheduledJobType = 'weekly-report';

export type SendEmailJob = {
  to?: string;
  subject?: string;
  html?: string;
  type?: ScheduledJobType;
};

// Heavy Excel exports are generated off the request thread by a worker.
export type ReportJob = {
  kind: 'exam-results' | 'course-completion';
  examId?: string;
  from?: string;
  to?: string;
};

export const QUEUE_NAMES = {
  EMAIL: 'email',
  REPORTS: 'reports',
} as const;

// ─── Queues ──────────────────────────────────────────────────────────────────

let emailQueue: Queue<SendEmailJob> | null = null;
let reportQueueInstance: Queue<ReportJob> | null = null;

export function getEmailQueue(): Queue<SendEmailJob> {
  if (!emailQueue) {
    emailQueue = new Queue<SendEmailJob>(QUEUE_NAMES.EMAIL, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return emailQueue;
}

export function getReportQueue(): Queue<ReportJob> {
  if (!reportQueueInstance) {
    reportQueueInstance = new Queue<ReportJob>(QUEUE_NAMES.REPORTS, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        // Keep finished jobs ~1h so the client can poll status + download.
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 3600, count: 500 },
      },
    });
  }
  return reportQueueInstance;
}

// ─── Scheduled Jobs ──────────────────────────────────────────────────────────

let scheduledJobIds: string[] = [];

export async function startScheduledJobs(): Promise<void> {
  if (!env.ENABLE_WORKERS) {
    logger.warn('Scheduled jobs disabled (ENABLE_WORKERS=false)');
    return;
  }

  // Weekly report: run every Monday at 10 AM
  const reportQueue = getEmailQueue();
  const reportJob = await reportQueue.add(
    'weekly-report',
    { type: 'weekly-report' },
    {
      repeat: {
        pattern: '0 10 * * 1', // Every Monday at 10 AM
        tz: 'Asia/Bangkok',
      },
    },
  );
  scheduledJobIds.push(reportJob.id!);

  logger.info('Scheduled jobs registered: weekly-report (Mon 10AM)');
}

// Handle scheduled job processing in the email worker
export async function processScheduledJob(data: { type: string }): Promise<void> {
  if (data.type === 'weekly-report') {
    const { runWeeklyReport } = await import('./scheduled/weekly-report.job.js');
    await runWeeklyReport();
  }
}

export async function stopScheduledJobs(): Promise<void> {
  // Clean up any repeat jobs
  scheduledJobIds = [];
  logger.info('Scheduled jobs stopped');
}

// ─── Workers (started by server.ts on boot) ──────────────────────────────────

const workers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  if (!env.ENABLE_WORKERS) {
    logger.warn('Workers disabled (ENABLE_WORKERS=false)');
    return;
  }
  // Lazy imports to break circular deps with services
  const { processEmailJob } = await import('./processors/email.processor.js');
  const { processReportJob } = await import('./processors/report.processor.js');

  workers.push(
    new Worker<SendEmailJob>(
      QUEUE_NAMES.EMAIL,
      async (job: Job<SendEmailJob>) => processEmailJob(job.data),
      { connection, concurrency: 5 },
    ),
    // Reports are CPU/memory heavy; keep concurrency low so they never starve
    // request handling (and run them on dedicated worker replicas in prod).
    new Worker<ReportJob>(
      QUEUE_NAMES.REPORTS,
      async (job: Job<ReportJob>) => processReportJob(job.id!, job.data),
      { connection, concurrency: 2 },
    ),
  );

  for (const w of workers) {
    w.on('failed', (job, err) => logger.error(`Job ${job?.name} failed`, err));
    w.on('completed', (job) => logger.info(`Job ${job.queueName}/${job.id} completed`));
  }
  logger.info(`Workers started: ${workers.map((w) => w.name).join(', ')}`);
}

export async function stopWorkers(): Promise<void> {
  await Promise.allSettled(workers.map((w) => w.close()));
}
