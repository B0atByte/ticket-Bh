/**
 * Phase 2 — Attempt History Page
 * Shows all attempts for the current user, optionally filtered by exam.
 */
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { listAttempts } from '../features/learning/learning.api';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
    SUBMITTED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    AUTO_SUBMITTED: 'border-amber-200 bg-amber-50 text-amber-700',
    GRADED: 'border-primary/30 bg-primary/5 text-primary',
    ABANDONED: 'border-border bg-muted text-muted-foreground',
  };
  return map[status] ?? 'border-border bg-muted text-muted-foreground';
}

export function AttemptHistoryPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const examId = params.get('examId') ?? undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attempts', examId],
    queryFn: () => listAttempts(examId),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">{t('exam.history')}</h1>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('common.loading')}
        </div>
      )}

      {isError && (
        <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          ไม่สามารถโหลดประวัติได้
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('exam.noAttempts')}</p>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto border">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ครั้งที่</th>
                <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                <th className="px-4 py-3 text-left font-medium">{t('exam.score')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('exam.result')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((attempt) => (
                <tr key={attempt.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">#{attempt.attemptNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`border px-2 py-0.5 text-xs font-medium ${statusBadge(attempt.status)}`}>
                      {attempt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {attempt.score != null && attempt.maxScore != null
                      ? `${attempt.score}/${attempt.maxScore} (${String(attempt.scorePct ?? 0)}%)`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {attempt.passed === true && (
                      <span className="font-medium text-emerald-600">{t('exam.passed')}</span>
                    )}
                    {attempt.passed === false && (
                      <span className="font-medium text-destructive">{t('exam.notPassed')}</span>
                    )}
                    {attempt.passed == null && <span className="text-muted-foreground">{t('exam.pending')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-2">
        <Link to="/dashboard" className="text-sm text-primary underline-offset-4 hover:underline">
          ← กลับสู่แดชบอร์ด
        </Link>
      </div>
    </div>
  );
}
