import { api } from '../../lib/api';

export type QuestionType =
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
  | 'LIKERT';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
  imageUrl?: string | null;
}

export interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  difficulty: Difficulty;
  text: string;
  explanation?: string | null;
  defaultPoints: number;
  categoryId?: string | null;
  authorId?: string | null;
  options: QuestionOption[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionListResponse {
  items: Question[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface QuestionBank {
  id: string;
  name: string;
  description?: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Question Bank API ────────────────────────────────────────────────────────

export async function listBanks(): Promise<QuestionBank[]> {
  const { data } = await api.get<{ items: QuestionBank[] }>('/question-banks');
  return data.items;
}

export async function createBank(input: { name: string; description?: string }): Promise<QuestionBank> {
  const { data } = await api.post<{ bank: QuestionBank }>('/question-banks', input);
  return data.bank;
}

export async function updateBank(
  id: string,
  input: { name?: string; description?: string },
): Promise<QuestionBank> {
  const { data } = await api.patch<{ bank: QuestionBank }>(`/question-banks/${id}`, input);
  return data.bank;
}

export async function deleteBank(id: string): Promise<void> {
  await api.delete(`/question-banks/${id}`);
}

// ─── Question API ─────────────────────────────────────────────────────────────

export async function listQuestions(params?: {
  page?: number;
  pageSize?: number;
  bankId?: string;
  type?: QuestionType;
  q?: string;
}): Promise<QuestionListResponse> {
  const { data } = await api.get<QuestionListResponse>('/questions', { params });
  return data;
}

export async function getQuestion(id: string): Promise<Question> {
  const { data } = await api.get<{ question: Question }>(`/questions/${id}`);
  return data.question;
}

export interface CreateQuestionInput {
  bankId?: string;
  type: QuestionType;
  difficulty?: Difficulty;
  text: string;
  explanation?: string;
  defaultPoints?: number;
  options?: Array<{ text: string; isCorrect: boolean; orderIndex?: number }>;
}

export async function createQuestion(input: CreateQuestionInput): Promise<Question> {
  const { data } = await api.post<{ question: Question }>('/questions', input);
  return data.question;
}

export async function updateQuestion(
  id: string,
  input: Partial<CreateQuestionInput>,
): Promise<Question> {
  const { data } = await api.patch<{ question: Question }>(`/questions/${id}`, input);
  return data.question;
}

export async function deleteQuestion(id: string): Promise<void> {
  await api.delete(`/questions/${id}`);
}

export interface ImportPreviewRow {
  rowNumber: number;
  question?: CreateQuestionInput;
  errors: string[];
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  validCount: number;
  errorCount: number;
}

export async function previewQuestionImport(file: File): Promise<ImportPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ImportPreviewResult>('/questions/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function commitQuestionImport(
  bankId: string,
  questions: CreateQuestionInput[],
): Promise<{ count: number; items: Question[] }> {
  const { data } = await api.post<{ count: number; items: Question[] }>('/questions/import/commit', {
    bankId,
    questions,
  });
  return data;
}

export function questionImportTemplateUrl(): string {
  return '/api/v1/questions/import/template.csv';
}

export async function generateQuestionDrafts(input: {
  sourceText: string;
  count: number;
  difficulty: Difficulty;
}): Promise<{ questions: CreateQuestionInput[]; provider: 'deepseek' | 'openai' | 'local'; skipped?: number }> {
  const { data } = await api.post<{ questions: CreateQuestionInput[]; provider: 'deepseek' | 'openai' | 'local'; skipped?: number }>(
    '/questions/generate-drafts',
    input,
  );
  return data;
}

export async function parseQuestionText(rawText: string): Promise<{
  questions: CreateQuestionInput[];
  provider: 'deepseek' | 'openai' | 'local';
  skipped?: number;
}> {
  const { data } = await api.post<{ questions: CreateQuestionInput[]; provider: 'deepseek' | 'openai' | 'local'; skipped?: number }>(
    '/questions/parse-text',
    { rawText },
  );
  return data;
}

/** Generate question drafts from a whole course's lesson content. */
export async function generateFromCourse(input: {
  courseId: string;
  count: number;
  difficulty: Difficulty;
}): Promise<{ questions: CreateQuestionInput[]; provider: 'deepseek' | 'openai' | 'local'; skipped?: number }> {
  const { data } = await api.post<{ questions: CreateQuestionInput[]; provider: 'deepseek' | 'openai' | 'local'; skipped?: number }>(
    '/questions/generate-from-course',
    input,
  );
  return data;
}
