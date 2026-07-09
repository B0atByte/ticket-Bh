import { api } from '../../lib/api';

export type PracticalEvalResult = 'PENDING' | 'PASSED' | 'FAILED';

export interface PracticalEvaluationCriterion {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
}

export interface PracticalEvaluationCriterionView {
  id: string;
  title: string;
  orderIndex: number;
  checked: boolean;
}

export interface PracticalEvaluation {
  enrollmentId: string;
  courseId: string;
  learnerId: string;
  result: PracticalEvalResult;
  starRating: number | null;
  comment: string | null;
  evaluatedById: string | null;
  evaluatedAt: string | null;
  criteria: PracticalEvaluationCriterionView[];
}

// ─── Criteria (admin) ──────────────────────────────────────────────────────

export async function listPracticalCriteria(courseId: string): Promise<PracticalEvaluationCriterion[]> {
  const { data } = await api.get<{ criteria: PracticalEvaluationCriterion[] }>(
    `/courses/${courseId}/practical-criteria`,
  );
  return data.criteria;
}

export async function createPracticalCriterion(
  courseId: string,
  title: string,
): Promise<PracticalEvaluationCriterion> {
  const { data } = await api.post<{ criterion: PracticalEvaluationCriterion }>(
    `/courses/${courseId}/practical-criteria`,
    { title },
  );
  return data.criterion;
}

export async function updatePracticalCriterion(
  id: string,
  title: string,
): Promise<PracticalEvaluationCriterion> {
  const { data } = await api.patch<{ criterion: PracticalEvaluationCriterion }>(
    `/practical-criteria/${id}`,
    { title },
  );
  return data.criterion;
}

export async function deletePracticalCriterion(id: string): Promise<void> {
  await api.delete(`/practical-criteria/${id}`);
}

export async function reorderPracticalCriteria(courseId: string, orderedIds: string[]): Promise<void> {
  await api.post(`/courses/${courseId}/practical-criteria/reorder`, { orderedIds });
}

// ─── Evaluation (instructor / admin grading) ───────────────────────────────

export async function getEnrollmentPracticalEvaluation(enrollmentId: string): Promise<PracticalEvaluation> {
  const { data } = await api.get<{ evaluation: PracticalEvaluation }>(
    `/enrollments/${enrollmentId}/practical-evaluation`,
  );
  return data.evaluation;
}

export interface SubmitPracticalEvaluationInput {
  result: PracticalEvalResult;
  starRating?: number | null;
  comment?: string;
  items: Array<{ criterionId: string; checked: boolean }>;
}

export async function submitPracticalEvaluation(
  enrollmentId: string,
  input: SubmitPracticalEvaluationInput,
): Promise<PracticalEvaluation> {
  const { data } = await api.put<{ evaluation: PracticalEvaluation }>(
    `/enrollments/${enrollmentId}/practical-evaluation`,
    input,
  );
  return data.evaluation;
}

// ─── Learner self view ──────────────────────────────────────────────────────

export async function getMyPracticalEvaluation(courseId: string): Promise<PracticalEvaluation> {
  const { data } = await api.get<{ evaluation: PracticalEvaluation }>(
    `/courses/${courseId}/practical-evaluation/me`,
  );
  return data.evaluation;
}
