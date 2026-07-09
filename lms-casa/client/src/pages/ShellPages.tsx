import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileQuestion,
  GraduationCap,
  Target,
  Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../features/auth/auth.store';
import { listCourses, listExams } from '../features/learning/learning.api';
import { getMyPoints } from '../features/points/points.api';
import { getPersonalStats } from '../features/stats/stats.api';

// ─── Dashboard — minimal but easy to scan: icons, soft tiles, clear labels ────

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: () => listCourses() });
  const examsQuery   = useQuery({ queryKey: ['exams'],   queryFn: () => listExams() });
  const statsQuery   = useQuery({ queryKey: ['stats', 'me'], queryFn: getPersonalStats });
  const pointsQuery  = useQuery({ queryKey: ['points', 'me'], queryFn: getMyPoints });

  const courses = coursesQuery.data?.items ?? [];
  const exams   = examsQuery.data?.items ?? [];
  const stats   = statsQuery.data;
  const points  = pointsQuery.data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'อรุณสวัสดิ์' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  return (
    <div className="mx-auto max-w-3xl px-2 py-6 md:py-8">
      <p className="text-sm text-muted-foreground">{greeting}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
        {user?.firstName ?? ''} {user?.lastName ?? ''}
      </h1>

      {/* stat tiles — icon + number + label, easy to scan */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: GraduationCap, label: t('dashboard.enrolledCourses'), value: stats?.enrollments.total ?? 0 },
          { icon: CheckCircle2, label: t('dashboard.coursesCompleted'), value: stats?.enrollments.completed ?? 0 },
          { icon: Target, label: t('dashboard.passRate'), value: `${stats?.attempts.passRate ?? 0}%` },
          { icon: Trophy, label: t('leaderboard.totalXp'), value: (points?.totalXp ?? 0).toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="border border-border p-4">
            <div className="flex h-8 w-8 items-center justify-center bg-primary/10">
              <s.icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-xl font-semibold tabular-nums tracking-tight text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* courses */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h2 className="text-base font-semibold text-foreground">เรียนต่อ</h2>
          </div>
          <Link to="/courses" className="text-xs font-medium text-primary hover:underline">
            ดูทั้งหมด
          </Link>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {courses.slice(0, 5).map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`}
              className="group flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-xs font-bold text-primary">
                {course.title.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                  {course.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {course._count.modules} บท · {course.estimatedMinutes ?? 0} นาที
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary" strokeWidth={1.75} />
            </Link>
          ))}
          {!coursesQuery.isLoading && courses.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">{t('course.noPublished')}</p>
          )}
        </div>
      </section>

      {/* exams */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h2 className="text-base font-semibold text-foreground">{t('nav.exams')}</h2>
          </div>
          <Link to="/exams" className="text-xs font-medium text-primary hover:underline">
            ดูทั้งหมด
          </Link>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {exams.slice(0, 4).map((exam) => (
            <Link key={exam.id} to={`/exams/${exam.id}`}
              className="group flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 text-xs font-bold text-primary">
                {exam.title.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                  {exam.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {exam._count.questions} ข้อ · ผ่านที่ {exam.passingScore}%
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-primary" strokeWidth={1.75} />
            </Link>
          ))}
          {!examsQuery.isLoading && exams.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">{t('exam.noPublished')}</p>
          )}
        </div>
      </section>

      {/* recent attempts with clear status pills */}
      {stats && stats.recentAttempts.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h2 className="text-base font-semibold text-foreground">{t('dashboard.recentAttempts')}</h2>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {stats.recentAttempts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{a.examTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleString('th-TH') : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{a.scorePct ?? '-'}%</span>
                  {a.passed === true && (
                    <span className="bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{t('exam.passed')}</span>
                  )}
                  {a.passed === false && (
                    <span className="bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">{t('exam.notPassed')}</span>
                  )}
                  {a.passed === null && (
                    <span className="bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">{t('exam.pending')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Exams page ───────────────────────────────────────────────────────────────

export function ExamsPage() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['exams'], queryFn: () => listExams() });
  const exams = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center border border-border bg-muted">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('nav.exams')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">ทดสอบความรู้และติดตามผลการสอบของคุณ</p>
        </div>
      </div>

      {query.isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-border bg-card shadow-warm-sm">
              <div className="h-32 animate-shimmer bg-gradient-to-r from-muted via-accent to-muted" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse bg-muted" />
                <div className="h-3 w-1/2 animate-pulse bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!query.isLoading && exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center border border-border bg-muted">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground">ยังไม่มีข้อสอบ</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('exam.noPublished')}</p>
        </div>
      )}

      {!query.isLoading && exams.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Link
              key={exam.id}
              to={`/exams/${exam.id}`}
              className="group flex flex-col overflow-hidden border border-border bg-card shadow-warm-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-warm"
            >
              {/* Banner */}
              <div className="relative h-32 border-b border-border"
                style={{ background: 'linear-gradient(135deg, #0F211B 0%, #14614A 100%)' }}>
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 opacity-10"
                  style={{ background: 'radial-gradient(circle, #C9E8DA 0%, transparent 70%)' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="select-none font-serif text-3xl font-light text-white/70">
                    {exam.title.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="absolute left-3 top-3 border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                  ข้อสอบ
                </span>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                  {exam.title}
                </h3>
                {exam.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {exam.description}
                  </p>
                )}
                <div className="mt-auto pt-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><FileQuestion className="h-3 w-3" />{exam._count.questions} ข้อ</span>
                    <span className="flex items-center gap-1"><Target className="h-3 w-3" />ผ่านที่ {exam.passingScore}%</span>
                    {exam.timeLimitMinutes && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{exam.timeLimitMinutes} นาที</span>
                    )}
                  </div>
                  <div className="my-3 border-t border-border" />
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-muted text-[10px] font-bold text-primary">
                      {exam.title.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {exam._count.questions > 0 ? `${exam._count.questions} คำถาม` : 'ยังไม่มีคำถาม'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
