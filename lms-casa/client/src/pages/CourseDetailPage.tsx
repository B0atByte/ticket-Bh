import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  KeyRound,
  Loader2,
  Lock,
  MessageSquare,
  Move,
  Pencil,
  Play,
  PlayCircle,
  Send,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { PageHeader as SharedPageHeader } from '../components/ui/PageHeader';
import { RichTextView } from '../components/ui/RichTextEditor';
import { useAuthStore } from '../features/auth/auth.store';
import { alertWarning, confirmAction, confirmDanger } from '../lib/confirm';
import { CourseBuilder } from '../features/learning/CourseBuilder';
import { CourseFormDialog } from '../features/learning/CourseFormDialog';
import { CourseQA } from '../features/learning/CourseQA';
import { getCourseLessonProgress } from '../features/learning/learning-phase3.api';
import {
  MyPracticalEvaluationCard,
  PracticalCriteriaManager,
  PracticalEvaluationDialog,
  PracticalResultBadge,
} from '../features/learning/PracticalEvaluation';
import {
  adminAssignEnrollment,
  adminUpdateEnrollmentStatus,
  adminWithdrawEnrollment,
  grantEnrollmentStar,
  issueUnlockCode,
  revokeEnrollmentStar,
  archiveCourse,
  deleteCourse,
  getCourse,
  getMyEnrollment,
  listCourseEnrollments,
  listExams,
  publishCourse,
  selfEnroll,
  selfUnenroll,
  type CourseStarStatus,
  type EnrollmentStatus,
} from '../features/learning/learning.api';

function statusBadgeStyle(status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'): string {
  if (status === 'PUBLISHED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'DRAFT') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-border bg-muted text-muted-foreground';
}

const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  ASSIGNED: 'ได้รับมอบหมาย',
  IN_PROGRESS: 'กำลังเรียน',
  COMPLETED: 'เรียนจบแล้ว',
  EXPIRED: 'หมดอายุ',
  WITHDRAWN: 'ถอนตัว',
};

const ENROLLMENT_STATUS_CLS: Record<EnrollmentStatus, string> = {
  ASSIGNED: 'bg-secondary text-secondary-foreground',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  EXPIRED: 'bg-muted text-muted-foreground',
  WITHDRAWN: 'bg-destructive/10 text-destructive',
};

function StarResult({
  status,
  attempts,
  progressPct,
  hasPostTest,
}: {
  status: CourseStarStatus;
  attempts: number;
  progressPct: number;
  hasPostTest: boolean;
}) {
  if (status === 'PASSED') {
    return (
      <span className="inline-flex items-center gap-1 border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> ได้ดาว
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        ไม่ผ่าน{attempts > 1 ? ` · รอบ ${attempts}` : ''}
      </span>
    );
  }
  if (status === 'IN_PROGRESS') {
    if (progressPct >= 100) {
      return hasPostTest ? (
        <span className="inline-flex items-center border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          รอสอบหลังเรียน
        </span>
      ) : (
        <span className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          เรียนจบเนื้อหา
        </span>
      );
    }
    return (
      <span className="inline-flex items-center border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
        กำลังเรียน {progressPct}%
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">ยังไม่เริ่ม</span>;
}

type Tab = 'content' | 'exams' | 'builder' | 'enrollments' | 'practical' | 'qa';

export function CourseDetailPage() {
  const { t } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('content');
  const canEdit = useAuthStore((s) => s.hasPermission('course.update'));
  const canPublish = useAuthStore((s) => s.hasPermission('course.publish'));
  const canDelete = useAuthStore((s) => s.hasPermission('course.delete'));
  const canManageEnrollments = useAuthStore((s) => s.hasPermission('enrollment.assign'));
  const canReadEnrollments = useAuthStore((s) => s.hasPermission('enrollment.read'));
  const canGrantStar = useAuthStore((s) => s.hasPermission('enrollment.grant_star'));
  const canManagePractical = useAuthStore((s) => s.hasPermission('practical_eval.manage'));
  const canGradePractical = useAuthStore((s) => s.hasPermission('practical_eval.grade'));
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAdminRole = useAuthStore((s) => s.user?.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN') ?? false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [unenrollError, setUnenrollError] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourse(courseId!),
    enabled: Boolean(courseId),
  });
  const lessonProgressQuery = useQuery({
    queryKey: ['course-lesson-progress', courseId],
    queryFn: () => getCourseLessonProgress(courseId!),
    enabled: Boolean(courseId),
  });

  const publishMut = useMutation({
    mutationFn: () => publishCourse(courseId!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
  });
  const archiveMut = useMutation({
    mutationFn: () => archiveCourse(courseId!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteCourse(courseId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigate('/courses');
    },
  });
  const examsQuery = useQuery({
    queryKey: ['exams', courseId],
    queryFn: () => listExams(courseId),
    enabled: Boolean(courseId),
  });

  const myEnrollmentQuery = useQuery({
    queryKey: ['enrollment', 'me', courseId],
    queryFn: () => getMyEnrollment(courseId!),
    enabled: Boolean(courseId),
  });

  const courseEnrollmentsQuery = useQuery({
    queryKey: ['enrollments', courseId],
    queryFn: () => listCourseEnrollments(courseId!),
    enabled: Boolean(courseId) && canReadEnrollments,
  });

  const enrollMut = useMutation({
    mutationFn: () => selfEnroll(courseId!),
    onSuccess: () => {
      setEnrollError(null);
      void queryClient.invalidateQueries({ queryKey: ['enrollment', 'me', courseId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'ไม่สามารถลงทะเบียนได้';
      setEnrollError(msg);
    },
  });

  const unenrollMut = useMutation({
    mutationFn: () => selfUnenroll(courseId!),
    onSuccess: () => {
      setUnenrollError(null);
      void queryClient.invalidateQueries({ queryKey: ['enrollment', 'me', courseId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'ไม่สามารถยกเลิกได้';
      setUnenrollError(msg);
    },
  });

  const assignMut = useMutation({
    mutationFn: (userId: string) => adminAssignEnrollment(courseId!, userId),
    onSuccess: () => {
      setAssignUserId('');
      setAssignError(null);
      void queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'ไม่สามารถเพิ่มผู้เรียนได้';
      setAssignError(msg);
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnrollmentStatus }) =>
      adminUpdateEnrollmentStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] }),
  });

  const withdrawMut = useMutation({
    mutationFn: (id: string) => adminWithdrawEnrollment(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] }),
  });

  const grantStarMut = useMutation({
    mutationFn: (id: string) => grantEnrollmentStar(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] }),
  });
  const revokeStarMut = useMutation({
    mutationFn: (id: string) => revokeEnrollmentStar(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] }),
  });
  const issueCodeMut = useMutation({
    mutationFn: (vars: { userId: string; nextCourseId: string }) => issueUnlockCode(vars.userId, vars.nextCourseId),
    onSuccess: (r) =>
      void alertWarning(
        'โค้ดปลดล็อก',
        `หลักสูตร: <b>${r.courseTitle}</b><br>โค้ด: <span style="font-size:1.4em;font-weight:700;letter-spacing:2px">${r.code}</span><br><small>มอบโค้ดนี้ให้พนักงานนำไปกรอกที่หน้า "บทเรียน"</small>`,
      ),
  });

  if (courseQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }
  if (courseQuery.isError || !courseQuery.data) {
    return (
      <div className="border bg-card p-4 text-sm text-destructive" role="alert">
        ไม่พบหลักสูตร
      </div>
    );
  }

  const course = courseQuery.data;
  const canGradeThisCourse = canGradePractical && (isAdminRole || course.author?.id === currentUserId);
  const showPracticalTab = canManagePractical || canGradeThisCourse;
  const exams = examsQuery.data?.items ?? [];
  const completedLessonIds = new Set(
    (lessonProgressQuery.data ?? []).filter((p) => p.status === 'COMPLETED').map((p) => p.lessonId),
  );

  const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  const myEnrollment = myEnrollmentQuery.data;
  const isEnrolled = Boolean(myEnrollment);

  const enrollAction = !canEdit && course && course.status === 'PUBLISHED' ? (
    isEnrolled ? (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <span className={`border px-2.5 py-0.5 text-xs font-medium ${ENROLLMENT_STATUS_CLS[myEnrollment!.status as EnrollmentStatus]}`}>
            {ENROLLMENT_STATUS_LABEL[myEnrollment!.status as EnrollmentStatus]}
          </span>
          <Button asChild size="sm">
            <Link to={`/courses/${courseId}/learn`}>
              <Play className="h-3.5 w-3.5 fill-white" />
              {myEnrollment?.status === 'COMPLETED' ? 'ดูซ้ำ' : 'เข้าเรียน'}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={async () => {
              const isCompleted = myEnrollment?.status === 'COMPLETED';
              const { default: Swal } = await import('sweetalert2');
              const result = await Swal.fire({
                title: isCompleted ? 'ลงทะเบียนเรียนใหม่?' : 'ยืนยันการยกเลิก?',
                html: isCompleted
                  ? 'คุณเคยเรียนหลักสูตรนี้แล้ว<br>ต้องการรีเซ็ตและเริ่มเรียนใหม่ตั้งแต่ต้นหรือไม่?'
                  : 'ต้องการยกเลิกการลงทะเบียนหลักสูตรนี้หรือไม่?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: isCompleted ? 'ใช่ เรียนใหม่เลย' : 'ยืนยัน',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#1B7E5D',
                cancelButtonColor: '#C9E8DA',
                reverseButtons: true,
              });
              if (!result.isConfirmed) return;
              setUnenrollError(null);
              unenrollMut.mutate();
            }}
            disabled={unenrollMut.isPending}
            title="ยกเลิกการลงทะเบียน"
          >
            {unenrollMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            {myEnrollment?.status === 'COMPLETED' ? 'เรียนซ้ำ' : 'ยกเลิก'}
          </Button>
        </div>
        {unenrollError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {unenrollError}
          </p>
        )}
      </div>
    ) : course.requiresUnlockCode ? (
      <div className="flex flex-col items-end gap-1.5">
        <span className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
          <Lock className="h-3.5 w-3.5" /> ต้องใช้โค้ดปลดล็อก
        </span>
        <p className="max-w-[220px] text-right text-[11px] text-muted-foreground">
          หลักสูตรนี้ปลดล็อกด้วยโค้ดที่ได้จากการสอบผ่านหลักสูตรก่อนหน้า — กรอกโค้ดที่หน้า "บทเรียน"
        </p>
      </div>
    ) : (
      <div className="flex flex-col items-end gap-1.5">
        <Button
          onClick={async () => {
            if (await confirmAction('ลงทะเบียนเรียน?', `ยืนยันการลงทะเบียนเรียนหลักสูตร <b>${course.title}</b>?`, 'ลงทะเบียน')) {
              setEnrollError(null);
              enrollMut.mutate();
            }
          }}
          disabled={enrollMut.isPending}
        >
          {enrollMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          ลงทะเบียนเรียน
        </Button>
        {enrollError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {enrollError}
          </p>
        )}
      </div>
    )
  ) : null;

  const actions = canEdit ? (
    <>
      <CourseFormDialog
        mode="edit"
        course={{
          id: course.id,
          title: course.title,
          summary: course.summary,
          description: course.description,
          visibility: course.visibility,
          estimatedMinutes: course.estimatedMinutes,
          passingScore: course.passingScore,
          antiAfkEnabled: course.antiAfkEnabled,
          unlockNextCourseId: course.unlockNextCourseId,
          coverImageUrl: course.coverImageUrl,
        }}
        trigger={
          <Button variant="secondary">
            <Pencil className="h-4 w-4" /> {t('common.edit')}
          </Button>
        }
      />
      {canPublish && course.status === 'DRAFT' && (
        <Button
          variant="default"
          onClick={async () => {
            if (await confirmAction('เผยแพร่หลักสูตร?', `หลักสูตร <b>${course.title}</b> จะมองเห็นได้สำหรับผู้เรียนทุกคน`, 'เผยแพร่'))
              publishMut.mutate();
          }}
          disabled={publishMut.isPending}
        >
          <Send className="h-4 w-4" /> {t('course.publish')}
        </Button>
      )}
      {canPublish && course.status === 'PUBLISHED' && (
        <Button
          variant="secondary"
          onClick={async () => {
            if (await confirmDanger('เก็บถาวรหลักสูตร?', `หลักสูตร <b>${course.title}</b> จะถูกซ่อนจากผู้เรียน`, 'เก็บถาวร'))
              archiveMut.mutate();
          }}
          disabled={archiveMut.isPending}
        >
          <Archive className="h-4 w-4" /> {t('course.archive')}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10"
          onClick={async () => {
            if (await confirmDanger('ลบหลักสูตร?', `ลบ <b>${course.title}</b> ออกจากระบบ?<br><small>การกระทำนี้ไม่สามารถยกเลิกได้</small>`))
              deleteMut.mutate();
          }}
          disabled={deleteMut.isPending}
        >
          <Trash2 className="h-4 w-4" /> {t('common.delete')}
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <div className="space-y-6">
      <SharedPageHeader
        title={course.title}
        icon={BookOpen}
        breadcrumbs={[
          { label: t('nav.courses'), to: '/courses' },
          { label: course.title },
        ]}
        badge={
          <span className={`border px-2 py-0.5 text-xs font-medium ${statusBadgeStyle(course.status)}`}>
            {course.status === 'PUBLISHED'
              ? t('course.published')
              : course.status === 'DRAFT'
              ? t('course.draft')
              : t('course.archived')}
          </span>
        }
        actions={<>{enrollAction}{actions}</>}
      />

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-border bg-card px-5 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {course.modules.length} {t('course.modules')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PlayCircle className="h-3.5 w-3.5" />
          {totalLessons} {t('course.lessons')}
        </span>
        {course.estimatedMinutes && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {course.estimatedMinutes} {t('common.min')}
          </span>
        )}
        {course.passingScore != null && (
          <span className="inline-flex items-center gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            ผ่านที่ {course.passingScore}%
          </span>
        )}
      </div>

      {/* Description card */}
      {(course.description || course.summary) && (
        <section className="border border-border bg-card p-5">
          {course.description ? (
            <RichTextView html={course.description} />
          ) : (
            <p className="text-sm leading-7 text-foreground/80">{course.summary}</p>
          )}
        </section>
      )}

      {/* My progress — overall % for the enrolled learner */}
      {isEnrolled && myEnrollment && (
        <section className="border border-border bg-card p-4" aria-label="ความคืบหน้าของฉัน">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">ความคืบหน้าของฉัน</span>
            <span className="font-semibold text-primary">{myEnrollment.progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${myEnrollment.progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            เรียนแล้ว {completedLessonIds.size}/{totalLessons} บทเรียน
          </p>
        </section>
      )}

      {/* My practical evaluation — only rendered when the course has a checklist */}
      {isEnrolled && <MyPracticalEvaluationCard courseId={courseId!} enabled={isEnrolled} />}

      {/* Tabs */}
      <div className="border-b" role="tablist" aria-label="Course sections">
        {([
          'content',
          'exams',
          ...(canEdit ? (['builder'] as Tab[]) : []),
          ...(canReadEnrollments ? (['enrollments'] as Tab[]) : []),
          ...(showPracticalTab ? (['practical'] as Tab[]) : []),
          'qa',
        ] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            role="tab"
            aria-selected={tab === tabKey}
            onClick={() => setTab(tabKey)}
            className={[
              'inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              tab === tabKey
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tabKey === 'content' && (
              <><PlayCircle className="h-4 w-4" aria-hidden="true" /> {t('course.contentTab')}</>
            )}
            {tabKey === 'exams' && (
              <><ClipboardCheck className="h-4 w-4" aria-hidden="true" /> {t('nav.exams')} {exams.length > 0 ? `(${exams.length})` : ''}</>
            )}
            {tabKey === 'builder' && (
              <><Move className="h-4 w-4" aria-hidden="true" /> {t('course.builderTab')}</>
            )}
            {tabKey === 'enrollments' && (
              <><Users className="h-4 w-4" aria-hidden="true" /> ผู้เรียน {courseEnrollmentsQuery.data ? `(${courseEnrollmentsQuery.data.meta.total})` : ''}</>
            )}
            {tabKey === 'practical' && (
              <><ClipboardList className="h-4 w-4" aria-hidden="true" /> ภาคปฏิบัติ</>
            )}
            {tabKey === 'qa' && (
              <><MessageSquare className="h-4 w-4" aria-hidden="true" /> {t('course.qaTab')}</>
            )}
          </button>
        ))}
      </div>

      {/* Content tab */}
      {tab === 'content' && (
        <>
          <section className="space-y-3" aria-label="Lessons">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">{t('course.lessons')}</h2>
            </div>
            {course.modules.length === 0 ? (
              <div className="border border-border bg-card p-4 text-sm text-muted-foreground">
                {t('course.noLessons')}
              </div>
            ) : (
              <div className="space-y-3">
                {course.modules.map((module, mIdx) => (
                  <div
                    key={module.id}
                    className="overflow-hidden border border-border bg-card"
                  >
                    <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
                      <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center bg-foreground text-xs font-semibold text-background tabular-nums">
                        {mIdx + 1}
                      </span>
                      <h3 className="flex-1 text-sm font-semibold">{module.title}</h3>
                      <span className="text-xs text-muted-foreground">
                        เรียนแล้ว {module.lessons.filter((l) => completedLessonIds.has(l.id)).length}/{module.lessons.length} บท
                      </span>
                    </div>
                    {module.lessons.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        ยังไม่มีบทเรียนในหมวดนี้
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {module.lessons.map((lesson, lIdx) => (
                          <li key={lesson.id}>
                            <Link
                              to={`/courses/${courseId}/learn/${lesson.id}`}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:bg-muted"
                            >
                              <span className="w-6 flex-shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                                {mIdx + 1}.{lIdx + 1}
                              </span>
                              {completedLessonIds.has(lesson.id) ? (
                                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                              ) : (
                                <PlayCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              )}
                              <span className={`flex-1 ${completedLessonIds.has(lesson.id) ? 'text-muted-foreground' : 'text-foreground/80'}`}>
                                {lesson.title}
                              </span>
                              {lesson.durationSeconds != null && lesson.durationSeconds > 0 && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {Math.ceil(lesson.durationSeconds / 60)} นาที
                                </span>
                              )}
                              {!lesson.isRequired && (
                                <span className="border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  ไม่บังคับ
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Exams tab */}
      {tab === 'exams' && (
        <section className="space-y-3" aria-label="Exams">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">{t('nav.exams')}</h2>
            {exams.length > 0 && (
              <span className="text-xs text-muted-foreground">· {exams.length} ชุด</span>
            )}
          </div>
          {exams.length === 0 ? (
            <div className="border border-border bg-card p-4 text-sm text-muted-foreground">
              {t('exam.noPublished')}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex flex-col border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border bg-muted">
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{exam.title}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {exam._count.questions} {t('exam.questions')} · {t('exam.passingScore')}{' '}
                        {exam.passingScore}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/exams/${exam.id}`}>{t('exam.startExam')}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Builder tab */}
      {tab === 'builder' && canEdit && (
        <section className="space-y-3" aria-label="Course builder">
          <h2 className="text-lg font-semibold">{t('course.builderTab')}</h2>
          <CourseBuilder course={course} />
        </section>
      )}

      {/* Enrollments tab */}
      {tab === 'enrollments' && canReadEnrollments && (
        <section className="space-y-4">
          {/* Assign form */}
          {canManageEnrollments && (
            <div className="border border-border bg-muted/30 p-4">
              <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                เพิ่มผู้เรียน
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="User ID (ตัวเลข)"
                  value={assignUserId}
                  onChange={(e) => { setAssignUserId(e.target.value); setAssignError(null); }}
                  className="h-9 flex-1 border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  size="sm"
                  onClick={() => assignMut.mutate(assignUserId.trim())}
                  disabled={!assignUserId.trim() || assignMut.isPending}
                >
                  {assignMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  เพิ่ม
                </Button>
              </div>
              {assignError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {assignError}
                </p>
              )}
              {assignMut.isSuccess && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> เพิ่มผู้เรียนสำเร็จ
                </p>
              )}
            </div>
          )}

          {/* Enrollment list */}
          {courseEnrollmentsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : courseEnrollmentsQuery.data?.items.length === 0 ? (
            <div className="border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              ยังไม่มีผู้เรียนในหลักสูตรนี้
            </div>
          ) : (
            <div className="overflow-x-auto border border-border bg-card">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ผู้เรียน</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ผลการเรียน</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">สถานะ</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ความคืบหน้า</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">วันลงทะเบียน</th>
                    {canManageEnrollments && (
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">จัดการ</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {courseEnrollmentsQuery.data?.items.map((enr) => (
                    <tr key={enr.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-secondary text-[10px] font-bold text-secondary-foreground">
                            {enr.user.firstName[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <p className="font-medium">{enr.user.firstName} {enr.user.lastName}</p>
                            <p className="text-[11px] text-muted-foreground">{enr.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StarResult status={enr.starStatus} attempts={enr.postTestAttempts} progressPct={enr.progressPct} hasPostTest={enr.hasPostTest} />
                          {enr.manualStarGranted && (
                            <span className="text-[10px] text-muted-foreground">ให้โดยแอดมิน</span>
                          )}
                          {canGrantStar && (
                            enr.manualStarGranted ? (
                              <button
                                type="button"
                                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
                                disabled={revokeStarMut.isPending}
                                onClick={async () => {
                                  if (await confirmDanger('ถอนดาว?', `ถอนดาวที่ให้ <b>${enr.user.firstName} ${enr.user.lastName}</b> ในหลักสูตรนี้?`, 'ถอนดาว'))
                                    revokeStarMut.mutate(enr.id);
                                }}
                              >
                                ถอนดาว
                              </button>
                            ) : enr.starStatus !== 'PASSED' ? (
                              <button
                                type="button"
                                className="text-[11px] text-primary underline-offset-2 hover:underline disabled:opacity-50"
                                disabled={grantStarMut.isPending}
                                onClick={async () => {
                                  if (await confirmAction('ให้ดาว?', `ให้ดาว <b>${enr.user.firstName} ${enr.user.lastName}</b> สำหรับหลักสูตรนี้ (เคยเรียนนอกระบบ)?`, 'ให้ดาว'))
                                    grantStarMut.mutate(enr.id);
                                }}
                              >
                                ให้ดาว
                              </button>
                            ) : null
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {canManageEnrollments ? (
                          <select
                            value={enr.status}
                            onChange={(e) => updateStatusMut.mutate({ id: enr.id, status: e.target.value as EnrollmentStatus })}
                            className={`border-0 px-2.5 py-0.5 text-xs font-medium outline-none cursor-pointer ${ENROLLMENT_STATUS_CLS[enr.status as EnrollmentStatus]}`}
                          >
                            {(Object.keys(ENROLLMENT_STATUS_LABEL) as EnrollmentStatus[]).map((s) => (
                              <option key={s} value={s}>{ENROLLMENT_STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2.5 py-0.5 text-xs font-medium ${ENROLLMENT_STATUS_CLS[enr.status as EnrollmentStatus]}`}>
                            {ENROLLMENT_STATUS_LABEL[enr.status as EnrollmentStatus]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${enr.progressPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{enr.progressPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(enr.enrolledAt).toLocaleDateString('th-TH')}
                      </td>
                      {canManageEnrollments && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {course.unlockNextCourseId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-primary hover:bg-primary/10"
                                title="ออกโค้ดปลดล็อกหลักสูตรถัดไปให้ผู้เรียนคนนี้"
                                onClick={() => issueCodeMut.mutate({ userId: enr.user.id, nextCourseId: course.unlockNextCourseId! })}
                                disabled={issueCodeMut.isPending}
                              >
                                <KeyRound className="h-3.5 w-3.5" /> ออกโค้ด
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                if (await confirmDanger('ถอนผู้เรียน?', `ถอน <b>${enr.user.firstName} ${enr.user.lastName}</b> ออกจากหลักสูตรนี้?`, 'ถอน'))
                                  withdrawMut.mutate(enr.id);
                              }}
                              disabled={withdrawMut.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Practical evaluation tab */}
      {tab === 'practical' && showPracticalTab && (
        <div className="space-y-6">
          {canManagePractical && <PracticalCriteriaManager courseId={courseId!} />}

          {canGradeThisCourse && (
            <section className="space-y-3" aria-label="ประเมินผู้เรียน">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">ประเมินผู้เรียน</h2>
              </div>
              {courseEnrollmentsQuery.isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : courseEnrollmentsQuery.data?.items.length === 0 ? (
                <div className="border border-border bg-card p-4 text-sm text-muted-foreground">
                  ยังไม่มีผู้เรียนในหลักสูตรนี้
                </div>
              ) : (
                <ul className="divide-y divide-border border border-border bg-card">
                  {courseEnrollmentsQuery.data?.items.map((enr) => (
                    <li key={enr.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-secondary text-[10px] font-bold text-secondary-foreground">
                        {enr.user.firstName[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="flex-1 text-sm">{enr.user.firstName} {enr.user.lastName}</span>
                      <PracticalResultBadge result={enr.practicalResult ?? 'PENDING'} />
                      <PracticalEvaluationDialog
                        enrollmentId={enr.id}
                        courseId={courseId!}
                        learnerName={`${enr.user.firstName} ${enr.user.lastName}`}
                        trigger={
                          <Button size="sm" variant="secondary">
                            <ClipboardList className="h-3.5 w-3.5" /> ประเมิน
                          </Button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {/* Q&A tab */}
      {tab === 'qa' && <CourseQA courseId={courseId!} />}
    </div>
  );
}
