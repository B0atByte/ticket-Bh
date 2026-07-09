import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  ClipboardCheck,
  Clock,
  GraduationCap,
  KeyRound,
  Layers,
  Loader2,
  Search,
  SlidersHorizontal,
  Star,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CourseFormDialog } from '../features/learning/CourseFormDialog';
import { ExamFormDialog } from '../features/admin/ExamFormDialog';
import {
  getMyCourseProgress,
  listAllCourses,
  listCourses,
  listExams,
  redeemUnlockCode,
  type CourseListItem,
  type CourseProgressEntry,
} from '../features/learning/learning.api';
import { Button } from '../components/ui/button';
import { toastSuccess } from '../lib/confirm';
import { getApiErrorMessage } from '../lib/api-error';
import { useAuthStore } from '../features/auth/auth.store';
import { cn } from '../lib/utils';

// ─── Unlock-code redeem box ─────────────────────────────────────────────────────

function UnlockCodeBox() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const mutation = useMutation({
    mutationFn: () => redeemUnlockCode(code.trim()),
    onSuccess: (r) => {
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      void queryClient.invalidateQueries({ queryKey: ['my-course-progress'] });
      void toastSuccess(`ปลดล็อก "${r.courseTitle}" แล้ว`);
      navigate(`/courses/${r.courseId}`);
    },
  });
  return (
    <div className="border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
        <KeyRound className="h-4 w-4" /> มีโค้ดปลดล็อกหลักสูตร?
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="กรอกโค้ด เช่น UL-AB12CD"
          className="h-10 flex-1 min-w-[180px] border border-input bg-background px-3 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-primary/20"
          onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) mutation.mutate(); }}
        />
        <Button onClick={() => mutation.mutate()} disabled={!code.trim() || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {mutation.isPending ? 'กำลังตรวจสอบ…' : 'ปลดล็อก'}
        </Button>
      </div>
      {mutation.isError && (
        <p className="mt-2 text-xs text-destructive">{getApiErrorMessage(mutation.error, 'ปลดล็อกไม่สำเร็จ')}</p>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(title: string): string {
  return title.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function fmtDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}ชม. ${m}น.`;
  if (h > 0) return `${h} ชั่วโมง`;
  return `${m} นาที`;
}

function instructorName(author?: CourseListItem['author']): string {
  if (!author) return 'ไม่ระบุวิทยากร';
  return `${author.firstName} ${author.lastName}`.trim() || 'ไม่ระบุวิทยากร';
}

function autoBadge(course: CourseListItem): { label: string; cls: string } {
  const n = course._count.enrollments;
  if (n >= 30) return { label: 'Popular', cls: 'border-primary/30 bg-primary/5 text-primary' };
  if (n === 0)  return { label: 'New',     cls: 'border-border bg-muted text-muted-foreground' };
  return             { label: 'Active',   cls: 'border-border bg-muted text-muted-foreground' };
}

// ─── Course card ──────────────────────────────────────────────────────────────

function StarStatusBadge({ entry }: { entry?: CourseProgressEntry }) {
  if (!entry || entry.status === 'NOT_STARTED') return null;
  if (entry.status === 'PASSED') {
    return (
      <span className="absolute right-3 top-3 flex items-center gap-1 border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> ได้ดาวแล้ว
      </span>
    );
  }
  if (entry.status === 'FAILED') {
    return (
      <span className="absolute right-3 top-3 border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        ไม่ผ่าน{entry.postTestAttempts > 1 ? ` · รอบ ${entry.postTestAttempts}` : ''}
      </span>
    );
  }
  // Lessons finished. A course with a post-test still needs the exam to earn a star;
  // one without a post-test is simply "content complete" (no star possible).
  if (entry.progressPct >= 100) {
    return entry.hasPostTest ? (
      <span className="absolute right-3 top-3 border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        รอสอบหลังเรียน
      </span>
    ) : (
      <span className="absolute right-3 top-3 border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        เรียนจบเนื้อหา
      </span>
    );
  }
  return (
    <span className="absolute right-3 top-3 border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
      กำลังเรียน {entry.progressPct}%
    </span>
  );
}

function CourseCard({ course, progress }: { course: CourseListItem; progress?: CourseProgressEntry }) {
  const badge = autoBadge(course);
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden border border-border bg-card shadow-warm-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-warm"
    >
      {/* Cover */}
      <div className="relative h-36 border-b border-border bg-muted">
        {course.coverImageUrl ? (
          <img src={course.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F4FAF7 0%, #DCEFE6 100%)' }}>
            <span className="select-none border border-border bg-card px-4 py-2.5 font-serif text-xl font-light text-primary">
              {initials(course.title)}
            </span>
          </div>
        )}
        <span className={cn('absolute left-3 top-3 border px-2 py-0.5 text-[10px] font-semibold', badge.cls)}>
          {badge.label}
        </span>
        {course.status !== 'PUBLISHED' ? (
          <span className="absolute right-3 top-3 border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white">
            {course.status === 'DRAFT' ? 'Draft' : 'Archived'}
          </span>
        ) : (
          <StarStatusBadge entry={progress} />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {course.category && (
          <span className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {course.category.name}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        {course.summary && (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">{course.summary}</p>
        )}
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 shrink-0" />{fmtDuration(course.estimatedMinutes)}</span>
            <span className="flex items-center gap-1"><Layers className="h-3 w-3 shrink-0" />{course._count.modules} บท / {course.lessonCount ?? 0} บทเรียน</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3 shrink-0" />{course._count.enrollments} คน</span>
          </div>
          <div className="my-3 border-t border-border" />
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-muted text-[10px] font-bold text-primary">
              {instructorName(course.author).slice(0, 1).toUpperCase()}
            </div>
            <span className="truncate text-[11px] text-muted-foreground">{instructorName(course.author)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="border border-border bg-card shadow-warm-sm">
      <div className="h-36 animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse bg-muted" />
        <div className="h-3 w-1/2 animate-pulse bg-muted" />
        <div className="h-3 w-full animate-pulse bg-muted" />
      </div>
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center border border-border bg-muted">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold text-foreground">
        {hasFilter ? 'ไม่พบคอร์สที่ตรงกัน' : 'ยังไม่มีหลักสูตร'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilter ? 'ลองเปลี่ยนคีย์เวิร์ดหรือหมวดหมู่' : 'เพิ่มหลักสูตรใหม่เพื่อเริ่มต้น'}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CoursesPage() {
  const canCreate = useAuthStore((s) => s.hasPermission('course.create'));
  const canCreateExam = useAuthStore((s) => s.hasPermission('exam.create'));
  const canEdit   = useAuthStore((s) => s.hasPermission('course.update'));

  // Tab follows the URL so the sidebar ("หลักสูตร" /courses vs "แบบทดสอบ" /exams)
  // stays in sync and is shareable/bookmarkable.
  const location = useLocation();
  const navigate = useNavigate();
  const tab: 'courses' | 'exams' = location.pathname.startsWith('/exams') ? 'exams' : 'courses';
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sort,     setSort]     = useState<'popular' | 'title' | 'duration'>('popular');

  const query = useQuery({
    queryKey: ['courses', canEdit ? 'all' : 'published'],
    queryFn: () => (canEdit ? listAllCourses() : listCourses()),
  });

  const progressQuery = useQuery({
    queryKey: ['my-course-progress'],
    queryFn: getMyCourseProgress,
  });
  const progressByCourse = useMemo(() => {
    const map = new Map<string, CourseProgressEntry>();
    for (const e of progressQuery.data?.items ?? []) map.set(e.courseId, e);
    return map;
  }, [progressQuery.data]);
  const starCount = progressQuery.data?.stars ?? 0;

  const allCourses = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  // The "แบบทดสอบ" tab shows the same course cards, but only courses that have
  // at least one published exam attached.
  const examsQuery = useQuery({ queryKey: ['exams-all'], queryFn: () => listExams() });
  const courseIdsWithExams = useMemo(() => {
    const set = new Set<string>();
    for (const e of examsQuery.data?.items ?? []) if (e.courseId) set.add(String(e.courseId));
    return set;
  }, [examsQuery.data?.items]);

  // Exclusive split: a course appears on exactly one tab.
  //   "แบบทดสอบ" = courses that have at least one exam.
  //   "บทเรียน"  = courses without any exam.
  const courses = useMemo(
    () =>
      tab === 'exams'
        ? allCourses.filter((c) => courseIdsWithExams.has(String(c.id)))
        : allCourses.filter((c) => !courseIdsWithExams.has(String(c.id))),
    [tab, allCourses, courseIdsWithExams],
  );

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of courses) { if (c.category) seen.set(c.category.id, c.category.name); }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [courses]);

  const filtered = useMemo(() => {
    let list = courses;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary?.toLowerCase().includes(q) ||
        c.category?.name.toLowerCase().includes(q),
      );
    }
    if (category !== 'all') list = list.filter((c) => c.category?.id === category);
    if (sort === 'popular')  list = [...list].sort((a, b) => b._count.enrollments - a._count.enrollments);
    if (sort === 'title')    list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'th'));
    if (sort === 'duration') list = [...list].sort((a, b) => (b.estimatedMinutes ?? 0) - (a.estimatedMinutes ?? 0));
    return list;
  }, [courses, search, category, sort]);

  const hasFilter = search.trim().length > 0 || category !== 'all';

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-border bg-muted">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-serif text-2xl font-light tracking-tight text-foreground">การเรียนรู้</h1>
          </div>
          <p className="mt-1 pl-12 text-sm text-muted-foreground">หลักสูตรและแบบทดสอบขององค์กร</p>
        </div>
        {tab === 'courses' && canCreate && <CourseFormDialog mode="create" />}
        {tab === 'exams' && canCreateExam && <ExamFormDialog mode="create" />}
      </div>

      {/* ── Stats strip ── */}
      {!query.isLoading && courses.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {[
            { icon: Star,     label: 'ดาวสะสมของฉัน',   value: starCount, gold: true },
            { icon: BookOpen, label: 'หลักสูตรทั้งหมด',  value: courses.length },
            { icon: Zap,      label: 'เผยแพร่แล้ว',      value: courses.filter((c) => c.status === 'PUBLISHED').length },
            { icon: Users,    label: 'ผู้เรียนรวม',      value: courses.reduce((s, c) => s + c._count.enrollments, 0).toLocaleString() },
          ].map(({ icon: Icon, label, value, gold }) => (
            <div key={label} className="flex items-center gap-3 border border-border bg-card px-4 py-3 shadow-warm-sm">
              <div className={cn('flex h-8 w-8 items-center justify-center border', gold ? 'border-amber-300 bg-amber-50' : 'border-border bg-muted')}>
                <Icon className={cn('h-4 w-4', gold ? 'fill-amber-400 text-amber-400' : 'text-primary')} />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-base font-bold text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-0 border-b border-border">
        {([
          { key: 'courses', icon: BookOpen,      label: 'บทเรียน' },
          { key: 'exams',   icon: ClipboardCheck, label: 'แบบทดสอบ' },
        ] as { key: 'courses' | 'exams'; icon: typeof BookOpen; label: string }[]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => navigate(key === 'exams' ? '/exams' : '/courses')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Card grid (same for หลักสูตร and แบบทดสอบ; the แบบทดสอบ tab is pre-filtered to courses with exams) ── */}
      {(
        <>
          {/* Unlock-code redeem (learners on the lessons tab) */}
          {tab === 'courses' && !canCreate && <UnlockCodeBox />}

          {/* Search + filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1" style={{ minWidth: 200 }}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="ค้นหาหลักสูตร..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full border border-input bg-card pl-9 pr-9 text-sm outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 border border-input bg-card px-3 h-10">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="bg-transparent text-sm outline-none text-foreground cursor-pointer"
              >
                <option value="popular">ยอดนิยม</option>
                <option value="title">ชื่อ ก-ฮ</option>
                <option value="duration">ระยะเวลา</option>
              </select>
            </div>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategory('all')}
                className={cn(
                  'border px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                  category === 'all'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary',
                )}
              >
                ทั้งหมด ({courses.length})
              </button>
              {categories.map((cat) => {
                const count = courses.filter((c) => c.category?.id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={cn(
                      'border px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                      category === cat.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary',
                    )}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Course grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {query.isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : filtered.length === 0
                ? <EmptyState hasFilter={hasFilter} />
                : filtered.map((course) => <CourseCard key={course.id} course={course} progress={progressByCourse.get(course.id)} />)}
          </div>

          {!query.isLoading && filtered.length > 0 && (
            <p className="text-center text-xs text-muted-foreground pb-4">
              แสดง {filtered.length} จาก {courses.length} หลักสูตร
              {hasFilter && (
                <button
                  onClick={() => { setSearch(''); setCategory('all'); }}
                  className="ml-2 text-primary hover:underline"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
