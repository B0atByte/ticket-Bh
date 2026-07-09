import { api } from '../../lib/api';

export type ExamType = 'QUIZ' | 'ASSESSMENT' | 'PRE_TEST' | 'POST_TEST' | 'CERTIFICATION' | 'SURVEY';
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ExamQuestionRef {
  id: string;
  questionId: string;
  points: number;
  orderIndex: number;
  question?: {
    id: string;
    type: string;
    text: string;
    difficulty: string;
  };
}

export interface ExamDetail {
  id: string;
  title: string;
  description?: string | null;
  courseId?: string | null;
  type: ExamType;
  status: ExamStatus;
  passingScore: number;
  timeLimitMinutes?: number | null;
  secondsPerQuestion?: number | null;
  maxAttempts?: number | null;
  cooldownMinutes?: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  randomFromBankId?: string | null;
  randomCount?: number | null;
  questions?: ExamQuestionRef[];
  _count?: { questions: number; attempts: number };
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface CreateExamInput {
  title: string;
  description?: string;
  courseId?: string;
  type?: ExamType;
  timeLimitMinutes?: number;
  secondsPerQuestion?: number;
  passingScore?: number;
  maxAttempts?: number;
  cooldownMinutes?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  randomFromBankId?: string;
  randomCount?: number;
}

export async function listAllExams(): Promise<{ items: ExamDetail[]; meta: { total: number } }> {
  const { data } = await api.get<{ items: ExamDetail[]; meta: { total: number } }>('/exams', {
    params: { pageSize: 100 },
  });
  return data;
}

export async function getExam(id: string): Promise<ExamDetail> {
  const { data } = await api.get<{ exam: ExamDetail }>(`/exams/${id}`);
  return data.exam;
}

export async function createExam(input: CreateExamInput): Promise<ExamDetail> {
  const { data } = await api.post<{ exam: ExamDetail }>('/exams', input);
  return data.exam;
}

export async function updateExam(id: string, input: Partial<CreateExamInput>): Promise<ExamDetail> {
  const { data } = await api.patch<{ exam: ExamDetail }>(`/exams/${id}`, input);
  return data.exam;
}

export async function publishExam(id: string): Promise<ExamDetail> {
  const { data } = await api.post<{ exam: ExamDetail }>(`/exams/${id}/publish`);
  return data.exam;
}

export async function archiveExam(id: string): Promise<ExamDetail> {
  const { data } = await api.post<{ exam: ExamDetail }>(`/exams/${id}/archive`);
  return data.exam;
}

export async function deleteExam(id: string): Promise<void> {
  await api.delete(`/exams/${id}`);
}

export async function assignQuestion(
  examId: string,
  questionId: string,
  points = 1,
): Promise<void> {
  await api.post(`/exams/${examId}/questions`, { questionId, points });
}
