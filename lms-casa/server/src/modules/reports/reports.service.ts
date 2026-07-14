import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E7FF' },
};

export interface ExamResultsFilter {
  examId?: bigint;
  from?: Date;
  to?: Date;
}

export async function buildExamResultsWorkbook(
  filter: ExamResultsFilter = {},
): Promise<ExcelJS.Workbook> {
  const where: Prisma.ExamAttemptWhereInput = {
    ...(filter.examId ? { examId: filter.examId } : {}),
    ...(filter.from || filter.to
      ? {
          submittedAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.examAttempt.findMany({
    where,
    take: 50_000,
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      maxScore: true,
      scorePct: true,
      passed: true,
      exam: { select: { title: true, course: { select: { title: true } } } },
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'LMS Casa';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Exam Results');
  sheet.columns = [
    { header: 'Attempt ID', key: 'id', width: 14 },
    { header: 'Exam', key: 'examTitle', width: 30 },
    { header: 'Course', key: 'courseTitle', width: 30 },
    { header: 'Employee Email', key: 'email', width: 28 },
    { header: 'Employee Name', key: 'name', width: 28 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Attempt #', key: 'attemptNumber', width: 12 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Started At', key: 'startedAt', width: 22 },
    { header: 'Submitted At', key: 'submittedAt', width: 22 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Max Score', key: 'maxScore', width: 10 },
    { header: 'Score %', key: 'scorePct', width: 10 },
    { header: 'Passed', key: 'passed', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = HEADER_FILL;

  for (const row of rows) {
    sheet.addRow({
      id: row.id.toString(),
      examTitle: row.exam.title,
      courseTitle: row.exam.course?.title ?? '',
      email: row.user.email,
      name: `${row.user.firstName} ${row.user.lastName}`,
      department: row.user.department?.name ?? '',
      attemptNumber: row.attemptNumber,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? '',
      score: row.score ?? '',
      maxScore: row.maxScore ?? '',
      scorePct: row.scorePct?.toString() ?? '',
      passed: row.passed === null || row.passed === undefined ? '' : row.passed ? 'Yes' : 'No',
    });
  }

  return wb;
}

export async function buildCourseCompletionWorkbook(): Promise<ExcelJS.Workbook> {
  const rows = await prisma.enrollment.findMany({
    where: { deletedAt: null },
    take: 50_000,
    orderBy: { enrolledAt: 'desc' },
    select: {
      id: true,
      status: true,
      progressPct: true,
      enrolledAt: true,
      startedAt: true,
      completedAt: true,
      dueAt: true,
      course: { select: { title: true } },
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'LMS Casa';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Course Completion');
  sheet.columns = [
    { header: 'Enrollment ID', key: 'id', width: 14 },
    { header: 'Course', key: 'courseTitle', width: 32 },
    { header: 'Employee Email', key: 'email', width: 28 },
    { header: 'Employee Name', key: 'name', width: 28 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Progress %', key: 'progressPct', width: 12 },
    { header: 'Enrolled At', key: 'enrolledAt', width: 22 },
    { header: 'Started At', key: 'startedAt', width: 22 },
    { header: 'Completed At', key: 'completedAt', width: 22 },
    { header: 'Due At', key: 'dueAt', width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = HEADER_FILL;

  for (const row of rows) {
    sheet.addRow({
      id: row.id.toString(),
      courseTitle: row.course.title,
      email: row.user.email,
      name: `${row.user.firstName} ${row.user.lastName}`,
      department: row.user.department?.name ?? '',
      status: row.status,
      progressPct: row.progressPct,
      enrolledAt: row.enrolledAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? '',
      completedAt: row.completedAt?.toISOString() ?? '',
      dueAt: row.dueAt?.toISOString() ?? '',
    });
  }

  return wb;
}
