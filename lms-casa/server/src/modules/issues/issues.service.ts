import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { CreateIssueInput } from './issues.schema.js';

async function notifyDiscord(issue: {
  description: string;
  page: string | null;
  createdAt: Date;
  reporter: { firstName: string; lastName: string; email: string } | null;
}): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) return;

  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'LMS Casa',
        embeds: [
          {
            title: '🐞 แจ้งปัญหาใหม่ - LMS Casa',
            description: issue.description,
            color: 0xef4444,
            fields: [
              {
                name: 'ผู้แจ้ง',
                value: issue.reporter
                  ? `${issue.reporter.firstName} ${issue.reporter.lastName} (${issue.reporter.email})`
                  : 'ไม่ระบุ',
                inline: true,
              },
              { name: 'หน้า', value: issue.page ?? '-', inline: true },
            ],
            timestamp: issue.createdAt.toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    logger.error('Discord webhook failed: %s', err);
  }
}

export async function list(limit: number) {
  const rows = await prisma.issue.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reporter: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id.toString(),
    description: row.description,
    page: row.page,
    reporterName: row.reporter ? `${row.reporter.firstName} ${row.reporter.lastName}`.trim() : null,
    reporterRole: null,
    createdAt: row.createdAt,
  }));
}

export async function create(reporterId: bigint | null, input: CreateIssueInput) {
  const issue = await prisma.issue.create({
    data: {
      reporterId,
      description: input.description,
      page: input.page ?? null,
    },
    include: {
      reporter: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  await notifyDiscord(issue);

  return issue;
}
