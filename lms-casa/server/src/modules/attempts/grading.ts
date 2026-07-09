/**
 * Phase 2 — Advanced Assessment grading engine
 *
 * Supports: SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE (existing),
 *           FILL_BLANK, MATCHING, ORDERING, DRAG_DROP, HOTSPOT,
 *           SHORT_ANSWER, ESSAY, FILE_UPLOAD, LIKERT
 *
 * Rules:
 *  - All grading is server-side; client sends raw answers only.
 *  - ESSAY / FILE_UPLOAD → pending manual grading (isCorrect = null, pointsEarned = null).
 *  - LIKERT → always "correct" (survey), full points awarded.
 *  - Partial credit: SHORT_ANSWER keyword matching, MULTIPLE_CHOICE proportional.
 */

export interface GradeContext {
  type: string;
  points: number;
  /** QuestionOption rows (id as string, isCorrect, meta, orderIndex) */
  options: Array<{
    id: string;
    isCorrect: boolean;
    orderIndex: number;
    meta: unknown;
  }>;
  /** QuestionAnswer rows (value, matchMode, caseSensitive, points) */
  answers: Array<{
    value: string;
    matchMode: string;
    caseSensitive: boolean;
    points: number;
  }>;
  /** meta from Question row (e.g. matching pairs, regex) */
  questionMeta: unknown;
}

export interface GradeResult {
  pointsEarned: number;
  isCorrect: boolean | null; // null = pending manual grading
  feedback: string | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

function matchAnswer(
  userText: string,
  expected: string,
  matchMode: string,
  caseSensitive: boolean,
): boolean {
  const u = caseSensitive ? userText.trim() : userText.trim().toLowerCase();
  const e = caseSensitive ? expected.trim() : expected.trim().toLowerCase();

  switch (matchMode) {
    case 'EXACT':
      return u === e;
    case 'CONTAINS':
      return u.includes(e);
    case 'REGEX': {
      try {
        const flags = caseSensitive ? '' : 'i';
        return new RegExp(expected.trim(), flags).test(userText.trim());
      } catch {
        return false;
      }
    }
    case 'KEYWORD':
      // keyword: user answer must contain the keyword as a whole word
      try {
        const flags = caseSensitive ? '' : 'i';
        const escaped = expected.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, flags).test(userText.trim());
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// ─── per-type graders ────────────────────────────────────────────────────────

function gradeSingleChoice(ctx: GradeContext, selectedIds: string[]): GradeResult {
  const correctSet = new Set(ctx.options.filter((o) => o.isCorrect).map((o) => o.id));
  const isCorrect = selectedIds.length === 1 && correctSet.has(selectedIds[0] ?? '');
  return { pointsEarned: isCorrect ? ctx.points : 0, isCorrect, feedback: null };
}

function gradeMultipleChoice(ctx: GradeContext, selectedIds: string[]): GradeResult {
  const correctSet = new Set(ctx.options.filter((o) => o.isCorrect).map((o) => o.id));
  const totalCorrect = correctSet.size;
  if (totalCorrect === 0) return { pointsEarned: 0, isCorrect: false, feedback: null };

  const correctSelected = selectedIds.filter((id) => correctSet.has(id)).length;
  const wrongSelected = selectedIds.filter((id) => !correctSet.has(id)).length;
  const raw = Math.max(0, ((correctSelected - wrongSelected) / totalCorrect) * ctx.points);
  const pointsEarned = Math.round(raw * 100) / 100;
  return { pointsEarned, isCorrect: pointsEarned === ctx.points, feedback: null };
}

function gradeFillBlank(ctx: GradeContext, textAnswer: string | null | undefined): GradeResult {
  if (!textAnswer) return { pointsEarned: 0, isCorrect: false, feedback: null };

  // Try each QuestionAnswer row; take the first match
  for (const ans of ctx.answers) {
    if (matchAnswer(textAnswer, ans.value, ans.matchMode, ans.caseSensitive)) {
      const pointsEarned = Math.min(ans.points, ctx.points);
      return { pointsEarned, isCorrect: pointsEarned >= ctx.points, feedback: null };
    }
  }
  return { pointsEarned: 0, isCorrect: false, feedback: null };
}

function gradeShortAnswer(ctx: GradeContext, textAnswer: string | null | undefined): GradeResult {
  if (!textAnswer) return { pointsEarned: 0, isCorrect: false, feedback: null };

  // Partial credit: sum points for each matched keyword answer (capped at ctx.points)
  let earned = 0;
  for (const ans of ctx.answers) {
    if (matchAnswer(textAnswer, ans.value, ans.matchMode, ans.caseSensitive)) {
      earned += ans.points;
    }
  }
  const pointsEarned = Math.min(Math.round(earned * 100) / 100, ctx.points);
  return { pointsEarned, isCorrect: pointsEarned >= ctx.points, feedback: null };
}

/**
 * MATCHING — meta on Question: { pairs: [{ leftId: string, rightId: string }] }
 * selectedOptionIds encodes user's mapping as alternating [leftId, rightId, leftId, rightId, ...]
 * OR meta on AttemptResponse: { pairs: [{ leftId, rightId }] }
 *
 * We accept both formats; prefer responseMeta.pairs if present.
 */
function gradeMatching(
  ctx: GradeContext,
  selectedIds: string[],
  responseMeta: unknown,
): GradeResult {
  // Build correct pairs from question meta
  const qMeta = ctx.questionMeta as Record<string, unknown> | null | undefined;
  const correctPairs: Array<{ leftId: string; rightId: string }> = Array.isArray(qMeta?.['pairs'])
    ? (qMeta['pairs'] as Array<{ leftId: string; rightId: string }>)
    : [];

  if (correctPairs.length === 0) return { pointsEarned: 0, isCorrect: null, feedback: null };

  // Parse user pairs
  let userPairs: Array<{ leftId: string; rightId: string }> = [];
  const rMeta = responseMeta as Record<string, unknown> | null | undefined;
  if (Array.isArray(rMeta?.['pairs'])) {
    userPairs = rMeta['pairs'] as Array<{ leftId: string; rightId: string }>;
  } else {
    // fallback: interleaved selectedOptionIds [l0, r0, l1, r1, ...]
    for (let i = 0; i + 1 < selectedIds.length; i += 2) {
      userPairs.push({ leftId: selectedIds[i] ?? '', rightId: selectedIds[i + 1] ?? '' });
    }
  }

  const correctMap = new Map(correctPairs.map((p) => [p.leftId, p.rightId]));
  let matched = 0;
  for (const up of userPairs) {
    if (correctMap.get(up.leftId) === up.rightId) matched++;
  }

  const pointsEarned = Math.round(((matched / correctPairs.length) * ctx.points) * 100) / 100;
  return { pointsEarned, isCorrect: matched === correctPairs.length, feedback: null };
}

/**
 * ORDERING — meta on Question: { orderedIds: string[] } (correct order of option ids)
 * selectedOptionIds = user's submitted order of option ids
 */
function gradeOrdering(ctx: GradeContext, selectedIds: string[]): GradeResult {
  const qMeta = ctx.questionMeta as Record<string, unknown> | null | undefined;
  const correctOrder: string[] = Array.isArray(qMeta?.['orderedIds'])
    ? (qMeta['orderedIds'] as string[])
    : ctx.options.sort((a, b) => a.orderIndex - b.orderIndex).map((o) => o.id);

  if (correctOrder.length === 0) return { pointsEarned: 0, isCorrect: null, feedback: null };

  let correct = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    if (selectedIds[i] === correctOrder[i]) correct++;
  }

  const isCorrect = correct === correctOrder.length;
  const pointsEarned = isCorrect ? ctx.points : 0; // all-or-nothing for ordering
  return { pointsEarned, isCorrect, feedback: null };
}

/**
 * DRAG_DROP / HOTSPOT — stored in responseMeta.coords or selectedOptionIds
 * Graded by matching option ids that are marked isCorrect.
 */
function gradeDragDropOrHotspot(ctx: GradeContext, selectedIds: string[]): GradeResult {
  const correctSet = new Set(ctx.options.filter((o) => o.isCorrect).map((o) => o.id));
  if (correctSet.size === 0) return { pointsEarned: 0, isCorrect: null, feedback: null };

  const correctSelected = selectedIds.filter((id) => correctSet.has(id)).length;
  const isCorrect = correctSelected === correctSet.size && selectedIds.length === correctSet.size;
  return { pointsEarned: isCorrect ? ctx.points : 0, isCorrect, feedback: null };
}

// ─── main export ─────────────────────────────────────────────────────────────

export function gradeResponse(
  ctx: GradeContext,
  selectedOptionIds: unknown,
  textAnswer: string | null | undefined,
  responseMeta: unknown,
): GradeResult {
  const selectedIds = toStringArray(selectedOptionIds);

  switch (ctx.type) {
    case 'SINGLE_CHOICE':
    case 'TRUE_FALSE':
      return gradeSingleChoice(ctx, selectedIds);

    case 'MULTIPLE_CHOICE':
      return gradeMultipleChoice(ctx, selectedIds);

    case 'FILL_BLANK':
      return gradeFillBlank(ctx, textAnswer);

    case 'SHORT_ANSWER':
      return gradeShortAnswer(ctx, textAnswer);

    case 'MATCHING':
      return gradeMatching(ctx, selectedIds, responseMeta);

    case 'ORDERING':
      return gradeOrdering(ctx, selectedIds);

    case 'DRAG_DROP':
    case 'HOTSPOT':
      return gradeDragDropOrHotspot(ctx, selectedIds);

    case 'ESSAY':
    case 'FILE_UPLOAD':
      // Pending manual grading — return null so submit() skips auto-score
      return { pointsEarned: 0, isCorrect: null, feedback: 'Pending manual grading' };

    case 'LIKERT':
      // Survey — always full points, no right/wrong
      return { pointsEarned: ctx.points, isCorrect: null, feedback: null };

    default:
      return { pointsEarned: 0, isCorrect: null, feedback: null };
  }
}

/** Types that require manual grading (essay queue) */
export const MANUAL_GRADE_TYPES = new Set(['ESSAY', 'FILE_UPLOAD']);

/** Types that are auto-gradeable */
export const AUTO_GRADE_TYPES = new Set([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
  'MATCHING',
  'ORDERING',
  'DRAG_DROP',
  'HOTSPOT',
  'LIKERT',
]);
