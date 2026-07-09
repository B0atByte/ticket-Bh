import { describe, it, expect } from 'vitest';

// Schema files are mostly declarative — importing + parsing one valid + one invalid
// sample exercises the zod chains and counts toward coverage.

import * as auth from './auth/auth.schema.js';
import * as users from './users/users.schema.js';
import * as courses from './courses/courses.schema.js';
import * as courseModules from './course-modules/course-modules.schema.js';
import * as lessons from './lessons/lessons.schema.js';
import * as exams from './exams/exams.schema.js';
import * as questions from './questions/questions.schema.js';
import * as attempts from './attempts/attempts.schema.js';
import * as lessonNotes from './lesson-notes/lesson-notes.schema.js';
import * as lessonProgress from './lesson-progress/lesson-progress.schema.js';
import * as courseQA from './course-qa/course-qa.schema.js';
import * as auditLogs from './audit-logs/audit-logs.schema.js';
import * as settings from './settings/settings.schema.js';
import * as notifications from './notifications/notifications.schema.js';
import * as me from './me/me.schema.js';

describe('zod schemas — coverage smoke', () => {
  it('auth.LoginSchema validates valid + invalid', () => {
    expect(auth.LoginSchema.safeParse({ identifier: 'a@b.com', password: 'Pass@1234' }).success).toBe(true);
    expect(auth.LoginSchema.safeParse({ identifier: '', password: '' }).success).toBe(false);
  });

  it('auth.RegisterSchema validates', () => {
    expect(
      auth.RegisterSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass@1234',
        firstName: 'A',
        lastName: 'B',
      }).success,
    ).toBe(true);
    expect(
      auth.RegisterSchema.safeParse({ email: 'no-at', password: '', firstName: '', lastName: '' })
        .success,
    ).toBe(false);
  });

  it('users schemas validate', () => {
    expect(users.UserListQuerySchema.safeParse({}).success).toBe(true);
    expect(
      users.CreateUserSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass@1234',
        firstName: 'A',
        lastName: 'B',
      }).success,
    ).toBe(true);
    expect(users.UpdateUserSchema.safeParse({ firstName: 'X' }).success).toBe(true);
    expect(users.ChangeUserPasswordSchema.safeParse({ password: 'Hello@1234' }).success).toBe(true);
  });

  it('courses schemas validate', () => {
    expect(courses.CourseListQuerySchema.safeParse({}).success).toBe(true);
    expect(courses.CreateCourseSchema.safeParse({ title: 'T', slug: 'slug' }).success).toBe(true);
    expect(courses.UpdateCourseSchema.safeParse({}).success).toBe(true);
  });

  it('course-modules schemas validate', () => {
    expect(courseModules.CreateModuleSchema.safeParse({ title: 'M' }).success).toBe(true);
    expect(courseModules.UpdateModuleSchema.safeParse({}).success).toBe(true);
    expect(courseModules.ReorderModulesSchema.safeParse({ orderedIds: [1, 2] }).success).toBe(true);
  });

  it('lessons schemas validate', () => {
    expect(lessons.CreateLessonSchema.safeParse({ title: 'L' }).success).toBe(true);
    expect(lessons.UpdateLessonSchema.safeParse({}).success).toBe(true);
    expect(lessons.UpsertLessonContentSchema.safeParse({ type: 'TEXT' }).success).toBe(true);
    expect(lessons.ReorderLessonsSchema.safeParse({ orderedIds: [1] }).success).toBe(true);
  });

  it('exams schemas validate', () => {
    expect(exams.ExamListQuerySchema.safeParse({}).success).toBe(true);
    expect(exams.CreateExamSchema.safeParse({ title: 'E' }).success).toBe(true);
    expect(exams.UpdateExamSchema.safeParse({}).success).toBe(true);
    expect(exams.AssignQuestionSchema.safeParse({ questionId: 1, points: 5 }).success).toBe(true);
  });

  it('questions schemas validate', () => {
    expect(questions.QuestionListQuerySchema.safeParse({}).success).toBe(true);
    expect(
      questions.CreateQuestionSchema.safeParse({
        type: 'SINGLE_CHOICE',
        text: 'q',
        options: [
          { text: 'a', isCorrect: true },
          { text: 'b', isCorrect: false },
        ],
      }).success,
    ).toBe(true);
    expect(questions.UpdateQuestionSchema.safeParse({}).success).toBe(true);
  });

  it('attempts schemas validate', () => {
    expect(attempts.AttemptListQuerySchema.safeParse({}).success).toBe(true);
    expect(attempts.SaveResponseSchema.safeParse({ questionId: 1 }).success).toBe(true);
    expect(attempts.LogEventSchema.safeParse({ type: 'TAB_BLUR' }).success).toBe(true);
    expect(attempts.LogEventSchema.safeParse({ type: 'INVALID' }).success).toBe(false);
  });

  it('lesson-notes / lesson-progress schemas validate', () => {
    expect(
      lessonNotes.CreateNoteSchema.safeParse({ type: 'NOTE', content: 'c' }).success,
    ).toBe(true);
    expect(lessonNotes.UpdateNoteSchema.safeParse({ content: 'x' }).success).toBe(true);
    expect(lessonNotes.NoteListQuerySchema.safeParse({}).success).toBe(true);
    expect(
      lessonProgress.UpsertProgressSchema.safeParse({ secondsWatched: 10, lastPositionSec: 5 })
        .success,
    ).toBe(true);
  });

  it('course-qa schemas validate', () => {
    expect(courseQA.CreateQuestionSchema.safeParse({ title: 't', body: 'b' }).success).toBe(true);
    expect(courseQA.CreateAnswerSchema.safeParse({ body: 'a' }).success).toBe(true);
    expect(courseQA.QAListQuerySchema.safeParse({}).success).toBe(true);
  });

  it('audit-logs schema validates', () => {
    expect(auditLogs.AuditLogQuerySchema.safeParse({}).success).toBe(true);
    expect(
      auditLogs.AuditLogQuerySchema.safeParse({
        actorId: '5',
        from: '2026-01-01',
        to: '2026-12-31',
      }).success,
    ).toBe(true);
  });

  it('settings schema validates', () => {
    expect(
      settings.BrandingSchema.safeParse({ name: 'X', primaryColor: '#000000', logoUrl: null })
        .success,
    ).toBe(true);
    expect(settings.BrandingSchema.safeParse({ name: '', primaryColor: 'red' }).success).toBe(false);
  });

  it('notifications schemas validate', () => {
    expect(notifications.NotificationQuerySchema.safeParse({}).success).toBe(true);
    expect(
      notifications.CreateNotificationSchema.safeParse({
        userId: 5,
        type: 'X',
        title: 't',
        body: 'b',
      }).success,
    ).toBe(true);
  });

  it('me schema imports', () => {
    expect(me.EmptyBodySchema.safeParse({}).success).toBe(true);
  });
});
