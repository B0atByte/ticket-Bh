import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardCheck, GraduationCap, Loader2, Play, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ExamRunner } from '../features/learning/ExamRunner';
import { confirmAction } from '../lib/confirm';
import { listExams, startAttempt, type ExamType, type StartAttemptResponse, type SubmitAttemptResponse } from '../features/learning/learning.api';

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  QUIZ: 'แบบทดสอบ',
  ASSESSMENT: 'แบบประเมิน',
  PRE_TEST: 'ทดสอบก่อนอบรม',
  POST_TEST: 'ทดสอบหลังอบรม',
  CERTIFICATION: 'แบบทดสอบรับรอง',
  SURVEY: 'แบบสำรวจ',
};

const EXAM_TYPE_REQUIREMENT: Partial<Record<ExamType, string>> = {
  POST_TEST: 'ต้องเรียนจบคอร์สที่เชื่อมไว้ก่อนจึงจะทำได้',
  QUIZ: 'ต้องลงทะเบียนเรียนคอร์สที่เชื่อมไว้ก่อน',
  ASSESSMENT: 'ต้องลงทะเบียนเรียนคอร์สที่เชื่อมไว้ก่อน',
  PRE_TEST: 'ต้องลงทะเบียนเรียนคอร์สที่เชื่อมไว้ก่อน',
  CERTIFICATION: 'ต้องลงทะเบียนเรียนคอร์สที่เชื่อมไว้ก่อน',
};

export function ExamPage() {
  const { t } = useTranslation();
  const { examId } = useParams<{ examId: string }>();
  const [session, setSession] = useState<StartAttemptResponse | null>(null);
  const [result, setResult] = useState<SubmitAttemptResponse | null>(null);
  const examsQuery = useQuery({
    queryKey: ['exams'],
    queryFn: () => listExams(),
  });
  const exam = examsQuery.data?.items.find((item) => item.id === examId);
  const startMutation = useMutation({
    mutationFn: () => startAttempt(examId!),
    onSuccess: (data) => {
      setResult(null);
      setSession(data);
    },
  });

  if (!examId) return null;

  if (result) {
    const pending = result.hasPendingManual;
    return (
      <div className="mx-auto max-w-2xl border bg-card p-6 text-center">
        <ClipboardCheck className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">ส่งข้อสอบเรียบร้อย</h1>
        {pending ? (
          <p className="mt-2 text-sm text-muted-foreground">
            ข้อสอบบางข้อต้องตรวจด้วยมือ — ผลคะแนนสุดท้ายจะแสดงเมื่อการตรวจเสร็จสิ้น
          </p>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-2">
            {result.result.passed ? (
              <CheckCircle2 className="h-16 w-16 text-emerald-500" aria-hidden="true" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive" aria-hidden="true" />
            )}
            <div className={`text-4xl font-extrabold ${result.result.passed ? 'text-emerald-600' : 'text-destructive'}`}>
              {result.result.passed ? t('exam.passed') : t('exam.notPassed')}
            </div>
            <div className="text-2xl font-bold tabular-nums">{String(result.result.scorePct ?? 0)}%</div>
            <p className="text-sm text-muted-foreground">
              {t('exam.score')} {result.result.score ?? 0}/{result.result.maxScore ?? 0}
            </p>
            {result.videoProgressReset && (
              <div className="mt-3 border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
                สอบครบจำนวนครั้งที่กำหนดแล้ว — ความคืบหน้าวิดีโอถูกรีเซ็ต ต้องกลับไปดูบทเรียนใหม่ตั้งแต่ต้นก่อนสอบอีกครั้ง
              </div>
            )}
            {result.unlockCode && (
              <div className="mt-4 w-full border border-primary/30 bg-primary/5 px-4 py-3 text-center">
                <p className="text-sm text-muted-foreground">โค้ดปลดล็อกหลักสูตรถัดไป</p>
                <p className="mt-1 font-semibold text-foreground">{result.unlockCode.courseTitle}</p>
                <p className="mt-2 select-all font-mono text-2xl font-bold tracking-widest text-primary">
                  {result.unlockCode.code}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  นำโค้ดนี้ไปกรอกที่หน้า "บทเรียน" เพื่อปลดล็อกหลักสูตรถัดไป
                </p>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {exam?.courseId && (
            <Button asChild>
              <Link to={`/courses/${exam.courseId}/learn`}>
                <GraduationCap className="h-4 w-4" /> เริ่มเข้าเรียน
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`/attempts?examId=${examId}`}>ดูประวัติการสอบ</Link>
          </Button>
          <Button asChild variant={exam?.courseId ? 'ghost' : 'default'}>
            <Link to="/dashboard">กลับสู่แดชบอร์ด</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (session) return <ExamRunner session={session} onResult={setResult} />;

  return (
    <div className="mx-auto max-w-2xl border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center border bg-muted">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{exam?.title ?? t('exam.title')}</h1>
            {exam?.type && (
              <span className="border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {EXAM_TYPE_LABEL[exam.type]}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {exam
              ? `${exam._count.questions} ${t('exam.questions')} · ${t('exam.passingScore')} ${exam.passingScore}%`
              : 'ข้อสอบที่เผยแพร่'}
          </p>
          {exam?.type && exam.courseId && EXAM_TYPE_REQUIREMENT[exam.type] && (
            <div className="mt-3 flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{EXAM_TYPE_REQUIREMENT[exam.type]}</span>
            </div>
          )}
        </div>
      </div>
      {startMutation.isError && (
        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {(startMutation.error as { response?: { data?: { error?: { message?: string } } } } | null)
                ?.response?.data?.error?.message
                ?? 'ไม่สามารถเริ่มข้อสอบได้ กรุณาตรวจสอบเงื่อนไขการเข้าสอบ'}
            </span>
          </div>
          <Link to={`/attempts?examId=${examId}`} className="inline-block text-xs text-primary underline-offset-2 hover:underline">
            ดูประวัติการสอบทั้งหมด
          </Link>
        </div>
      )}
      <Button
        className="mt-6"
        onClick={async () => {
          const timeNote = exam?.timeLimitMinutes
            ? `<br><small>มีเวลาจำกัด ${exam.timeLimitMinutes} นาที — เมื่อเริ่มแล้วเวลาจะเดินทันที</small>`
            : '';
          if (await confirmAction('เริ่มทำข้อสอบ?', `ยืนยันเริ่มทำ <b>${exam?.title ?? ''}</b>?${timeNote}`, 'เริ่มทำ')) {
            startMutation.mutate();
          }
        }}
        disabled={startMutation.isPending}
      >
        {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {t('exam.startExam')}
      </Button>
    </div>
  );
}
