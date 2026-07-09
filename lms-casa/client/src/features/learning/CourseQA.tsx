/**
 * Phase 3 — CourseQA
 * Thread-based Q&A per course.
 * RBAC: owner + instructor/admin can delete.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuthStore } from '../auth/auth.store';
import {
  acceptCourseAnswer,
  createCourseAnswer,
  createCourseQuestion,
  deleteCourseAnswer,
  deleteCourseQuestion,
  getCourseQuestion,
  listCourseQuestions,
  type CourseQuestion,
} from './learning-phase3.api';

interface CourseQAProps {
  courseId: string;
}

function canDelete(userId: string, ownerId: string, roles: string[]): boolean {
  if (userId === ownerId) return true;
  return roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'HR'].includes(r));
}

// ─── Answer thread ────────────────────────────────────────────────────────────

function AnswerThread({
  courseId,
  question,
  currentUserId,
  roles,
}: {
  courseId: string;
  question: CourseQuestion;
  currentUserId: string;
  roles: string[];
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data } = useQuery({
    queryKey: ['course-question', question.id],
    queryFn: () => getCourseQuestion(courseId, question.id),
    initialData: question,
  });

  const answerMutation = useMutation({
    mutationFn: () => createCourseAnswer(courseId, question.id, body.trim()),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['course-question', question.id] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (answerId: string) => acceptCourseAnswer(courseId, question.id, answerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-question', question.id] }),
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (answerId: string) => deleteCourseAnswer(courseId, question.id, answerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-question', question.id] }),
  });

  const isQuestionOwner = currentUserId === question.userId;
  const canManage = canDelete(currentUserId, question.userId, roles);

  return (
    <div className="space-y-3 pl-4 border-l-2 border-muted">
      {data.answers?.map((answer) => (
        <div
          key={answer.id}
          className={[
            'rounded-md border p-3 text-sm',
            answer.isAccepted ? 'border-green-400 bg-green-50' : 'bg-background',
          ].join(' ')}
          role="article"
          aria-label={`Answer by ${answer.user.firstName} ${answer.user.lastName}`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium text-xs">
                  {answer.user.firstName} {answer.user.lastName}
                </span>
                {answer.isAccepted && (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Accepted
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap leading-5">{answer.body}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              {isQuestionOwner && !answer.isAccepted && (
                <button
                  type="button"
                  onClick={() => acceptMutation.mutate(answer.id)}
                  disabled={acceptMutation.isPending}
                  className="rounded p-1 text-green-600 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                  aria-label="Accept answer"
                  title="Accept answer"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {canDelete(currentUserId, answer.userId, roles) && (
                <button
                  type="button"
                  onClick={() => deleteAnswerMutation.mutate(answer.id)}
                  disabled={deleteAnswerMutation.isPending}
                  className="rounded p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                  aria-label="Delete answer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Add answer */}
      {canManage || true /* anyone enrolled can answer */ ? (
        <div className="flex gap-2">
          <Input
            placeholder="Write an answer…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && body.trim()) answerMutation.mutate(); }}
            aria-label="Answer content"
          />
          <Button
            size="sm"
            onClick={() => answerMutation.mutate()}
            disabled={!body.trim() || answerMutation.isPending}
          >
            {answerMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : 'Reply'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CourseQA({ courseId }: CourseQAProps) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const currentUserId = user?.id ?? '';
  const roles: string[] = user?.roles ?? [];

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const listKey = ['course-questions', courseId];

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => listCourseQuestions(courseId),
  });

  const createMutation = useMutation({
    mutationFn: () => createCourseQuestion(courseId, { title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: listKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (q: CourseQuestion) => deleteCourseQuestion(courseId, q.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
  });

  return (
    <section aria-label="Course Q&A" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
          Q&amp;A
        </h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ask a question
        </Button>
      </div>

      {/* New question form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-4 space-y-3" role="form" aria-label="New question form">
          <Input
            placeholder="Question title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Question title"
          />
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
            placeholder="Describe your question in detail…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Question body"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!title.trim() || !body.trim() || createMutation.isPending}
            >
              {createMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : 'Post question'}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Questions list */}
      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading questions" />
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No questions yet. Be the first to ask!
        </p>
      )}

      <div className="space-y-3" role="list" aria-label="Questions">
        {data?.items.map((q) => (
          <article key={q.id} role="listitem" className="rounded-lg border bg-card">
            {/* Question header */}
            <div className="flex items-start gap-3 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {q.isPinned && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      Pinned
                    </span>
                  )}
                  <h3 className="font-semibold text-sm">{q.title}</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {q.user.firstName} {q.user.lastName} ·{' '}
                  {new Date(q.createdAt).toLocaleDateString()} ·{' '}
                  {q._count.answers} answer{q._count.answers !== 1 ? 's' : ''}
                </p>
                <p className="mt-2 text-sm leading-5 text-muted-foreground line-clamp-2">{q.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canDelete(currentUserId, q.userId, roles) && (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(q)}
                    disabled={deleteMutation.isPending}
                    className="rounded p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    aria-label="Delete question"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => (v === q.id ? null : q.id))}
                  className="rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-expanded={expanded === q.id}
                  aria-label={expanded === q.id ? 'Collapse answers' : 'Expand answers'}
                >
                  {expanded === q.id
                    ? <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Answers */}
            {expanded === q.id && (
              <div className="border-t px-4 pb-4 pt-3">
                <AnswerThread
                  courseId={courseId}
                  question={q}
                  currentUserId={currentUserId}
                  roles={roles}
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
