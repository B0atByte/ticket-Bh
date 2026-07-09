import { useQuery } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getManagerStats } from '../features/stats/stats.api';

export function ManagerDashboardPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['stats', 'manager'], queryFn: getManagerStats });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }
  const reports = query.data?.reports ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center border bg-card">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{t('team.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {reports.length} {t('team.directReports')}
          </p>
        </div>
      </header>

      {reports.length === 0 ? (
        <div className="border bg-card p-8 text-center text-muted-foreground">
          {t('team.directReportsHelp')}
        </div>
      ) : (
        <div className="overflow-x-auto border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t('team.name')}</th>
                <th className="px-4 py-3">{t('team.enrollments')}</th>
                <th className="px-4 py-3">{t('team.avgProgress')}</th>
                <th className="px-4 py-3">{t('team.overdue')}</th>
                <th className="px-4 py-3">{t('team.examsPassed')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map((r) => (
                <tr key={r.userId} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.enrollments.completed} / {r.enrollments.total}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted">
                        <div
                          className="h-2 bg-primary"
                          style={{ width: `${r.avgProgress}%` }}
                        />
                      </div>
                      <span className="text-xs">{r.avgProgress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.enrollments.overdue > 0 ? (
                      <span className="border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        {r.enrollments.overdue}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.attempts.passed} / {r.attempts.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
