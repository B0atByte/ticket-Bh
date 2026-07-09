// Email notification templates for Phase 5 Batch B
import { getEmailQueue } from '../../jobs/queue.js';
import { logger } from '../../utils/logger.js';

// ─── Template types ───────────────────────────────────────────────────────

export type ExamResultData = {
  userName: string;
  userEmail: string;
  courseName: string;
  examName: string;
  score: number;
  passed: boolean;
  attemptUrl: string;
};

export type CourseAssignedData = {
  userName: string;
  userEmail: string;
  courseName: string;
  assignedBy: string;
  dueDate?: Date;
  courseUrl: string;
};

export type WeeklyReportData = {
  userName: string;
  userEmail: string;
  managerName: string;
  coursesCompleted: number;
  coursesInProgress: number;
  hoursLearned: number;
  reportUrl: string;
};

// ─── HTML Templates ───────────────────────────────────────────────────────

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
<div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
<h1 style="color: #2c3e50; margin-top: 0;">${title}</h1>
${body}
</div>
<p style="color: #6c757d; font-size: 12px; margin-top: 20px;">
This is an automated message from LMS Casa. Please do not reply to this email.
</p>
</body>
</html>`;
}

function examResultTemplate(d: ExamResultData): { subject: string; html: string } {
  const status = d.passed ? '<span style="color: #27ae60; font-weight: bold;">PASSED</span>' : '<span style="color: #e74c3c; font-weight: bold;">NOT PASSED</span>';
  const subject = `Exam Result: ${d.examName} - ${d.passed ? 'Passed' : 'Failed'}`;
  const html = wrapHtml(subject, `
    <p>Hi ${d.userName},</p>
    <p>Your exam result for <strong>${d.examName}</strong> (${d.courseName}):</p>
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <p style="margin: 0;"><strong>Score:</strong> ${d.score}%</p>
      <p style="margin: 10px 0 0 0;"><strong>Status:</strong> ${status}</p>
    </div>
    <p><a href="${d.attemptUrl}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Details</a></p>
  `);
  return { subject, html };
}

function courseAssignedTemplate(d: CourseAssignedData): { subject: string; html: string } {
  const subject = `New Course Assigned: ${d.courseName}`;
  const dueSection = d.dueDate
    ? `<p><strong>Due Date:</strong> ${d.dueDate.toLocaleDateString()}</p>`
    : '';
  const html = wrapHtml(subject, `
    <p>Hi ${d.userName},</p>
    <p>You have been assigned a new course by <strong>${d.assignedBy}</strong>.</p>
    <p><strong>Course:</strong> ${d.courseName}</p>
    ${dueSection}
    <p><a href="${d.courseUrl}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Start Course</a></p>
  `);
  return { subject, html };
}

function weeklyReportTemplate(d: WeeklyReportData): { subject: string; html: string } {
  const subject = `Weekly Learning Report - ${d.managerName}`;
  const html = wrapHtml(subject, `
    <p>Hi ${d.userName},</p>
    <p>Here's your weekly learning summary:</p>
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <p style="margin: 0;"><strong>Courses Completed:</strong> ${d.coursesCompleted}</p>
      <p style="margin: 10px 0 0 0;"><strong>Courses In Progress:</strong> ${d.coursesInProgress}</p>
      <p style="margin: 10px 0 0 0;"><strong>Hours Learned:</strong> ${d.hoursLearned}</p>
    </div>
    <p><a href="${d.reportUrl}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Full Report</a></p>
  `);
  return { subject, html };
}

// ─── Queue helpers ───────────────────────────────────────────────────────

async function enqueueEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const queue = getEmailQueue();
    await queue.add('send', { to, subject, html });
    logger.info(`Email queued: ${subject} → ${to}`);
  } catch (err) {
    logger.error('Failed to queue email', err, { to, subject });
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function sendExamResult(data: ExamResultData): Promise<void> {
  const { subject, html } = examResultTemplate(data);
  await enqueueEmail(data.userEmail, subject, html);
}

export async function sendCourseAssigned(data: CourseAssignedData): Promise<void> {
  const { subject, html } = courseAssignedTemplate(data);
  await enqueueEmail(data.userEmail, subject, html);
}

export async function sendWeeklyReport(data: WeeklyReportData): Promise<void> {
  const { subject, html } = weeklyReportTemplate(data);
  await enqueueEmail(data.userEmail, subject, html);
}
