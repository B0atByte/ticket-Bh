import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  Film,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Lock,
  Menu,
  MessageSquare,
  Pencil,
  Play,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NotesPanel } from '../features/learning/NotesPanel';
import { VideoPlayer } from '../features/learning/VideoPlayer';
import { AudioPlayer } from '../features/learning/AudioPlayer';
import { CourseQA } from '../features/learning/CourseQA';
import { getPdfEmbedUrl, getSlidesEmbedUrl } from '../lib/video-embed';
import { getCourseLessonProgress, getLessonProgress, upsertLessonProgress } from '../features/learning/learning-phase3.api';
import {
  getCourse,
  getLesson,
  listAttempts,
  listExams,
  type CourseModule,
  type ExamListItem,
  type ExamType,
  type LessonSummary,
} from '../features/learning/learning.api';
import { useAuthStore } from '../features/auth/auth.store';
import { cn } from '../lib/utils';

const CONTENT_ICON: Record<string, LucideIcon> = {
  VIDEO: Film, AUDIO: Headphones, PDF: FileText, SLIDES: ImageIcon,
  LINK: LinkIcon, TEXT: FileText, HTML: FileText, SCORM: PlayCircle,
};

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  QUIZ: 'แบบทดสอบ', ASSESSMENT: 'แบบประเมิน', PRE_TEST: 'ก่อนอบรม',
  POST_TEST: 'หลังอบรม', CERTIFICATION: 'รับรอง', SURVEY: 'แบบสำรวจ',
};

const EXAM_TYPE_COLOR: Record<ExamType, string> = {
  PRE_TEST: 'border-amber-200 bg-amber-50 text-amber-700',
  QUIZ: 'border-primary/30 bg-primary/5 text-primary',
  ASSESSMENT: 'border-border bg-secondary text-secondary-foreground',
  POST_TEST: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CERTIFICATION: 'border-violet-200 bg-violet-50 text-violet-700',
  SURVEY: 'border-border bg-muted text-muted-foreground',
};

type Tab = 'content' | 'notes' | 'qa';

function fmtSec(sec?: number | null) {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface FlatLesson extends LessonSummary {
  moduleTitle: string;
  moduleIndex: number;
  courseId: string;
}

function flattenLessons(modules: CourseModule[], courseId: string): FlatLesson[] {
  return modules.flatMap((mod, mIdx) =>
    mod.lessons.map((lesson) => ({ ...lesson, moduleTitle: mod.title, moduleIndex: mIdx, courseId })),
  );
}

function ExamSidebarItem({
  exam, isPassed, isForced,
}: {
  exam: ExamListItem; isPassed: boolean; isForced?: boolean;
}) {
  return (
    <Link
      to={`/exams/${exam.id}`}
      className={cn(
        'group flex w-full items-center gap-3 px-3 py-2 transition-all',
        isForced
          ? 'bg-amber-50 hover:bg-amber-100'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <div className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center',
        isPassed ? 'bg-emerald-50' : isForced ? 'bg-amber-100' : 'bg-secondary',
      )}>
        {isPassed
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          : isForced
            ? <Lock className="h-3 w-3 text-amber-500" />
            : <ClipboardCheck className="h-3 w-3 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'truncate text-sm leading-snug',
          isForced ? 'font-medium text-amber-800' : 'text-foreground/80',
        )}>
          {exam.title}
        </p>
        <p className={cn('text-[10px]', isForced ? 'text-amber-600' : 'text-muted-foreground')}>
          {EXAM_TYPE_LABEL[exam.type]}
          {isForced && !isPassed && ' · ต้องทำก่อนเรียน'}
          {isPassed && ' · ผ่านแล้ว'}
        </p>
      </div>
      <ChevronRight className={cn(
        'h-3.5 w-3.5 shrink-0 transition-colors',
        isForced ? 'text-amber-300 group-hover:text-amber-500' : 'text-border group-hover:text-primary',
      )} />
    </Link>
  );
}

function ExamCard({ exam, isPassed, isForced }: { exam: ExamListItem; isPassed: boolean; isForced?: boolean }) {
  return (
    <Link
      to={`/exams/${exam.id}`}
      className={cn(
        'group flex items-center gap-4 border p-4 shadow-warm-sm transition-all hover:-translate-y-0.5 hover:shadow-warm',
        isForced && !isPassed
          ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
          : 'border-border bg-card hover:border-primary',
      )}
    >
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center',
        isPassed ? 'bg-emerald-50' : isForced ? 'bg-amber-500' : 'bg-primary',
      )}>
        {isPassed
          ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          : isForced
            ? <Lock className="h-4 w-4 text-white" />
            : <ClipboardCheck className="h-4 w-4 text-primary-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={cn('border px-2 py-0.5 text-[10px] font-semibold', EXAM_TYPE_COLOR[exam.type])}>
            {EXAM_TYPE_LABEL[exam.type]}
          </span>
          {isPassed && (
            <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              ผ่านแล้ว
            </span>
          )}
          {exam.timeLimitMinutes && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />{exam.timeLimitMinutes} นาที
            </span>
          )}
        </div>
        <p className={cn(
          'truncate font-medium transition-colors',
          isPassed ? 'text-muted-foreground' : 'text-foreground group-hover:text-primary',
        )}>
          {exam.title}
        </p>
        <p className="text-xs text-muted-foreground">{exam._count.questions} ข้อ · ผ่านที่ {exam.passingScore}%</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

function LessonItem({
  lesson, isActive, isCompleted, locked, onClick,
}: {
  lesson: FlatLesson; isActive: boolean; isCompleted: boolean; locked: boolean; onClick: () => void;
}) {
  if (locked) {
    return (
      <div className="flex w-full items-center gap-3 px-3 py-2 opacity-50 cursor-not-allowed">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          <Lock className="h-3 w-3 text-muted-foreground" />
        </div>
        <p className="flex-1 truncate text-sm text-muted-foreground">{lesson.title}</p>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left transition-all duration-150',
        isActive
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        {isCompleted
          ? <CheckCircle2 className={cn('h-4 w-4', isActive ? 'text-background/70' : 'text-emerald-500')} />
          : isActive
            ? <Play className="h-3 w-3 fill-background text-background" />
            : <div className="h-1.5 w-1.5 bg-muted-foreground/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('truncate text-sm leading-snug', isActive ? 'font-medium text-background' : 'text-foreground/80')}>
          {lesson.title}
        </p>
        {lesson.durationSeconds && lesson.durationSeconds > 0 && (
          <p className={cn('mt-0.5 text-[10px]', isActive ? 'text-background/60' : 'text-muted-foreground')}>
            {fmtSec(lesson.durationSeconds)}
          </p>
        )}
      </div>
    </button>
  );
}

export function LearningPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canTakeExam = useAuthStore((s) => s.hasPermission('exam.take'));
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768,
  );
  const [tab, setTab] = useState<Tab>('content');
  const [videoTimeSec] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId!),
    enabled: Boolean(courseId),
  });
  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => getLesson(lessonId!),
    enabled: Boolean(lessonId),
  });
  const progressQuery = useQuery({
    queryKey: ['lesson-progress', lessonId],
    queryFn: () => getLessonProgress(lessonId!),
    enabled: Boolean(lessonId),
  });
  const courseProgressQuery = useQuery({
    queryKey: ['course-lesson-progress', courseId],
    queryFn: () => getCourseLessonProgress(courseId!),
    enabled: Boolean(courseId),
  });
  const examsQuery = useQuery({
    queryKey: ['exams', courseId],
    queryFn: () => listExams(courseId),
    enabled: Boolean(courseId),
  });

  // For non-video lessons (PDF/slides/text) the learner marks completion manually.
  const queryClient = useQueryClient();
  const markCompleteMutation = useMutation({
    mutationFn: () => upsertLessonProgress(lessonId!, { completed: true, lastPositionSec: 0, secondsWatched: 0 }),
    onSuccess: () => {
      setCompletedIds((prev) => { const n = new Set(prev); n.add(lessonId!); return n; });
      void queryClient.invalidateQueries({ queryKey: ['lesson-progress', lessonId] });
      void queryClient.invalidateQueries({ queryKey: ['course-lesson-progress', courseId] });
    },
  });
  const attemptsQuery = useQuery({
    queryKey: ['my-attempts-all'],
    queryFn: () => listAttempts(),
    enabled: Boolean(courseId) && canTakeExam,
  });

  // Seed the completed set from the server so progress survives leaving the course.
  useEffect(() => {
    if (!courseProgressQuery.data) return;
    setCompletedIds((prev) => {
      const next = new Set(prev);
      for (const p of courseProgressQuery.data) {
        if (p.status === 'COMPLETED') next.add(p.lessonId);
      }
      return next;
    });
  }, [courseProgressQuery.data]);

  useEffect(() => {
    if (progressQuery.data?.status === 'COMPLETED' && lessonId) {
      setCompletedIds((prev) => {
        if (prev.has(lessonId)) return prev;
        const next = new Set(prev);
        next.add(lessonId);
        return next;
      });
    }
  }, [progressQuery.data, lessonId]);

  const course = courseQuery.data;
  const lesson = lessonQuery.data;
  const progress = progressQuery.data;
  const flatLessons = course ? flattenLessons(course.modules, courseId!) : [];
  const currentIdx = flatLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx >= 0 && currentIdx < flatLessons.length - 1 ? flatLessons[currentIdx + 1] : null;
  const completedCount = completedIds.size;
  const totalLessons = flatLessons.length;
  const coursePct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const isCompleted = progress?.status === 'COMPLETED';
  const lessonPct = progress
    ? isCompleted ? 100
      : Math.min(100, Math.round(((progress.lastPositionSec ?? 0) / Math.max(lesson?.durationSeconds ?? 1, 1)) * 100))
    : 0;

  const allExams = examsQuery.data?.items ?? [];
  const myAttempts = attemptsQuery.data?.items ?? [];

  const preTestExams = allExams.filter((e) => e.type === 'PRE_TEST');
  const middleExams = allExams.filter((e) => e.type === 'QUIZ' || e.type === 'ASSESSMENT');
  const postExams = allExams.filter((e) => e.type === 'POST_TEST' || e.type === 'SURVEY');

  function examPassed(examId: string) {
    return myAttempts.some((a) => String(a.examId) === String(examId) && a.passed === true);
  }

  const allPreTestsPassed = preTestExams.length === 0 || preTestExams.every((e) => examPassed(e.id));
  const lessonsLocked = preTestExams.length > 0 && !allPreTestsPassed;

  const videoContent = lesson?.contents.find((c) => c.type === 'VIDEO');
  const otherContents = lesson?.contents.filter((c) => c.type !== 'VIDEO') ?? [];

  function goToLesson(id: string) {
    if (lessonsLocked) return;
    navigate(`/courses/${courseId}/learn/${id}`);
    setTab('content');
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  if (courseQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">ไม่พบหลักสูตร</p>
      </div>
    );
  }

  const userInitials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">

      {/* ── Top bar ── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
          LC
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <Link to="/courses" className="hidden shrink-0 text-muted-foreground hover:text-primary transition-colors sm:block">
            หลักสูตร
          </Link>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-border sm:block" />
          <Link
            to={`/courses/${courseId}`}
            className="max-w-[200px] truncate font-medium text-foreground/80 hover:text-primary transition-colors"
          >
            {course.title}
          </Link>
          {lesson && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-border" />
              <span className="hidden max-w-[180px] truncate text-muted-foreground md:block">{lesson.title}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className="hidden items-center gap-1 border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 sm:flex">
              <CheckCircle2 className="h-3 w-3" /> เรียนจบแล้ว
            </span>
          )}
          {lessonsLocked && (
            <span className="hidden items-center gap-1 border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 sm:flex">
              <Lock className="h-3 w-3" /> ต้องทำแบบทดสอบก่อน
            </span>
          )}
          <Link
            to={`/courses/${courseId}`}
            className="border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-foreground/30 hover:bg-muted"
          >
            ออกจากห้องเรียน
          </Link>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
            {userInitials}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="relative flex flex-1 min-h-0">

        {/* Mobile backdrop — tap to close the overlay sidebar */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="ปิดเมนูบทเรียน"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
          />
        )}

        {/* ── Sidebar ──
            Mobile: fixed overlay that slides over the content (does not squeeze it).
            md+: in-flow column that pushes the content. */}
        <aside
          className={cn(
            'flex flex-col border-r border-border bg-card transition-all duration-300 overflow-hidden',
            'absolute inset-y-0 left-0 z-40 md:static md:z-auto md:shrink-0',
            sidebarOpen ? 'w-72 xl:w-80' : 'w-0',
          )}
        >
          {/* Course header */}
          <div className="shrink-0 border-b border-border p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary">
                <GraduationCap className="h-4 w-4 text-primary-foreground" />
              </div>
              <h2 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug">
                {course.title}
              </h2>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ความคืบหน้า</span>
                <span className="font-semibold text-primary">{coursePct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${coursePct}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                  {completedCount}/{totalLessons} บทเรียน
                </span>
                {course.estimatedMinutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {course.estimatedMinutes} นาที
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Unified flow list */}
          <div className="flex-1 overflow-y-auto py-2">

            {preTestExams.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-2 px-4 py-2">
                  <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-500">
                    ก่อนเรียน
                  </span>
                </div>
                <div className="px-2 space-y-0.5">
                  {preTestExams.map((exam) => (
                    <ExamSidebarItem
                      key={exam.id}
                      exam={exam}
                      isPassed={examPassed(exam.id)}
                      isForced={!examPassed(exam.id)}
                    />
                  ))}
                </div>
                {lessonsLocked && (
                  <p className="mx-4 mt-1 mb-2 text-[10px] leading-4 text-amber-600 bg-amber-50 px-2 py-1.5">
                    บทเรียนถูกล็อกจนกว่าจะผ่านการทดสอบก่อนเรียน
                  </p>
                )}
              </div>
            )}

            {course.modules.map((mod, mIdx) => (
              <div key={mod.id} className="mb-1">
                <div className="flex items-center gap-2 px-4 py-2">
                  <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {mIdx + 1}. {mod.title}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground/50">{mod.lessons.length}</span>
                </div>
                <div className="px-2 space-y-0.5">
                  {mod.lessons.map((l) => {
                    const flat = flatLessons.find((f) => f.id === l.id);
                    if (!flat) return null;
                    return (
                      <LessonItem
                        key={l.id}
                        lesson={flat}
                        isActive={l.id === lessonId}
                        isCompleted={completedIds.has(l.id)}
                        locked={lessonsLocked}
                        onClick={() => goToLesson(l.id)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {middleExams.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-2 px-4 py-2">
                  <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    แบบทดสอบ
                  </span>
                </div>
                <div className="px-2 space-y-0.5">
                  {middleExams.map((exam) => (
                    <ExamSidebarItem key={exam.id} exam={exam} isPassed={examPassed(exam.id)} />
                  ))}
                </div>
              </div>
            )}

            {postExams.length > 0 && (
              <div className="mt-1 border-t border-border pt-1">
                <div className="flex items-center gap-2 px-4 py-2">
                  <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    หลังเรียน
                  </span>
                </div>
                <div className="px-2 space-y-0.5">
                  {postExams.map((exam) => (
                    <ExamSidebarItem key={exam.id} exam={exam} isPassed={examPassed(exam.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {!lessonId ? (
            /* ── Course overview ── */
            <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">

              {/* Hero */}
              <div className="overflow-hidden border border-border bg-card">
                <div className="h-1.5 bg-primary" />
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary">
                      <GraduationCap className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-foreground">{course.title}</h1>
                      {course.summary && (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{course.summary}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-primary" />
                          {course.modules.length} บท · {totalLessons} บทเรียน
                        </span>
                        {course.estimatedMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            {course.estimatedMinutes} นาที
                          </span>
                        )}
                        {allExams.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                            {allExams.length} แบบทดสอบ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {lessonsLocked ? (
                      <Link
                        to={`/exams/${preTestExams[0]?.id ?? ''}`}
                        className="flex items-center gap-2 border border-amber-300 bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 hover:-translate-y-0.5"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        ทำแบบทดสอบก่อนเรียน
                      </Link>
                    ) : flatLessons[0] ? (
                      <button
                        onClick={() => flatLessons[0] && goToLesson(flatLessons[0].id)}
                        className="flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5"
                      >
                        <Play className="h-4 w-4 fill-primary-foreground" />
                        เริ่มเรียน
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {preTestExams.length > 0 && (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                    <ClipboardCheck className="h-4 w-4 text-amber-500" />
                    แบบทดสอบก่อนเรียน
                  </h2>
                  {preTestExams.map((exam) => (
                    <ExamCard key={exam.id} exam={exam} isPassed={examPassed(exam.id)} isForced={!examPassed(exam.id)} />
                  ))}
                </div>
              )}

              {course.modules.map((mod, mIdx) => (
                <div key={mod.id} className="overflow-hidden border border-border bg-card">
                  <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-5 py-3">
                    <span className="flex h-6 w-6 items-center justify-center bg-foreground text-[10px] font-bold text-background">
                      {mIdx + 1}
                    </span>
                    <span className="font-semibold text-foreground">{mod.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{mod.lessons.length} บทเรียน</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {mod.lessons.map((l) => (
                      <li key={l.id}>
                        {lessonsLocked ? (
                          <div className="flex items-center gap-3 px-5 py-3 opacity-50 cursor-not-allowed">
                            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1 text-sm text-muted-foreground">{l.title}</span>
                            {l.durationSeconds && l.durationSeconds > 0 && (
                              <span className="text-xs text-muted-foreground">{fmtSec(l.durationSeconds)}</span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => goToLesson(l.id)}
                            className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-muted"
                          >
                            <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                            <span className="flex-1 text-sm text-foreground/80">{l.title}</span>
                            {l.durationSeconds && l.durationSeconds > 0 && (
                              <span className="text-xs text-muted-foreground">{fmtSec(l.durationSeconds)}</span>
                            )}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {middleExams.length > 0 && (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    แบบทดสอบระหว่างเรียน
                  </h2>
                  {middleExams.map((exam) => (
                    <ExamCard key={exam.id} exam={exam} isPassed={examPassed(exam.id)} />
                  ))}
                </div>
              )}

              {postExams.length > 0 && (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                    <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                    แบบทดสอบหลังเรียน
                  </h2>
                  {postExams.map((exam) => (
                    <ExamCard key={exam.id} exam={exam} isPassed={examPassed(exam.id)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Lesson view ── */
            <>
              {/* Video area — only shown when there is a video (or while loading/error) */}
              {(lessonQuery.isLoading || lessonQuery.isError || videoContent?.url) && (
              <div className="bg-[#1a1a1a]">
                {lessonQuery.isLoading ? (
                  <div className="flex aspect-video w-full max-h-[480px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent" />
                  </div>
                ) : lessonQuery.isError ? (
                  <div className="flex aspect-video w-full max-h-[300px] items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <BookOpen className="h-10 w-10 opacity-40" />
                      <span className="text-sm">ไม่สามารถโหลดบทเรียนได้</span>
                      <span className="text-xs opacity-70">
                        {(lessonQuery.error as { response?: { data?: { error?: { message?: string } } } })
                          ?.response?.data?.error?.message ?? 'กรุณาตรวจสอบสิทธิ์การเข้าถึง'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <VideoPlayer
                    lessonId={lessonId}
                    src={videoContent!.url!}
                    initialPositionSec={progress?.lastPositionSec ?? 0}
                    initialSecondsWatched={progress?.secondsWatched ?? 0}
                    antiAfkEnabled={course.antiAfkEnabled ?? true}
                    onComplete={() =>
                      setCompletedIds((prev) => { const n = new Set(prev); n.add(lessonId); return n; })
                    }
                  />
                )}
              </div>
              )}

              {/* Lesson nav bar */}
              <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => prevLesson && goToLesson(prevLesson.id)}
                    disabled={!prevLesson}
                    className="flex items-center gap-1 border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    ก่อนหน้า
                  </button>

                  <div className="flex-1 min-w-0">
                    {lessonQuery.isLoading ? (
                      <div className="h-4 w-48 animate-pulse bg-muted" />
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold text-foreground">{lesson?.title}</p>
                        {currentIdx >= 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            {currentIdx + 1}/{totalLessons}
                            {lesson?.durationSeconds ? ` · ${fmtSec(lesson.durationSeconds)} นาที` : ''}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => nextLesson && goToLesson(nextLesson.id)}
                    disabled={!nextLesson}
                    className="flex items-center gap-1 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-30"
                  >
                    ถัดไป
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {progress && (
                  <div className="mt-2.5 h-1 w-full overflow-hidden bg-muted">
                    <div
                      className={cn('h-full transition-all duration-500',
                        isCompleted ? 'bg-emerald-500' : 'bg-primary')}
                      style={{ width: `${lessonPct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="border-b border-border bg-card px-6">
                {([
                  { key: 'content', icon: BookOpen, label: 'เนื้อหา' },
                  { key: 'notes',   icon: Pencil,   label: 'โน้ต' },
                  { key: 'qa',      icon: MessageSquare, label: 'Q&A' },
                ] as { key: Tab; icon: LucideIcon; label: string }[]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                      tab === key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab panels — wider when there is no video so PDFs/slides are easy to read */}
              <div className={cn('mx-auto px-6 py-6', videoContent?.url ? 'max-w-3xl' : 'max-w-5xl')}>

                {tab === 'content' && (
                  <div className="space-y-5">
                    {otherContents.map((content) => {
                      const Icon = CONTENT_ICON[content.type] ?? FileText;
                      return (
                        <div key={content.id} className="overflow-hidden border border-border bg-card">
                          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-2.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{content.type}</span>
                          </div>
                          <div className="p-5">
                            {content.title && <h3 className="mb-2 font-semibold text-foreground">{content.title}</h3>}
                            {content.body && (
                              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{content.body}</p>
                            )}

                            {/* PDF — embed inline so learners stay in the classroom */}
                            {content.type === 'PDF' && content.url && (
                              <div className="space-y-2">
                                <iframe
                                  src={getPdfEmbedUrl(content.url)}
                                  className="w-full border border-border"
                                  style={{ height: '600px' }}
                                  title={content.title ?? 'PDF'}
                                  loading="lazy"
                                />
                                <a href={content.url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
                                  <ExternalLink className="h-3 w-3" /> เปิดไฟล์ในแท็บใหม่
                                </a>
                              </div>
                            )}

                            {/* Slides — embed inline */}
                            {content.type === 'SLIDES' && content.url && (
                              <div className="space-y-2">
                                <div className="aspect-video w-full overflow-hidden border border-border">
                                  <iframe
                                    src={getSlidesEmbedUrl(content.url)}
                                    className="h-full w-full"
                                    allowFullScreen
                                    title={content.title ?? 'Slides'}
                                    loading="lazy"
                                  />
                                </div>
                                <a href={content.url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
                                  <ExternalLink className="h-3 w-3" /> เปิดสไลด์ในแท็บใหม่
                                </a>
                              </div>
                            )}

                            {/* Audio — inline player */}
                            {content.type === 'AUDIO' && content.url && lessonId && (
                              <AudioPlayer lessonId={lessonId} src={content.url} initialPositionSec={0} />
                            )}

                            {/* External link / other URL types — open in a new tab */}
                            {content.url && !['PDF', 'SLIDES', 'AUDIO'].includes(content.type) && (
                              <a
                                href={content.url} target="_blank" rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-2 border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                เปิดเนื้อหา
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {lesson?.summary && (
                      <div className="border border-border bg-card p-5">
                        <h3 className="mb-2 text-sm font-semibold text-foreground/80">เกี่ยวกับบทเรียนนี้</h3>
                        <p className="text-sm leading-7 text-foreground/70">{lesson.summary}</p>
                      </div>
                    )}

                    {/* No video → the learner confirms completion manually after reading. */}
                    {!videoContent?.url && lessonId && (
                      isCompleted ? (
                        <div className="flex items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 py-4 text-sm font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> เรียนจบบทเรียนนี้แล้ว
                        </div>
                      ) : (
                        <button
                          onClick={() => markCompleteMutation.mutate()}
                          disabled={markCompleteMutation.isPending || lessonsLocked}
                          className="flex w-full items-center justify-center gap-2 bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                        >
                          {markCompleteMutation.isPending
                            ? <div className="h-4 w-4 animate-spin border-2 border-primary-foreground border-t-transparent" />
                            : <CheckCircle2 className="h-4 w-4" />}
                          ทำเครื่องหมายว่าเรียนจบบทเรียนนี้
                        </button>
                      )
                    )}

                    {nextLesson ? (
                      <button
                        onClick={() => goToLesson(nextLesson.id)}
                        className="flex w-full items-center gap-4 border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary">
                          <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-[11px] font-medium text-primary">บทเรียนถัดไป</p>
                          <p className="truncate font-semibold text-foreground">{nextLesson.title}</p>
                          <p className="text-xs text-muted-foreground">{nextLesson.moduleTitle}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                      </button>
                    ) : (
                      <div className="flex flex-col items-center justify-center border border-emerald-100 bg-emerald-50 py-8 text-center">
                        <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                        <p className="mt-3 font-semibold text-emerald-700">เรียนครบทุกบทเรียนแล้ว</p>
                        {postExams.length > 0 && (
                          <p className="mt-1 text-sm text-muted-foreground">อย่าลืมทำแบบทดสอบหลังเรียนด้วยนะ</p>
                        )}
                        <div className="mt-3 flex gap-2">
                          {postExams[0] && (
                            <Link
                              to={`/exams/${postExams[0].id}`}
                              className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                            >
                              ทำแบบทดสอบหลังเรียน
                            </Link>
                          )}
                          <Link
                            to={`/courses/${courseId}`}
                            className="border border-emerald-200 bg-card px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                          >
                            กลับหน้าหลักสูตร
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab === 'notes' && (
                  <div className="border border-border bg-card overflow-hidden">
                    <NotesPanel lessonId={lessonId} currentTimeSec={videoTimeSec} />
                  </div>
                )}

                {tab === 'qa' && (
                  <div className="border border-border bg-card p-5">
                    <CourseQA courseId={courseId!} />
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
