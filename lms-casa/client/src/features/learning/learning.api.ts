import { api } from '../../lib/api';
import type { PracticalEvalResult } from './practical-evaluations.api';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface CourseAuthorSummary {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface CourseCategorySummary {
  id: string;
  name: string;
  slug?: string | null;
}

export interface CourseListItem {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  coverImageUrl?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  estimatedMinutes?: number | null;
  passingScore?: number | null;
  antiAfkEnabled?: boolean;
  unlockNextCourseId?: string | null;
  author?: CourseAuthorSummary | null;
  category?: CourseCategorySummary | null;
  lessonCount?: number;
  _count: { modules: number; enrollments: number };
}

export interface LessonSummary {
  id: string;
  title: string;
  summary?: string | null;
  orderIndex: number;
  durationSeconds?: number | null;
  isRequired: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  lessons: LessonSummary[];
}

export interface CourseDetail extends Omit<CourseListItem, '_count'> {
  description?: string | null;
  visibility?: 'PUBLIC' | 'INTERNAL' | 'PRIVATE';
  modules: CourseModule[];
  _count: { enrollments: number; exams: number };
  /** True when this course is unlocked by another course → requires a code to enroll. */
  requiresUnlockCode?: boolean;
}

export interface LessonContent {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  url?: string | null;
  orderIndex: number;
}

export interface LessonDetail extends LessonSummary {
  contents: LessonContent[];
  courseId: string;
}

export type ExamType = 'QUIZ' | 'ASSESSMENT' | 'PRE_TEST' | 'POST_TEST' | 'CERTIFICATION' | 'SURVEY';

export interface ExamListItem {
  id: string;
  title: string;
  description?: string | null;
  courseId?: string | null;
  type: ExamType;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  timeLimitMinutes?: number | null;
  passingScore: number;
  maxAttempts?: number | null;
  _count: { questions: number; attempts: number };
}

export interface AttemptQuestionOption {
  id: string;
  text: string;
  imageUrl?: string | null;
  orderIndex: number;
  meta?: unknown;
}

export interface AttemptQuestion {
  examQuestionId: string;
  questionId: string;
  type:
    | 'SINGLE_CHOICE'
    | 'MULTIPLE_CHOICE'
    | 'TRUE_FALSE'
    | 'FILL_BLANK'
    | 'MATCHING'
    | 'ORDERING'
    | 'DRAG_DROP'
    | 'HOTSPOT'
    | 'SHORT_ANSWER'
    | 'ESSAY'
    | 'FILE_UPLOAD'
    | 'LIKERT'
    | string;
  difficulty: string;
  text: string;
  points: number;
  options: AttemptQuestionOption[];
}

export interface AttemptSummary {
  id: string;
  examId: string;
  attemptNumber: number;
  status: string;
  score?: number | null;
  maxScore?: number | null;
  scorePct?: string | number | null;
  passed?: boolean | null;
  expiresAt?: string | null;
}

export interface StartAttemptResponse {
  attempt: AttemptSummary;
  questions: AttemptQuestion[];
  /** When set, the exam runs one-question-at-a-time with this many seconds per question. */
  secondsPerQuestion?: number | null;
}

export interface SubmitAttemptResponse {
  attempt: AttemptSummary;
  hasPendingManual?: boolean;
  /** True when this failed attempt used up all tries and the course videos were reset. */
  videoProgressReset?: boolean;
  /** Code to unlock the next course, issued on passing (if a next course is configured). */
  unlockCode?: { code: string; courseId: string; courseTitle: string } | null;
  result: {
    score?: number | null;
    maxScore?: number | null;
    scorePct?: string | number | null;
    passed?: boolean | null;
  };
}

export type AntiCheatEventType =
  | 'TAB_BLUR'
  | 'TAB_FOCUS'
  | 'FULLSCREEN_EXIT'
  | 'FULLSCREEN_ENTER'
  | 'PASTE_DETECTED'
  | 'COPY_DETECTED'
  | 'VISIBILITY_HIDDEN'
  | 'VISIBILITY_VISIBLE'
  | 'WINDOW_BLUR'
  | 'WINDOW_FOCUS'
  | 'DEVTOOLS_OPEN'
  | 'RIGHT_CLICK'
  | 'CUSTOM';

export async function listCourses(params?: {
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  pageSize?: number;
}): Promise<Paginated<CourseListItem>> {
  const { data } = await api.get<Paginated<CourseListItem>>('/courses', {
    params: { status: params?.status ?? 'PUBLISHED', pageSize: params?.pageSize ?? 50 },
  });
  return data;
}

export async function listAllCourses(): Promise<Paginated<CourseListItem>> {
  const { data } = await api.get<Paginated<CourseListItem>>('/courses', {
    params: { pageSize: 100 },
  });
  return data;
}

export async function getCourse(id: string): Promise<CourseDetail> {
  const { data } = await api.get<{ course: CourseDetail }>(`/courses/${id}`);
  return data.course;
}

export interface CreateCourseInput {
  title: string;
  slug?: string; // optional — server auto-generates from the title when omitted
  summary?: string;
  description?: string;
  visibility?: 'PUBLIC' | 'INTERNAL' | 'PRIVATE';
  estimatedMinutes?: number;
  passingScore?: number;
  antiAfkEnabled?: boolean;
  unlockNextCourseId?: string | null;
  coverImageUrl?: string;
}

export async function createCourse(input: CreateCourseInput): Promise<CourseDetail> {
  const { data } = await api.post<{ course: CourseDetail }>('/courses', input);
  return data.course;
}

/** Upload a course cover image; returns the stored URL to save as coverImageUrl. */
export async function uploadCourseCover(file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post<{ url: string }>('/courses/cover', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

/** Upload a PDF lesson material; returns its served URL for use as content.url. */
export async function uploadLessonMaterial(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ url: string }>('/lessons/materials', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

export async function updateCourse(
  id: string,
  input: Partial<CreateCourseInput>,
): Promise<CourseDetail> {
  const { data } = await api.patch<{ course: CourseDetail }>(`/courses/${id}`, input);
  return data.course;
}

export async function deleteCourse(id: string): Promise<void> {
  await api.delete(`/courses/${id}`);
}

export async function publishCourse(id: string): Promise<CourseDetail> {
  const { data } = await api.post<{ course: CourseDetail }>(`/courses/${id}/publish`);
  return data.course;
}

export async function archiveCourse(id: string): Promise<CourseDetail> {
  const { data } = await api.post<{ course: CourseDetail }>(`/courses/${id}/archive`);
  return data.course;
}

export async function createModule(
  courseId: string,
  input: { title: string; description?: string },
): Promise<CourseModule> {
  const { data } = await api.post<{ module: CourseModule }>(
    `/courses/${courseId}/modules`,
    input,
  );
  return data.module;
}

export async function updateModule(
  id: string,
  input: { title?: string; description?: string },
): Promise<CourseModule> {
  const { data } = await api.patch<{ module: CourseModule }>(`/modules/${id}`, input);
  return data.module;
}

export async function deleteModule(id: string): Promise<void> {
  await api.delete(`/modules/${id}`);
}

export async function createLesson(
  moduleId: string,
  input: { title: string; summary?: string; durationSeconds?: number },
): Promise<LessonSummary> {
  const { data } = await api.post<{ lesson: LessonSummary }>(
    `/modules/${moduleId}/lessons`,
    input,
  );
  return data.lesson;
}

export async function updateLesson(
  id: string,
  input: { title?: string; summary?: string; durationSeconds?: number },
): Promise<LessonSummary> {
  const { data } = await api.patch<{ lesson: LessonSummary }>(`/lessons/${id}`, input);
  return data.lesson;
}

export async function deleteLesson(id: string): Promise<void> {
  await api.delete(`/lessons/${id}`);
}

export async function getLesson(id: string): Promise<LessonDetail> {
  const { data } = await api.get<{ lesson: LessonDetail }>(`/lessons/${id}`);
  return data.lesson;
}

export type LessonContentType = 'TEXT' | 'HTML' | 'VIDEO' | 'PDF' | 'SLIDES' | 'AUDIO' | 'LINK' | 'SCORM';

export async function addLessonContent(
  lessonId: string,
  input: {
    type: LessonContentType;
    title?: string;
    body?: string;
    url?: string;
  },
): Promise<LessonContent> {
  const { data } = await api.post<{ content: LessonContent }>(
    `/lessons/${lessonId}/contents`,
    input,
  );
  return data.content;
}

export async function removeLessonContent(lessonId: string, contentId: string): Promise<void> {
  await api.delete(`/lessons/${lessonId}/contents/${contentId}`);
}

export async function listExams(courseId?: string): Promise<Paginated<ExamListItem>> {
  const { data } = await api.get<Paginated<ExamListItem>>('/exams', {
    params: { status: 'PUBLISHED', courseId, pageSize: 50 },
  });
  return data;
}

export async function startAttempt(examId: string): Promise<StartAttemptResponse> {
  const { data } = await api.post<StartAttemptResponse>(`/exams/${examId}/attempts`);
  return data;
}

export async function saveAttemptResponse(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
  textAnswer?: string,
  meta?: unknown,
): Promise<void> {
  await api.post(`/attempts/${attemptId}/responses`, {
    questionId,
    selectedOptionIds,
    textAnswer,
    meta,
  });
}

export async function submitAttempt(attemptId: string): Promise<SubmitAttemptResponse> {
  const { data } = await api.post<SubmitAttemptResponse>(`/attempts/${attemptId}/submit`);
  return data;
}

export async function logAntiCheatEvent(
  attemptId: string,
  type: AntiCheatEventType,
  payload?: Record<string, unknown>,
): Promise<void> {
  await api.post(`/attempts/${attemptId}/events`, { type, payload });
}

export async function listAttempts(examId?: string): Promise<Paginated<AttemptSummary>> {
  const { data } = await api.get<Paginated<AttemptSummary>>('/attempts', {
    params: { examId, pageSize: 50 },
  });
  return data;
}

export async function reorderModules(courseId: string, orderedIds: string[]): Promise<void> {
  await api.post(`/courses/${courseId}/modules/reorder`, { orderedIds });
}

export async function reorderLessons(moduleId: string, orderedIds: string[]): Promise<void> {
  await api.post(`/modules/${moduleId}/lessons/reorder`, { orderedIds });
}

// ─── Enrollments ─────────────────────────────────────────────────────────────

export type EnrollmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'WITHDRAWN';

export interface EnrollmentItem {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  progressPct: number;
  enrolledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  dueAt?: string | null;
  assignedById?: string | null;
}

export interface EnrollmentWithUser extends EnrollmentItem {
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null };
  starStatus: CourseStarStatus;
  hasPostTest: boolean;
  postTestAttempts: number;
  manualStarGranted: boolean;
  hasPracticalEval: boolean;
  practicalResult: PracticalEvalResult | null;
}

export interface EnrollmentWithCourse extends EnrollmentItem {
  course: { id: string; title: string; slug: string; summary?: string | null; estimatedMinutes?: number | null; status: string };
}

export async function selfEnroll(courseId: string): Promise<EnrollmentItem> {
  const { data } = await api.post<{ enrollment: EnrollmentItem }>(`/courses/${courseId}/enrollments/enroll`);
  return data.enrollment;
}

export async function selfUnenroll(courseId: string): Promise<void> {
  await api.delete(`/courses/${courseId}/enrollments/enroll`);
}

/** Redeem an unlock code → enrolls in the unlocked course. */
export async function redeemUnlockCode(code: string): Promise<{ courseId: string; courseTitle: string }> {
  // Small deliberate delay so the "verifying…" state is visible (feels like a real check).
  const [{ data }] = await Promise.all([
    api.post<{ courseId: string; courseTitle: string }>('/enrollments/redeem-code', { code }),
    new Promise((r) => setTimeout(r, 700)),
  ]);
  return data;
}

/** Admin: (re)issue an unlock code for a learner + course. */
export async function issueUnlockCode(targetUserId: string, courseId: string): Promise<{ code: string; courseTitle: string }> {
  const { data } = await api.post<{ code: string; courseId: string; courseTitle: string }>(
    '/enrollments/issue-code',
    { userId: targetUserId, courseId },
  );
  return data;
}

export async function getMyEnrollment(courseId: string): Promise<EnrollmentItem | null> {
  const { data } = await api.get<{ enrollment: EnrollmentItem | null }>(`/courses/${courseId}/enrollments/enroll/me`);
  return data.enrollment;
}

export async function listMyEnrollments(): Promise<Paginated<EnrollmentWithCourse>> {
  const { data } = await api.get<Paginated<EnrollmentWithCourse>>('/enrollments/mine');
  return data;
}

export type CourseStarStatus = 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'NOT_STARTED';

export interface CourseProgressEntry {
  courseId: string;
  status: CourseStarStatus;
  progressPct: number;
  hasPostTest: boolean;
  postTestAttempts: number;
  hasPracticalEval: boolean;
  practicalResult: PracticalEvalResult | null;
}

/** Per-course star status for the current learner + total stars earned. */
export async function getMyCourseProgress(): Promise<{ items: CourseProgressEntry[]; stars: number }> {
  const { data } = await api.get<{ items: CourseProgressEntry[]; stars: number }>('/me/course-progress');
  return data;
}

export async function listCourseEnrollments(courseId: string): Promise<Paginated<EnrollmentWithUser>> {
  const { data } = await api.get<Paginated<EnrollmentWithUser>>(`/courses/${courseId}/enrollments`);
  return data;
}

export async function adminAssignEnrollment(courseId: string, userId: string, dueAt?: string): Promise<EnrollmentItem> {
  const { data } = await api.post<{ enrollment: EnrollmentItem }>(`/courses/${courseId}/enrollments`, { userId, dueAt });
  return data.enrollment;
}

export async function adminUpdateEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus): Promise<EnrollmentItem> {
  const { data } = await api.patch<{ enrollment: EnrollmentItem }>(`/enrollments/${enrollmentId}/status`, { status });
  return data.enrollment;
}

export async function adminWithdrawEnrollment(enrollmentId: string): Promise<void> {
  await api.delete(`/enrollments/${enrollmentId}`);
}

/** SUPER_ADMIN: manually grant the course star to a learner. */
export async function grantEnrollmentStar(enrollmentId: string): Promise<void> {
  await api.post(`/enrollments/${enrollmentId}/grant-star`);
}

/** SUPER_ADMIN: revoke a manually-granted star. */
export async function revokeEnrollmentStar(enrollmentId: string): Promise<void> {
  await api.delete(`/enrollments/${enrollmentId}/grant-star`);
}
