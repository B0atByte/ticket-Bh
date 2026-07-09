// Scheduled job: Weekly learning report
// Runs weekly to send learning progress reports to employees
import { prisma } from '../../config/db.js';
import { sendWeeklyReport } from '../../modules/email-templates/email-templates.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

export async function runWeeklyReport(): Promise<void> {
  logger.info('Running weekly report job...');

  // Get all active users (not deleted)
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  logger.info(`Sending weekly reports to ${users.length} users`);

  for (const user of users) {
    // Count courses completed this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [coursesCompleted, coursesInProgress, hoursLearned] = await Promise.all([
      // Courses completed this week (enrollments transitioned to COMPLETED in this window)
      prisma.enrollment.count({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          completedAt: { gte: weekAgo },
        },
      }),
      // Courses in progress (enrolled but not yet completed)
      prisma.enrollment.count({
        where: {
          userId: user.id,
          progressPct: { gt: 0, lt: 100 },
        },
      }),
      // Total seconds watched this week / 3600 = hours
      prisma.lessonProgress.aggregate({
        where: {
          userId: user.id,
          updatedAt: { gte: weekAgo },
        },
        _sum: { secondsWatched: true },
      }),
    ]);

    const hours = hoursLearned?._sum?.secondsWatched
      ? Math.round((hoursLearned._sum.secondsWatched as number) / 3600)
      : 0;

    const reportUrl = `${env.APP_URL}/stats`;
    sendWeeklyReport({
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      managerName: 'Your Manager', // Could be enhanced to fetch actual manager name
      coursesCompleted,
      coursesInProgress,
      hoursLearned: hours,
      reportUrl,
    }).catch((e) => logger.error('Failed to send weekly report', e, { userId: user.id }));
  }

  logger.info('Weekly report job completed');
}
