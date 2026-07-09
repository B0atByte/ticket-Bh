import { describe, it, expect } from 'vitest';
import { gradeResponse, MANUAL_GRADE_TYPES, AUTO_GRADE_TYPES } from './grading.js';
import type { GradeContext } from './grading.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<GradeContext> = {}): GradeContext {
  return {
    type: 'SINGLE_CHOICE',
    points: 10,
    options: [],
    answers: [],
    questionMeta: null,
    ...overrides,
  };
}

// ─── SINGLE_CHOICE / TRUE_FALSE ──────────────────────────────────────────────

describe('SINGLE_CHOICE', () => {
  const ctx = makeCtx({
    type: 'SINGLE_CHOICE',
    points: 10,
    options: [
      { id: 'a', isCorrect: true, orderIndex: 0, meta: null },
      { id: 'b', isCorrect: false, orderIndex: 1, meta: null },
    ],
  });

  it('awards full points for correct answer', () => {
    const result = gradeResponse(ctx, ['a'], null, null);
    expect(result.pointsEarned).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('awards 0 for wrong answer', () => {
    const result = gradeResponse(ctx, ['b'], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it('awards 0 for empty selection', () => {
    const result = gradeResponse(ctx, [], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it('awards 0 for multiple selections (should pick one)', () => {
    const result = gradeResponse(ctx, ['a', 'b'], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });
});

describe('TRUE_FALSE', () => {
  const ctx = makeCtx({
    type: 'TRUE_FALSE',
    points: 5,
    options: [
      { id: 'true', isCorrect: true, orderIndex: 0, meta: null },
      { id: 'false', isCorrect: false, orderIndex: 1, meta: null },
    ],
  });

  it('awards full points for correct answer', () => {
    const result = gradeResponse(ctx, ['true'], null, null);
    expect(result.pointsEarned).toBe(5);
    expect(result.isCorrect).toBe(true);
  });

  it('awards 0 for wrong answer', () => {
    const result = gradeResponse(ctx, ['false'], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });
});

// ─── MULTIPLE_CHOICE ─────────────────────────────────────────────────────────

describe('MULTIPLE_CHOICE', () => {
  const ctx = makeCtx({
    type: 'MULTIPLE_CHOICE',
    points: 10,
    options: [
      { id: 'a', isCorrect: true, orderIndex: 0, meta: null },
      { id: 'b', isCorrect: true, orderIndex: 1, meta: null },
      { id: 'c', isCorrect: false, orderIndex: 2, meta: null },
    ],
  });

  it('awards full points for all correct selected', () => {
    const result = gradeResponse(ctx, ['a', 'b'], null, null);
    expect(result.pointsEarned).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('awards partial credit for one correct, no wrong', () => {
    const result = gradeResponse(ctx, ['a'], null, null);
    expect(result.pointsEarned).toBe(5);
    expect(result.isCorrect).toBe(false);
  });

  it('deducts for wrong selection', () => {
    const result = gradeResponse(ctx, ['a', 'c'], null, null);
    // (1 correct - 1 wrong) / 2 correct * 10 = 0
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it('never goes below 0 points', () => {
    const result = gradeResponse(ctx, ['c'], null, null);
    expect(result.pointsEarned).toBeGreaterThanOrEqual(0);
  });

  it('awards 0 for empty selection', () => {
    const result = gradeResponse(ctx, [], null, null);
    expect(result.pointsEarned).toBe(0);
  });
});

// ─── FILL_BLANK ──────────────────────────────────────────────────────────────

describe('FILL_BLANK', () => {
  it('EXACT match — case insensitive', () => {
    const ctx = makeCtx({
      type: 'FILL_BLANK',
      points: 5,
      answers: [{ value: 'Bangkok', matchMode: 'EXACT', caseSensitive: false, points: 5 }],
    });
    expect(gradeResponse(ctx, [], 'bangkok', null).isCorrect).toBe(true);
    expect(gradeResponse(ctx, [], 'BANGKOK', null).isCorrect).toBe(true);
    expect(gradeResponse(ctx, [], 'Chiang Mai', null).isCorrect).toBe(false);
  });

  it('EXACT match — case sensitive', () => {
    const ctx = makeCtx({
      type: 'FILL_BLANK',
      points: 5,
      answers: [{ value: 'Bangkok', matchMode: 'EXACT', caseSensitive: true, points: 5 }],
    });
    expect(gradeResponse(ctx, [], 'Bangkok', null).isCorrect).toBe(true);
    expect(gradeResponse(ctx, [], 'bangkok', null).isCorrect).toBe(false);
  });

  it('CONTAINS match', () => {
    const ctx = makeCtx({
      type: 'FILL_BLANK',
      points: 5,
      answers: [{ value: 'express', matchMode: 'CONTAINS', caseSensitive: false, points: 5 }],
    });
    expect(gradeResponse(ctx, [], 'I use Express.js', null).isCorrect).toBe(true);
    expect(gradeResponse(ctx, [], 'React only', null).isCorrect).toBe(false);
  });

  it('REGEX match', () => {
    const ctx = makeCtx({
      type: 'FILL_BLANK',
      points: 5,
      answers: [{ value: '^\\d{4}$', matchMode: 'REGEX', caseSensitive: false, points: 5 }],
    });
    expect(gradeResponse(ctx, [], '2024', null).isCorrect).toBe(true);
    expect(gradeResponse(ctx, [], 'abc', null).isCorrect).toBe(false);
  });

  it('KEYWORD match — whole word boundary', () => {
    const ctx = makeCtx({
      type: 'FILL_BLANK',
      points: 5,
      answers: [{ value: 'node', matchMode: 'KEYWORD', caseSensitive: false, points: 5 }],
    });
    expect(gradeResponse(ctx, [], 'I use Node.js', null).isCorrect).toBe(true);
    expect(gradeResponse(ctx, [], 'nodejs is great', null).isCorrect).toBe(false);
  });

  it('awards 0 for empty answer', () => {
    const ctx = makeCtx({
      type: 'FILL_BLANK',
      points: 5,
      answers: [{ value: 'test', matchMode: 'EXACT', caseSensitive: false, points: 5 }],
    });
    expect(gradeResponse(ctx, [], null, null).pointsEarned).toBe(0);
    expect(gradeResponse(ctx, [], '', null).pointsEarned).toBe(0);
  });

  it('caps points at ctx.points even if answer.points is higher', () => {
    const ctx = makeCtx({
      type: 'FILL_BLANK',
      points: 5,
      answers: [{ value: 'test', matchMode: 'EXACT', caseSensitive: false, points: 100 }],
    });
    expect(gradeResponse(ctx, [], 'test', null).pointsEarned).toBe(5);
  });
});

// ─── SHORT_ANSWER ─────────────────────────────────────────────────────────────

describe('SHORT_ANSWER', () => {
  it('awards partial credit for each matched keyword', () => {
    const ctx = makeCtx({
      type: 'SHORT_ANSWER',
      points: 10,
      answers: [
        { value: 'react', matchMode: 'KEYWORD', caseSensitive: false, points: 5 },
        { value: 'component', matchMode: 'KEYWORD', caseSensitive: false, points: 5 },
      ],
    });
    const result = gradeResponse(ctx, [], 'React uses component-based architecture', null);
    expect(result.pointsEarned).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('awards partial credit for one keyword matched', () => {
    const ctx = makeCtx({
      type: 'SHORT_ANSWER',
      points: 10,
      answers: [
        { value: 'react', matchMode: 'KEYWORD', caseSensitive: false, points: 5 },
        { value: 'component', matchMode: 'KEYWORD', caseSensitive: false, points: 5 },
      ],
    });
    const result = gradeResponse(ctx, [], 'I use React', null);
    expect(result.pointsEarned).toBe(5);
    expect(result.isCorrect).toBe(false);
  });

  it('awards 0 for no match', () => {
    const ctx = makeCtx({
      type: 'SHORT_ANSWER',
      points: 10,
      answers: [{ value: 'react', matchMode: 'KEYWORD', caseSensitive: false, points: 5 }],
    });
    expect(gradeResponse(ctx, [], 'Vue.js is great', null).pointsEarned).toBe(0);
  });
});

// ─── MATCHING ────────────────────────────────────────────────────────────────

describe('MATCHING', () => {
  const ctx = makeCtx({
    type: 'MATCHING',
    points: 10,
    questionMeta: {
      pairs: [
        { leftId: 'l1', rightId: 'r1' },
        { leftId: 'l2', rightId: 'r2' },
      ],
    },
  });

  it('awards full points for all correct pairs via responseMeta', () => {
    const meta = { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r2' }] };
    const result = gradeResponse(ctx, [], null, meta);
    expect(result.pointsEarned).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('awards partial credit for one correct pair', () => {
    const meta = { pairs: [{ leftId: 'l1', rightId: 'r1' }, { leftId: 'l2', rightId: 'r1' }] };
    const result = gradeResponse(ctx, [], null, meta);
    expect(result.pointsEarned).toBe(5);
    expect(result.isCorrect).toBe(false);
  });

  it('awards full points via interleaved selectedOptionIds fallback', () => {
    const result = gradeResponse(ctx, ['l1', 'r1', 'l2', 'r2'], null, null);
    expect(result.pointsEarned).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('returns null isCorrect when no correct pairs defined', () => {
    const emptyCtx = makeCtx({ type: 'MATCHING', questionMeta: { pairs: [] } });
    const result = gradeResponse(emptyCtx, [], null, null);
    expect(result.isCorrect).toBeNull();
  });
});

// ─── ORDERING ────────────────────────────────────────────────────────────────

describe('ORDERING', () => {
  const ctx = makeCtx({
    type: 'ORDERING',
    points: 10,
    questionMeta: { orderedIds: ['a', 'b', 'c'] },
  });

  it('awards full points for correct order', () => {
    const result = gradeResponse(ctx, ['a', 'b', 'c'], null, null);
    expect(result.pointsEarned).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('awards 0 for wrong order (all-or-nothing)', () => {
    const result = gradeResponse(ctx, ['a', 'c', 'b'], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it('awards 0 for empty selection', () => {
    const result = gradeResponse(ctx, [], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });
});

// ─── DRAG_DROP / HOTSPOT ─────────────────────────────────────────────────────

describe('DRAG_DROP', () => {
  const ctx = makeCtx({
    type: 'DRAG_DROP',
    points: 10,
    options: [
      { id: 'a', isCorrect: true, orderIndex: 0, meta: null },
      { id: 'b', isCorrect: true, orderIndex: 1, meta: null },
      { id: 'c', isCorrect: false, orderIndex: 2, meta: null },
    ],
  });

  it('awards full points for exactly correct selections', () => {
    const result = gradeResponse(ctx, ['a', 'b'], null, null);
    expect(result.pointsEarned).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('awards 0 for wrong selections', () => {
    const result = gradeResponse(ctx, ['a', 'c'], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBe(false);
  });
});

// ─── ESSAY / FILE_UPLOAD ─────────────────────────────────────────────────────

describe('ESSAY', () => {
  it('returns pending manual grading state', () => {
    const ctx = makeCtx({ type: 'ESSAY', points: 20 });
    const result = gradeResponse(ctx, [], 'My essay answer', null);
    expect(result.isCorrect).toBeNull();
    expect(result.pointsEarned).toBe(0);
    expect(result.feedback).toBe('Pending manual grading');
  });
});

describe('FILE_UPLOAD', () => {
  it('returns pending manual grading state', () => {
    const ctx = makeCtx({ type: 'FILE_UPLOAD', points: 20 });
    const result = gradeResponse(ctx, [], null, null);
    expect(result.isCorrect).toBeNull();
    expect(result.pointsEarned).toBe(0);
  });
});

// ─── LIKERT ──────────────────────────────────────────────────────────────────

describe('LIKERT', () => {
  it('always awards full points regardless of selection', () => {
    const ctx = makeCtx({ type: 'LIKERT', points: 5 });
    const result = gradeResponse(ctx, ['any'], null, null);
    expect(result.pointsEarned).toBe(5);
    expect(result.isCorrect).toBeNull();
  });

  it('awards full points even with empty selection', () => {
    const ctx = makeCtx({ type: 'LIKERT', points: 5 });
    const result = gradeResponse(ctx, [], null, null);
    expect(result.pointsEarned).toBe(5);
  });
});

// ─── unknown type ─────────────────────────────────────────────────────────────

describe('unknown type', () => {
  it('returns 0 points and null isCorrect', () => {
    const ctx = makeCtx({ type: 'UNKNOWN_TYPE', points: 10 });
    const result = gradeResponse(ctx, [], null, null);
    expect(result.pointsEarned).toBe(0);
    expect(result.isCorrect).toBeNull();
  });
});

// ─── MANUAL_GRADE_TYPES / AUTO_GRADE_TYPES sets ───────────────────────────────

describe('type sets', () => {
  it('MANUAL_GRADE_TYPES contains ESSAY and FILE_UPLOAD', () => {
    expect(MANUAL_GRADE_TYPES.has('ESSAY')).toBe(true);
    expect(MANUAL_GRADE_TYPES.has('FILE_UPLOAD')).toBe(true);
    expect(MANUAL_GRADE_TYPES.has('SINGLE_CHOICE')).toBe(false);
  });

  it('AUTO_GRADE_TYPES contains all auto-gradeable types', () => {
    const expected = [
      'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE',
      'FILL_BLANK', 'SHORT_ANSWER', 'MATCHING',
      'ORDERING', 'DRAG_DROP', 'HOTSPOT', 'LIKERT',
    ];
    for (const t of expected) {
      expect(AUTO_GRADE_TYPES.has(t)).toBe(true);
    }
  });
});
