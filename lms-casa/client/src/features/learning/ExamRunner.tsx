/**
 * Phase 2 — ExamRunner
 * Supports: SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, FILL_BLANK,
 *           MATCHING, ORDERING, SHORT_ANSWER, ESSAY, FILE_UPLOAD, LIKERT,
 *           DRAG_DROP, HOTSPOT (fallback to option list)
 * Features: countdown timer, auto-submit on expire, anti-cheat event logging
 */
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { confirmAction } from '../../lib/confirm';
import {
  logAntiCheatEvent,
  saveAttemptResponse,
  submitAttempt,
  type AntiCheatEventType,
  type AttemptQuestion,
  type StartAttemptResponse,
  type SubmitAttemptResponse,
} from './learning.api';

// ─── types ────────────────────────────────────────────────────────────────────

interface ExamRunnerProps {
  session: StartAttemptResponse;
  onResult: (result: SubmitAttemptResponse) => void;
}

/** Per-question answer state */
interface AnswerState {
  selectedIds: string[];
  textAnswer: string;
  /** For MATCHING: { leftId → rightId } */
  matchPairs: Record<string, string>;
  /** For ORDERING: ordered list of option ids */
  orderedIds: string[];
  /** For LIKERT: selected scale value */
  likertValue: string;
}

function emptyAnswer(): AnswerState {
  return { selectedIds: [], textAnswer: '', matchPairs: {}, orderedIds: [], likertValue: '' };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatSeconds(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isAnswered(q: AttemptQuestion, ans: AnswerState): boolean {
  switch (q.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
    case 'DRAG_DROP':
    case 'HOTSPOT':
      return ans.selectedIds.length > 0;
    case 'FILL_BLANK':
    case 'SHORT_ANSWER':
    case 'ESSAY':
      return ans.textAnswer.trim().length > 0;
    case 'MATCHING':
      return Object.keys(ans.matchPairs).length > 0;
    case 'ORDERING':
      return ans.orderedIds.length > 0;
    case 'LIKERT':
      return ans.likertValue !== '';
    case 'FILE_UPLOAD':
      return ans.selectedIds.length > 0; // file id stored in selectedIds after upload
    default:
      return ans.selectedIds.length > 0 || ans.textAnswer.trim().length > 0;
  }
}

function buildResponsePayload(q: AttemptQuestion, ans: AnswerState) {
  switch (q.type) {
    case 'MATCHING':
      return {
        selectedOptionIds: [],
        textAnswer: undefined,
        meta: { pairs: Object.entries(ans.matchPairs).map(([leftId, rightId]) => ({ leftId, rightId })) },
      };
    case 'ORDERING':
      return {
        selectedOptionIds: ans.orderedIds,
        textAnswer: undefined,
        meta: undefined,
      };
    case 'FILL_BLANK':
    case 'SHORT_ANSWER':
    case 'ESSAY':
      return {
        selectedOptionIds: [],
        textAnswer: ans.textAnswer,
        meta: undefined,
      };
    case 'LIKERT':
      return {
        selectedOptionIds: [ans.likertValue],
        textAnswer: ans.likertValue,
        meta: undefined,
      };
    default:
      return {
        selectedOptionIds: ans.selectedIds,
        textAnswer: undefined,
        meta: undefined,
      };
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ChoiceQuestion({
  question,
  ans,
  onChange,
}: {
  question: AttemptQuestion;
  ans: AnswerState;
  onChange: (next: Partial<AnswerState>) => void;
}) {
  const multiple = question.type === 'MULTIPLE_CHOICE';
  function toggle(optionId: string) {
    if (!multiple) {
      onChange({ selectedIds: [optionId] });
      return;
    }
    const cur = ans.selectedIds;
    onChange({
      selectedIds: cur.includes(optionId)
        ? cur.filter((id) => id !== optionId)
        : [...cur, optionId],
    });
  }
  return (
    <div className="space-y-2" role="group" aria-label={question.text}>
      {question.options.map((opt) => {
        const active = ans.selectedIds.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={active}
            className={[
              'flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left text-sm transition-colors',
              active ? 'border-primary bg-primary/10' : 'bg-background hover:bg-accent',
            ].join(' ')}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
              aria-hidden="true"
            >
              {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
            </span>
            <span>{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function TextQuestion({
  question,
  ans,
  onChange,
}: {
  question: AttemptQuestion;
  ans: AnswerState;
  onChange: (next: Partial<AnswerState>) => void;
}) {
  const { t } = useTranslation();
  const isEssay = question.type === 'ESSAY';
  return isEssay ? (
    <textarea
      className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      rows={6}
      placeholder={t('exam.essayPlaceholder')}
      value={ans.textAnswer}
      onChange={(e) => onChange({ textAnswer: e.target.value })}
      aria-label={t('exam.essayPlaceholder')}
    />
  ) : (
    <Input
      placeholder={question.type === 'FILL_BLANK' ? t('exam.fillBlankPlaceholder') : t('exam.shortAnswerPlaceholder')}
      value={ans.textAnswer}
      onChange={(e) => onChange({ textAnswer: e.target.value })}
      aria-label={t('exam.shortAnswerPlaceholder')}
    />
  );
}

function MatchingQuestion({
  question,
  ans,
  onChange,
}: {
  question: AttemptQuestion;
  ans: AnswerState;
  onChange: (next: Partial<AnswerState>) => void;
}) {
  // Split options into left (even index) and right (odd index) by convention
  // In practice, question.meta.pairs defines the correct mapping;
  // here we just show all options as a left→right selector.
  const { t } = useTranslation();
  const leftOptions = question.options.filter((_, i) => i % 2 === 0);
  const rightOptions = question.options.filter((_, i) => i % 2 === 1);

  function setMatch(leftId: string, rightId: string) {
    onChange({ matchPairs: { ...ans.matchPairs, [leftId]: rightId } });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('exam.matchingHint')}</p>
      {leftOptions.map((left) => (
        <div key={left.id} className="flex items-center gap-3">
          <span className="w-1/2 rounded-md border bg-secondary px-3 py-2 text-sm">{left.text}</span>
          <select
            className="w-1/2 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={ans.matchPairs[left.id] ?? ''}
            onChange={(e) => setMatch(left.id, e.target.value)}
            aria-label={`Match for: ${left.text}`}
          >
            <option value="">— select —</option>
            {rightOptions.map((right) => (
              <option key={right.id} value={right.id}>
                {right.text}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function OrderingQuestion({
  question,
  ans,
  onChange,
}: {
  question: AttemptQuestion;
  ans: AnswerState;
  onChange: (next: Partial<AnswerState>) => void;
}) {
  // Initialize orderedIds from options if not yet set
  const ordered = ans.orderedIds.length > 0
    ? ans.orderedIds
    : question.options.map((o) => o.id);

  const { t } = useTranslation();
  const optionMap = useMemo(
    () => Object.fromEntries(question.options.map((o) => [o.id, o.text])),
    [question.options],
  );

  function move(index: number, direction: -1 | 1) {
    const next = [...ordered];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    onChange({ orderedIds: next });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('exam.orderingHint')}</p>
      {ordered.map((id, idx) => (
        <div key={id} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
          <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">{idx + 1}</span>
          <span className="flex-1">{optionMap[id] ?? id}</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="rounded px-1 py-0.5 text-xs hover:bg-accent disabled:opacity-30"
              aria-label="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={idx === ordered.length - 1}
              className="rounded px-1 py-0.5 text-xs hover:bg-accent disabled:opacity-30"
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LikertQuestion({
  question,
  ans,
  onChange,
}: {
  question: AttemptQuestion;
  ans: AnswerState;
  onChange: (next: Partial<AnswerState>) => void;
}) {
  const scale = question.options.length > 0
    ? question.options
    : [1, 2, 3, 4, 5].map((n) => ({ id: String(n), text: String(n), imageUrl: null, orderIndex: n }));

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Rating scale">
      {scale.map((opt) => {
        const active = ans.likertValue === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange({ likertValue: opt.id })}
            aria-pressed={active}
            className={[
              'min-w-[2.5rem] rounded-md border px-3 py-2 text-sm font-medium transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
            ].join(' ')}
          >
            {opt.text}
          </button>
        );
      })}
    </div>
  );
}

function QuestionBody({
  question,
  ans,
  onChange,
}: {
  question: AttemptQuestion;
  ans: AnswerState;
  onChange: (next: Partial<AnswerState>) => void;
}) {
  const { t } = useTranslation();
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
    case 'DRAG_DROP':
    case 'HOTSPOT':
      return <ChoiceQuestion question={question} ans={ans} onChange={onChange} />;
    case 'FILL_BLANK':
    case 'SHORT_ANSWER':
    case 'ESSAY':
      return <TextQuestion question={question} ans={ans} onChange={onChange} />;
    case 'MATCHING':
      return <MatchingQuestion question={question} ans={ans} onChange={onChange} />;
    case 'ORDERING':
      return <OrderingQuestion question={question} ans={ans} onChange={onChange} />;
    case 'LIKERT':
      return <LikertQuestion question={question} ans={ans} onChange={onChange} />;
    case 'FILE_UPLOAD':
      return <p className="text-sm text-muted-foreground">{t('exam.fileUploadSoon')}</p>;
    default:
      return <ChoiceQuestion question={question} ans={ans} onChange={onChange} />;
  }
}

// ─── main component ───────────────────────────────────────────────────────────

export function ExamRunner({ session, onResult }: ExamRunnerProps) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [antiCheatWarnings, setAntiCheatWarnings] = useState(0);
  const autoSubmitRef = useRef(false);

  function jumpToQuestion(index: number) {
    document.getElementById(`exam-q-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── countdown timer ──────────────────────────────────────────────────────
  const expiresAt = session.attempt.expiresAt ? new Date(session.attempt.expiresAt).getTime() : null;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : null,
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Only save questions the user actually answered.
      // Saving empty responses for every question wastes a mutation-rate-limit slot.
      for (const question of session.questions) {
        const ans = answers[question.questionId] ?? emptyAnswer();
        if (!isAnswered(question, ans)) continue;
        const payload = buildResponsePayload(question, ans);
        await saveAttemptResponse(
          session.attempt.id,
          question.questionId,
          payload.selectedOptionIds,
          payload.textAnswer,
          payload.meta,
        );
      }
      return submitAttempt(session.attempt.id);
    },
    onSuccess: onResult,
  });

  function submitErrorText(error: unknown): string {
    if (error instanceof AxiosError) {
      const serverMessage = error.response?.data?.error?.message;
      if (serverMessage) return `${serverMessage} (HTTP ${error.response?.status})`;
      if (error.code === 'ERR_NETWORK') {
        return 'เชื่อมต่อ API ไม่ได้ — กด Ctrl+Shift+R เพื่อรีเฟรช หรือเช็ค backend ที่ localhost:4000';
      }
      return `${error.message} (HTTP ${error.response?.status ?? '?'})`;
    }
    return 'ส่งคำตอบล้มเหลว — กรุณาลองอีกครั้ง';
  }

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0 && !autoSubmitRef.current && !submitMutation.isPending) {
      autoSubmitRef.current = true;
      submitMutation.mutate();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? Math.max(0, s - 1) : null)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, submitMutation]);

  // ── anti-cheat event listeners ───────────────────────────────────────────
  const sendEvent = useCallback(
    (type: AntiCheatEventType, payload?: Record<string, unknown>) => {
      logAntiCheatEvent(session.attempt.id, type, payload).catch(() => {/* fire-and-forget */});
    },
    [session.attempt.id],
  );

  useEffect(() => {
    function onVisibilityChange() {
      const type = document.hidden ? 'VISIBILITY_HIDDEN' : 'VISIBILITY_VISIBLE';
      sendEvent(type);
      if (document.hidden) setAntiCheatWarnings((n) => n + 1);
    }
    function onWindowBlur() {
      sendEvent('WINDOW_BLUR');
      setAntiCheatWarnings((n) => n + 1);
    }
    function onWindowFocus() { sendEvent('WINDOW_FOCUS'); }
    function onPaste() { sendEvent('PASTE_DETECTED'); }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
      sendEvent('RIGHT_CLICK');
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [sendEvent]);

  // ── answer helpers ───────────────────────────────────────────────────────
  function updateAnswer(questionId: string, patch: Partial<AnswerState>) {
    setAnswers((cur) => ({
      ...cur,
      [questionId]: { ...(cur[questionId] ?? emptyAnswer()), ...patch },
    }));
  }

  const answeredCount = useMemo(
    () =>
      session.questions.filter((q) => isAnswered(q, answers[q.questionId] ?? emptyAnswer())).length,
    [answers, session.questions],
  );

  const timerColor =
    secondsLeft !== null && secondsLeft < 60
      ? 'text-destructive'
      : secondsLeft !== null && secondsLeft < 180
      ? 'text-yellow-600'
      : 'text-foreground';

  // ── per-question timed mode ──────────────────────────────────────────────
  // When the exam sets secondsPerQuestion, run one question at a time: each has
  // its own countdown, you cannot go back, and time-up locks the answer + advances.
  const perQuestion = session.secondsPerQuestion ?? null;
  const [curIndex, setCurIndex] = useState(0);
  const [perSecLeft, setPerSecLeft] = useState(perQuestion ?? 0);

  // goNext saves the current answer then advances (or submits on the last question).
  const goNextRef = useRef<() => void>(() => {});
  goNextRef.current = () => {
    const q = session.questions[curIndex];
    if (!q) return;
    const ans = answers[q.questionId] ?? emptyAnswer();
    if (isAnswered(q, ans)) {
      const payload = buildResponsePayload(q, ans);
      void saveAttemptResponse(
        session.attempt.id, q.questionId,
        payload.selectedOptionIds, payload.textAnswer, payload.meta,
      ).catch(() => {/* submit re-saves everything */});
    }
    if (curIndex >= session.questions.length - 1) {
      if (!submitMutation.isPending) submitMutation.mutate();
    } else {
      setCurIndex((i) => i + 1);
    }
  };

  // Reset the per-question countdown whenever the current question changes.
  useEffect(() => {
    if (perQuestion == null) return;
    setPerSecLeft(perQuestion);
  }, [curIndex, perQuestion]);

  // Tick the per-question countdown; on expiry, auto-advance.
  useEffect(() => {
    if (perQuestion == null) return;
    if (perSecLeft <= 0) { goNextRef.current(); return; }
    const tmr = setTimeout(() => setPerSecLeft((s) => s - 1), 1000);
    return () => clearTimeout(tmr);
  }, [perSecLeft, perQuestion]);

  if (perQuestion != null) {
    const q = session.questions[curIndex];
    const ans = q ? (answers[q.questionId] ?? emptyAnswer()) : emptyAnswer();
    const isLast = curIndex >= session.questions.length - 1;
    const lowTime = perSecLeft <= 5;
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="text-sm font-semibold">
            {t('exam.questionLabel')} {curIndex + 1} / {session.questions.length}
          </div>
          <div className={`flex items-center gap-2 font-mono text-2xl font-bold tabular-nums ${lowTime ? 'text-destructive' : 'text-foreground'}`} aria-live="polite">
            <Clock className="h-6 w-6" aria-hidden="true" />
            {perSecLeft}s
          </div>
        </div>

        {q && (
          <section className="border bg-card p-4" aria-label={`${t('exam.questionLabel')} ${curIndex + 1}`}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="flex-1 text-base font-semibold leading-7">{q.text}</h2>
              <div className="shrink-0 border bg-secondary px-2 py-1 text-xs font-medium">
                {q.points} {t('exam.pts')}
              </div>
            </div>
            <QuestionBody
              question={q}
              ans={ans}
              onChange={(patch) => updateAnswer(q.questionId, patch)}
            />
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">ทำทีละข้อ ย้อนกลับไม่ได้ — หมดเวลาจะข้ามอัตโนมัติ</p>
          <Button
            onClick={() => goNextRef.current()}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Send className="h-4 w-4" aria-hidden="true" />}
            {isLast ? t('exam.submit') : 'ข้อถัดไป'}
          </Button>
        </div>

        {submitMutation.isError && (
          <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {submitErrorText(submitMutation.error)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header bar — sticky so the timer + submit stay visible while scrolling */}
      <div className="sticky top-14 z-10 rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{t('exam.attempt')} {session.attempt.attemptNumber}</div>
            <div className="text-lg font-semibold">
              {answeredCount}/{session.questions.length} {t('exam.answered')}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Countdown — large + monospace so it reads clearly under time pressure */}
            {secondsLeft !== null && (
              <div className={`flex items-center gap-2 font-mono text-2xl font-bold tabular-nums ${timerColor}`} aria-live="polite" aria-label={t('exam.timeLeft')}>
                <Clock className="h-6 w-6" aria-hidden="true" />
                {formatSeconds(secondsLeft)}
              </div>
            )}

            {/* Anti-cheat warning badge */}
            {antiCheatWarnings > 0 && (
              <div className="flex items-center gap-1 rounded-md border border-yellow-400 bg-yellow-50 px-2 py-1 text-xs text-yellow-700" role="alert">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {antiCheatWarnings} {t('exam.warnings')}
              </div>
            )}

            <Button
              onClick={async () => {
                if (await confirmAction(t('exam.confirmSubmitTitle'), t('exam.confirmSubmitBody'), t('exam.submit'))) {
                  submitMutation.mutate();
                }
              }}
              disabled={submitMutation.isPending || answeredCount < session.questions.length}
              aria-label={t('exam.submit')}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {t('exam.submit')}
            </Button>
          </div>
        </div>

        {answeredCount < session.questions.length && (
          <p className="mt-2 text-xs font-medium text-amber-600" role="status">
            {t('exam.remainingToAnswer', { count: session.questions.length - answeredCount })}
          </p>
        )}

        {/* Question navigator — jump to any question; green = answered */}
        <div className="mt-3 flex flex-wrap gap-1.5" role="navigation" aria-label={t('exam.navigatorLabel')}>
          {session.questions.map((q, index) => {
            const answered = isAnswered(q, answers[q.questionId] ?? emptyAnswer());
            return (
              <button
                key={q.questionId}
                type="button"
                onClick={() => jumpToQuestion(index)}
                aria-label={`${t('exam.questionLabel')} ${index + 1}${answered ? ` (${t('exam.answered')})` : ''}`}
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors',
                  answered
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'bg-background text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        {submitMutation.isError && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {submitErrorText(submitMutation.error)}
          </div>
        )}
      </div>

      {/* Questions */}
      {session.questions.map((question, index) => {
        const ans = answers[question.questionId] ?? emptyAnswer();
        const answered = isAnswered(question, ans);
        return (
          <section
            key={question.questionId}
            id={`exam-q-${index}`}
            className="scroll-mt-40 rounded-lg border bg-card p-4"
            aria-label={`${t('exam.questionLabel')} ${index + 1}`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{t('exam.questionLabel')} {index + 1}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{question.type.replace('_', ' ')}</span>
                  {answered && (
                    <span className="text-green-600" aria-label={t('exam.answered')}>
                      <CheckCircle2 className="inline h-3.5 w-3.5" aria-hidden="true" /> {t('exam.answered')}
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-base font-semibold leading-7">{question.text}</h2>
              </div>
              <div className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium" aria-label={`${question.points} ${t('exam.pts')}`}>
                {question.points} {t('exam.pts')}
              </div>
            </div>

            <QuestionBody
              question={question}
              ans={ans}
              onChange={(patch) => updateAnswer(question.questionId, patch)}
            />
          </section>
        );
      })}
    </div>
  );
}
