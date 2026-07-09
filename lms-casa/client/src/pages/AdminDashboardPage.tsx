import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAdminStats } from '../features/stats/stats.api';
import { Button } from '../components/ui/button';

async function downloadReport(url: string, filename: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return;
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: '#C9E8DA',
  IN_PROGRESS: '#1B7E5D',
  COMPLETED: '#10b981',
  EXPIRED: '#f97316',
  WITHDRAWN: '#ef4444',
};

const apiBase =
  (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') +
  (import.meta.env.VITE_API_PREFIX ?? '/api/v1');

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['stats', 'admin'], queryFn: getAdminStats });

  if (query.isLoading || !query.data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }
  const s = query.data;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center border bg-card">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{t('admin.orgStats')}</h1>
            <p className="text-sm text-muted-foreground">{t('admin.liveSnapshot')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => downloadReport(`${apiBase}/reports/exam-results.xlsx`, 'exam-results.xlsx')}
          >
            <Download className="h-4 w-4" />
            {t('admin.examResults')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadReport(`${apiBase}/reports/course-completion.xlsx`, 'course-completion.xlsx')}
          >
            <Download className="h-4 w-4" />
            {t('admin.completion')}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={t('admin.users')} value={s.totals.users} />
        <StatCard
          label={t('admin.courses')}
          value={`${s.totals.publishedCourses}/${s.totals.courses}`}
          sub={t('admin.published')}
        />
        <StatCard label={t('admin.exams')} value={s.totals.exams} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title={t('admin.enrollmentsOverTime')}>
          {s.enrollmentsOverTime.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={s.enrollmentsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1B7E5D" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('admin.enrollmentStatus')}>
          {s.enrollmentStatus.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={s.enrollmentStatus}
                  dataKey="count"
                  nameKey="status"
                  outerRadius={80}
                  label
                >
                  {s.enrollmentStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title={t('admin.topCourses')}>
        {s.topCourses.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.topCourses} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" fontSize={11} allowDecimals={false} />
              <YAxis dataKey="title" type="category" fontSize={11} width={150} />
              <Tooltip />
              <Bar dataKey="enrollments" fill="#1B7E5D" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard label={t('admin.avgProgress')} value={`${s.averages.progressPct}%`} />
        <StatCard label={t('admin.avgExamScore')} value={`${s.averages.examScorePct}%`} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>;
}
