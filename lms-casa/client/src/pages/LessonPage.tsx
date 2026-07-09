import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Film,
  Headphones,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { RichTextView } from '../components/ui/RichTextEditor';
import { AudioPlayer } from '../features/learning/AudioPlayer';
import { NotesPanel } from '../features/learning/NotesPanel';
import { VideoPlayer } from '../features/learning/VideoPlayer';
import { getLessonProgress } from '../features/learning/learning-phase3.api';
import { getCourse, getLesson, type LessonContent } from '../features/learning/learning.api';
import { getPdfEmbedUrl, getSlidesEmbedUrl } from '../lib/video-embed';

const CONTENT_TYPE_META: Record<string, { icon: LucideIcon; label: string }> = {
  TEXT:  { icon: FileText,   label: 'เนื้อหา' },
  HTML:  { icon: FileText,   label: 'เนื้อหา HTML' },
  VIDEO: { icon: Film,       label: 'วิดีโอ' },
  AUDIO: { icon: Headphones, label: 'เสียง' },
  PDF:   { icon: FileText,   label: 'เอกสาร PDF' },
  SLIDES:{ icon: ImageIcon,  label: 'สไลด์' },
  LINK:  { icon: LinkIcon,   label: 'ลิงก์' },
  SCORM: { icon: PlayCircle, label: 'SCORM' },
};

function ContentBlock({
  content,
  lessonId,
  audioInitialSec,
}: {
  content: LessonContent;
  lessonId: string;
  audioInitialSec: number;
}) {
  const meta = CONTENT_TYPE_META[content.type] ?? { icon: FileText, label: content.type };
  const Icon = meta.icon;

  return (
    <article
      className="border border-border bg-card p-5"
      aria-label={content.title ?? content.type}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {meta.label}
      </div>

      {content.title && (
        <h2 className="mt-2 text-base font-semibold text-foreground">{content.title}</h2>
      )}

      <div className="mt-3">
        {(content.type === 'TEXT' || content.type === 'HTML') && content.body && (
          <RichTextView
            html={content.body}
            className="text-sm leading-7 text-foreground/80
              [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mb-2
              [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mb-2
              [&>h3]:font-semibold [&>h3]:mb-1
              [&>p]:mb-3 [&>p]:last:mb-0
              [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3
              [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3
              [&>li]:mb-1
              [&>blockquote]:border-l-4 [&>blockquote]:border-border [&>blockquote]:pl-3 [&>blockquote]:text-muted-foreground
              [&>strong]:font-semibold [&>em]:italic"
          />
        )}

        {content.type === 'PDF' && content.url && (
          <div className="space-y-2">
            <iframe
              src={getPdfEmbedUrl(content.url)}
              className="w-full border border-border"
              style={{ height: '600px' }}
              title={content.title ?? 'PDF'}
              loading="lazy"
            />
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              เปิดไฟล์ในหน้าใหม่
            </a>
          </div>
        )}

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
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              เปิดสไลด์ในหน้าใหม่
            </a>
          </div>
        )}

        {content.type === 'AUDIO' && content.url && (
          <AudioPlayer
            lessonId={lessonId}
            src={content.url}
            initialPositionSec={audioInitialSec}
          />
        )}

        {content.type === 'LINK' && content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            เปิดลิงก์
          </a>
        )}
      </div>
    </article>
  );
}

export function LessonPage() {
  const { t } = useTranslation();
  const { lessonId } = useParams<{ lessonId: string }>();
  const [videoTimeSec] = useState(0);
  const completedRef = useRef(false);

  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => getLesson(lessonId!),
    enabled: Boolean(lessonId),
  });

  // The lesson's course controls whether Anti-AFK runs for its videos.
  const lessonCourseId = lessonQuery.data?.courseId ?? null;
  const courseQuery = useQuery({
    queryKey: ['course', lessonCourseId],
    queryFn: () => getCourse(lessonCourseId!),
    enabled: Boolean(lessonCourseId),
  });

  const progressQuery = useQuery({
    queryKey: ['lesson-progress', lessonId],
    queryFn: () => getLessonProgress(lessonId!),
    enabled: Boolean(lessonId),
  });

  if (lessonQuery.isLoading || progressQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading lesson" />
      </div>
    );
  }

  if (lessonQuery.isError || !lessonQuery.data) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
        {t('lesson.notFound')}
      </div>
    );
  }

  const lesson = lessonQuery.data;
  const progress = progressQuery.data;

  const videoContent = lesson.contents.find((c) => c.type === 'VIDEO');
  const otherContents = lesson.contents.filter((c) => c.type !== 'VIDEO');

  const audioInitialSec = videoContent ? 0 : (progress?.lastPositionSec ?? 0);

  const progressPct = progress
    ? progress.status === 'COMPLETED'
      ? 100
      : Math.min(100, Math.round((progress.lastPositionSec / Math.max(lesson.durationSeconds ?? 1, 1)) * 100))
    : 0;
  const isCompleted = progress?.status === 'COMPLETED';

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[{ label: t('nav.courses'), to: '/courses' }, { label: lesson.title }]}
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Left: content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Lesson header */}
          <section className="border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-border bg-muted">
                <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold leading-7 tracking-tight text-foreground">
                  {lesson.title}
                </h1>
                {lesson.summary && (
                  <p className="mt-1 text-sm text-muted-foreground">{lesson.summary}</p>
                )}
              </div>
              {isCompleted && (
                <span className="inline-flex flex-shrink-0 items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('lesson.completed')}
                </span>
              )}
            </div>

            {progress && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {isCompleted ? t('lesson.completed') : t('lesson.inProgress')}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">{progressPct}%</span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden bg-muted"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Lesson progress"
                >
                  <div
                    className={`h-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Video player */}
          {videoContent?.url && (
            <section aria-label="Video content">
              <VideoPlayer
                lessonId={lessonId!}
                src={videoContent.url}
                initialPositionSec={progress?.lastPositionSec ?? 0}
                initialSecondsWatched={progress?.secondsWatched ?? 0}
                antiAfkEnabled={courseQuery.data?.antiAfkEnabled ?? true}
                onComplete={() => { completedRef.current = true; }}
              />
            </section>
          )}

          {/* Other content blocks */}
          {otherContents.length > 0 && (
            <div className="space-y-3">
              {otherContents.map((content) => (
                <ContentBlock
                  key={content.id}
                  content={content}
                  lessonId={lessonId!}
                  audioInitialSec={audioInitialSec}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: notes panel */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0" aria-label="Notes and bookmarks">
          <div className="sticky top-20 h-[500px] lg:h-[600px]">
            <NotesPanel lessonId={lessonId!} currentTimeSec={videoTimeSec} />
          </div>
        </aside>
      </div>
    </div>
  );
}
