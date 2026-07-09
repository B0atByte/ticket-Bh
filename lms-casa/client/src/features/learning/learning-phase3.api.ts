/**
 * Phase 3 — Learning Experience API
 * Lesson progress, notes/bookmarks, course Q&A
 */
import { api } from '../../lib/api';
import type { Paginated } from './learning.api';

// ─── lesson progress ─────────────────────────────────────────────────────────

export interface LessonProgress {
  id: string;
  lessonId: string;
  userId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  secondsWatched: number;
  lastPositionSec: number;
  completedAt: string | null;
  updatedAt: string;
}

export async function getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
  const { data } = await api.get<{ progress: LessonProgress | null }>(
    `/lessons/${lessonId}/progress`,
  );
  return data.progress;
}

/** All of the current user's lesson-progress rows for a course (for resume + % done). */
export async function getCourseLessonProgress(courseId: string): Promise<LessonProgress[]> {
  const { data } = await api.get<{ items: LessonProgress[] }>(
    `/courses/${courseId}/lesson-progress`,
  );
  return data.items;
}

export async function upsertLessonProgress(
  lessonId: string,
  payload: { lastPositionSec: number; secondsWatched: number; completed?: boolean },
): Promise<LessonProgress> {
  const { data } = await api.put<{ progress: LessonProgress }>(
    `/lessons/${lessonId}/progress`,
    payload,
  );
  return data.progress;
}

/** Anti-AFK kick: reset this lesson's progress to the start (server-authoritative). */
export async function resetLessonProgressAfk(lessonId: string): Promise<LessonProgress> {
  const { data } = await api.post<{ progress: LessonProgress }>(
    `/lessons/${lessonId}/progress/afk-fail`,
    {},
  );
  return data.progress;
}

/** Log an attempt to skip/seek past the watched portion (anti-skip; for HR review). */
export async function logLessonSeekBlocked(lessonId: string): Promise<void> {
  await api.post(`/lessons/${lessonId}/progress/seek-blocked`, {});
}

// ─── lesson notes & bookmarks ─────────────────────────────────────────────────

export interface LessonNote {
  id: string;
  lessonId: string;
  userId: string;
  type: 'NOTE' | 'BOOKMARK';
  content: string;
  timestampSec: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function listLessonNotes(
  lessonId: string,
  type?: 'NOTE' | 'BOOKMARK',
): Promise<Paginated<LessonNote>> {
  const { data } = await api.get<Paginated<LessonNote>>(`/lessons/${lessonId}/notes`, {
    params: { type, pageSize: 100 },
  });
  return data;
}

export async function createLessonNote(
  lessonId: string,
  payload: { type: 'NOTE' | 'BOOKMARK'; content: string; timestampSec?: number },
): Promise<LessonNote> {
  const { data } = await api.post<{ note: LessonNote }>(`/lessons/${lessonId}/notes`, payload);
  return data.note;
}

export async function updateLessonNote(
  lessonId: string,
  noteId: string,
  content: string,
): Promise<LessonNote> {
  const { data } = await api.patch<{ note: LessonNote }>(
    `/lessons/${lessonId}/notes/${noteId}`,
    { content },
  );
  return data.note;
}

export async function deleteLessonNote(lessonId: string, noteId: string): Promise<void> {
  await api.delete(`/lessons/${lessonId}/notes/${noteId}`);
}

// ─── course Q&A ───────────────────────────────────────────────────────────────

export interface QAUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface CourseAnswer {
  id: string;
  questionId: string;
  userId: string;
  body: string;
  isAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  user: QAUser;
}

export interface CourseQuestion {
  id: string;
  courseId: string;
  userId: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  user: QAUser;
  _count: { answers: number };
  answers?: CourseAnswer[];
}

export async function listCourseQuestions(
  courseId: string,
  q?: string,
): Promise<Paginated<CourseQuestion>> {
  const { data } = await api.get<Paginated<CourseQuestion>>(
    `/courses/${courseId}/questions`,
    { params: { q, pageSize: 50 } },
  );
  return data;
}

export async function getCourseQuestion(
  courseId: string,
  questionId: string,
): Promise<CourseQuestion> {
  const { data } = await api.get<{ question: CourseQuestion }>(
    `/courses/${courseId}/questions/${questionId}`,
  );
  return data.question;
}

export async function createCourseQuestion(
  courseId: string,
  payload: { title: string; body: string },
): Promise<CourseQuestion> {
  const { data } = await api.post<{ question: CourseQuestion }>(
    `/courses/${courseId}/questions`,
    payload,
  );
  return data.question;
}

export async function deleteCourseQuestion(
  courseId: string,
  questionId: string,
): Promise<void> {
  await api.delete(`/courses/${courseId}/questions/${questionId}`);
}

export async function createCourseAnswer(
  courseId: string,
  questionId: string,
  body: string,
): Promise<CourseAnswer> {
  const { data } = await api.post<{ answer: CourseAnswer }>(
    `/courses/${courseId}/questions/${questionId}/answers`,
    { body },
  );
  return data.answer;
}

export async function acceptCourseAnswer(
  courseId: string,
  questionId: string,
  answerId: string,
): Promise<CourseAnswer> {
  const { data } = await api.patch<{ answer: CourseAnswer }>(
    `/courses/${courseId}/questions/${questionId}/answers/${answerId}/accept`,
  );
  return data.answer;
}

export async function deleteCourseAnswer(
  courseId: string,
  questionId: string,
  answerId: string,
): Promise<void> {
  await api.delete(`/courses/${courseId}/questions/${questionId}/answers/${answerId}`);
}
