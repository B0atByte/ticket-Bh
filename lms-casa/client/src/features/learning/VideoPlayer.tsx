/**
 * Phase 3 — VideoPlayer
 * HTML5 video with:
 *  - Resume from last position (lastPositionSec)
 *  - Progress tracking debounced every 10s → upsertLessonProgress
 *  - Speed control (0.5x – 2x)
 *  - Captions/subtitles (via <track> elements in meta)
 *  - Accessible controls (ARIA, keyboard)
 */
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Pause, Play, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { getAntiAfk } from '../admin/admin.api';
import { getVideoEmbed } from '../../lib/video-embed';
import { loadYouTubeApi, YT_STATE_ENDED, YT_STATE_PLAYING, type YTPlayer } from '../../lib/youtube';
import { logLessonSeekBlocked, resetLessonProgressAfk, upsertLessonProgress } from './learning-phase3.api';

/** Shared react-query options for the admin-controlled Anti-AFK config. */
// Anti-AFK is on only when BOTH the global setting and the course opt-in allow it.
function useAntiAfkOptions(courseEnabled = true): AfkOptions {
  const { data } = useQuery({
    queryKey: ['anti-afk-config'],
    queryFn: getAntiAfk,
    staleTime: 5 * 60_000,
  });
  return {
    enabled: (data?.enabled ?? false) && courseEnabled,
    minIntervalMs: (data?.minIntervalSec ?? 30) * 1000,
    maxIntervalMs: (data?.maxIntervalSec ?? 60) * 1000,
    answerTimeoutSec: data?.answerTimeoutSec ?? 10,
  };
}

interface Caption {
  src: string;
  srclang: string;
  label: string;
}

interface VideoPlayerProps {
  lessonId: string;
  src: string;
  /** Resume position in seconds */
  initialPositionSec?: number;
  /** Already-watched seconds (for accumulation) */
  initialSecondsWatched?: number;
  captions?: Caption[];
  onComplete?: () => void;
  /** Per-course opt-in for Anti-AFK; defaults to true. */
  antiAfkEnabled?: boolean;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const DEBOUNCE_MS = 10_000; // save every 10 s

// ── Anti-AFK shared logic ──────────────────────────────────────────────────────
// Config is admin-controlled (Settings → Anti-AFK) and fetched per player.
// Player-agnostic: the host supplies pause/play/seekToStart so the same guard
// works for both <video> (HTML5) and the YouTube IFrame player. Fail/timeout
// resets lesson progress (must re-watch) but never affects exam eligibility.
interface AfkControls {
  pause: () => void;
  play: () => void;
  seekToStart: () => void;
}

interface AfkOptions {
  enabled: boolean;
  minIntervalMs: number;
  maxIntervalMs: number;
  answerTimeoutSec: number;
}

function useAfkGuard(
  lessonId: string,
  playing: boolean,
  controls: AfkControls,
  options: AfkOptions,
) {
  const { enabled, minIntervalMs, maxIntervalMs, answerTimeoutSec } = options;
  const [challenge, setChallenge] = useState<{ a: number; b: number } | null>(null);
  const [answer, setAnswer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(answerTimeoutSec);
  const [kicked, setKicked] = useState(false);
  const scheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const clearTimers = useCallback(() => {
    if (scheduleRef.current) { clearTimeout(scheduleRef.current); scheduleRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const fail = useCallback(() => {
    clearTimers();
    setChallenge(null);
    setKicked(true);
    controlsRef.current.pause();
    controlsRef.current.seekToStart();
    resetLessonProgressAfk(lessonId).catch(() => {
      /* best effort — server is authoritative on next load */
    });
  }, [clearTimers, lessonId]);

  const start = useCallback(() => {
    controlsRef.current.pause();
    setAnswer('');
    setSecondsLeft(answerTimeoutSec);
    setChallenge({ a: 1 + Math.floor(Math.random() * 9), b: 1 + Math.floor(Math.random() * 9) });
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
  }, [answerTimeoutSec]);

  // Schedule a random check while the video is actually playing.
  useEffect(() => {
    if (!enabled || !playing || challenge || kicked) return;
    const delay = minIntervalMs + Math.random() * Math.max(0, maxIntervalMs - minIntervalMs);
    scheduleRef.current = setTimeout(() => start(), delay);
    return () => {
      if (scheduleRef.current) { clearTimeout(scheduleRef.current); scheduleRef.current = null; }
    };
  }, [enabled, minIntervalMs, maxIntervalMs, playing, challenge, kicked, start]);

  // Timeout → kick (kept out of the countdown updater to avoid side effects mid-render).
  useEffect(() => {
    if (challenge && secondsLeft === 0) fail();
  }, [challenge, secondsLeft, fail]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!challenge) return;
      if (Number(answer) === challenge.a + challenge.b) {
        clearTimers();
        setChallenge(null);
        controlsRef.current.play();
      } else {
        fail();
      }
    },
    [challenge, answer, clearTimers, fail],
  );

  const resume = useCallback(() => {
    setKicked(false);
    controlsRef.current.play();
  }, []);

  return { challenge, answer, setAnswer, secondsLeft, answerTimeoutSec, kicked, submit, resume };
}

type AfkGuard = ReturnType<typeof useAfkGuard>;

function AfkOverlays({ afk }: { afk: AfkGuard }) {
  return (
    <>
      {afk.challenge && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ยืนยันว่ายังดูอยู่"
        >
          <form onSubmit={afk.submit} className="w-full max-w-xs bg-card p-5 text-center shadow-warm">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-500" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              ยืนยันว่ายังดูอยู่ — ตอบภายใน {afk.secondsLeft} วินาที
            </p>
            <div className="mt-3 text-2xl font-bold">
              {afk.challenge.a} + {afk.challenge.b} = ?
            </div>
            <input
              type="number"
              autoFocus
              value={afk.answer}
              onChange={(e) => afk.setAnswer(e.target.value)}
              className="mt-3 w-full border px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="คำตอบ"
            />
            <button
              type="submit"
              className="mt-3 w-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              ยืนยัน
            </button>
            <div className="mt-3 h-1.5 w-full overflow-hidden bg-muted">
              <div
                className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                style={{ width: `${(afk.secondsLeft / afk.answerTimeoutSec) * 100}%` }}
              />
            </div>
          </form>
        </div>
      )}

      {afk.kicked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 text-center">
          <div className="w-full max-w-xs bg-card p-5 shadow-warm">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="mt-2 font-semibold">ไม่ได้ตอบทันเวลา</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ความคืบหน้าถูกรีเซ็ต ต้องเริ่มดูบทเรียนนี้ใหม่ตั้งแต่ต้น (ไม่กระทบสิทธิ์สอบ)
            </p>
            <button
              type="button"
              onClick={afk.resume}
              className="mt-3 w-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              เริ่มดูใหม่
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function VideoPlayer(props: VideoPlayerProps) {
  const embed = getVideoEmbed(props.src);
  if (embed?.provider === 'youtube') {
    return (
      <YouTubePlayer
        lessonId={props.lessonId}
        videoId={embed.videoId}
        initialPositionSec={props.initialPositionSec}
        initialSecondsWatched={props.initialSecondsWatched}
        onComplete={props.onComplete}
        antiAfkEnabled={props.antiAfkEnabled}
      />
    );
  }
  if (embed) {
    return (
      <EmbedPlayer
        lessonId={props.lessonId}
        embedUrl={embed.embedUrl}
        provider={embed.provider}
        onComplete={props.onComplete}
      />
    );
  }
  return <Html5VideoPlayer {...props} />;
}

function Html5VideoPlayer({
  lessonId,
  src,
  initialPositionSec = 0,
  initialSecondsWatched = 0,
  captions = [],
  onComplete,
  antiAfkEnabled = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPositionSec);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);

  // Accumulated watch time since last save
  const watchedRef = useRef(initialSecondsWatched);
  const lastSaveTimeRef = useRef<number>(Date.now());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  // Anti-skip: furthest point actually reached by normal playback. Forward-seeking
  // past this is blocked so learners can't jump ahead to the 90% completion mark.
  const maxReachedRef = useRef(initialPositionSec);
  const lastSkipLogRef = useRef(0);

  const afk = useAfkGuard(
    lessonId,
    playing,
    {
      pause: () => videoRef.current?.pause(),
      play: () => {
        void videoRef.current?.play();
      },
      seekToStart: () => {
        const video = videoRef.current;
        if (video) video.currentTime = 0;
        watchedRef.current = 0;
        completedRef.current = false;
        maxReachedRef.current = 0; // must re-watch from the very start
      },
    },
    useAntiAfkOptions(antiAfkEnabled),
  );

  // ── save progress ──────────────────────────────────────────────────────────
  const saveProgress = useCallback(
    async (positionSec: number, force = false) => {
      const video = videoRef.current;
      if (!video) return;
      const now = Date.now();
      const elapsed = Math.round((now - lastSaveTimeRef.current) / 1000);
      if (playing) watchedRef.current += elapsed;
      lastSaveTimeRef.current = now;

      const shouldComplete =
        !completedRef.current && duration > 0 && positionSec >= duration * 0.9;

      if (force || shouldComplete) {
        try {
          await upsertLessonProgress(lessonId, {
            lastPositionSec: Math.round(positionSec),
            secondsWatched: watchedRef.current,
            completed: shouldComplete || undefined,
          });
          if (shouldComplete) {
            completedRef.current = true;
            onComplete?.();
          }
        } catch {
          // fire-and-forget — don't block UI
        }
      }
    },
    [lessonId, playing, duration, onComplete],
  );

  // Debounced periodic save
  useEffect(() => {
    if (!playing) return;
    saveTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video) saveProgress(video.currentTime);
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [playing, saveProgress]);

  // Save on unmount / pause
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) saveProgress(video.currentTime, true);
    };
  }, [saveProgress]);

  // Save when the tab is hidden (switching tabs / closing) so resume survives.
  useEffect(() => {
    function onHidden() {
      if (document.visibilityState !== 'hidden') return;
      const video = videoRef.current;
      if (video) saveProgress(video.currentTime, true);
    }
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [saveProgress]);

  // ── video event handlers ───────────────────────────────────────────────────
  function onLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    if (initialPositionSec > 0 && initialPositionSec < video.duration) {
      video.currentTime = initialPositionSec;
    }
  }

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    // Track the furthest point reached by normal playback (for anti-skip).
    if (video.currentTime > maxReachedRef.current) maxReachedRef.current = video.currentTime;
    // Update buffered
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }
  }

  function onEnded() {
    setPlaying(false);
    saveProgress(duration, true);
  }

  function onPlay() { setPlaying(true); }
  function onPause() {
    setPlaying(false);
    const video = videoRef.current;
    if (video) saveProgress(video.currentTime, true);
  }

  // ── controls ───────────────────────────────────────────────────────────────
  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    const requested = Number(e.target.value);
    // Anti-skip: allow seeking backward / within watched, but not past the
    // furthest point actually viewed (+ small tolerance). Log blocked attempts.
    const limit = maxReachedRef.current + 1.5;
    const t = Math.min(requested, limit);
    if (requested > limit) {
      const now = Date.now();
      if (now - lastSkipLogRef.current > 30_000) {
        lastSkipLogRef.current = now;
        logLessonSeekBlocked(lessonId).catch(() => {/* best effort */});
      }
    }
    video.currentTime = t;
    setCurrentTime(t);
  }

  function changeSpeed(s: number) {
    const video = videoRef.current;
    if (video) video.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="group relative overflow-hidden bg-black" role="region" aria-label="Video player">
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        aria-label="Lesson video"
        preload="metadata"
      >
        {captions.map((c) => (
          <track key={c.srclang} kind="subtitles" src={c.src} srcLang={c.srclang} label={c.label} />
        ))}
        Your browser does not support the video element.
      </video>

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-6 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {/* Progress bar */}
        <div className="relative mb-2 h-1.5 w-full bg-white/30">
          {/* Buffered */}
          <div
            className="absolute left-0 top-0 h-full bg-white/40"
            style={{ width: `${bufferedPct}%` }}
            aria-hidden="true"
          />
          {/* Played */}
          <div
            className="absolute left-0 top-0 h-full bg-primary"
            style={{ width: `${progressPct}%` }}
            aria-hidden="true"
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={1}
            value={currentTime}
            onChange={seek}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Seek video"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing
              ? <Pause className="h-4 w-4" aria-hidden="true" />
              : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>

          {/* Time */}
          <span className="text-xs tabular-nums text-white/80" aria-live="off">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Speed control */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSpeedMenu((v) => !v)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Playback speed"
              aria-expanded={showSpeedMenu}
              aria-haspopup="listbox"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              {speed}x
            </button>
            {showSpeedMenu && (
              <ul
                role="listbox"
                aria-label="Playback speed options"
                className="absolute bottom-full right-0 mb-1 overflow-hidden border bg-popover shadow-warm-sm"
              >
                {SPEEDS.map((s) => (
                  <li key={s} role="option" aria-selected={speed === s}>
                    <button
                      type="button"
                      onClick={() => changeSpeed(s)}
                      className={[
                        'block w-full px-4 py-1.5 text-left text-sm hover:bg-accent',
                        speed === s ? 'font-semibold text-primary' : '',
                      ].join(' ')}
                    >
                      {s}x
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <AfkOverlays afk={afk} />
    </div>
  );
}

interface YouTubePlayerProps {
  lessonId: string;
  videoId: string;
  initialPositionSec?: number;
  initialSecondsWatched?: number;
  onComplete?: () => void;
  antiAfkEnabled?: boolean;
}

/**
 * YouTube via the IFrame Player API so we can track progress and run Anti-AFK
 * (pause/seek/state) — a plain <iframe> exposes none of that across origins.
 */
function YouTubePlayer({
  lessonId,
  videoId,
  initialPositionSec = 0,
  initialSecondsWatched = 0,
  onComplete,
  antiAfkEnabled = true,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;

  const watchedRef = useRef(initialSecondsWatched);
  const lastSaveRef = useRef<number>(Date.now());
  const completedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveProgress = useCallback(
    async (force = false) => {
      const player = playerRef.current;
      if (!player) return;
      const cur = player.getCurrentTime();
      const dur = player.getDuration();
      const now = Date.now();
      const elapsed = Math.round((now - lastSaveRef.current) / 1000);
      if (playingRef.current) watchedRef.current += elapsed;
      lastSaveRef.current = now;

      const shouldComplete = !completedRef.current && dur > 0 && cur >= dur * 0.9;
      if (force || shouldComplete) {
        try {
          await upsertLessonProgress(lessonId, {
            lastPositionSec: Math.round(cur),
            secondsWatched: watchedRef.current,
            completed: shouldComplete || undefined,
          });
          if (shouldComplete) {
            completedRef.current = true;
            onComplete?.();
          }
        } catch {
          /* fire-and-forget */
        }
      }
    },
    [lessonId, onComplete],
  );

  const afk = useAfkGuard(
    lessonId,
    playing,
    {
      pause: () => playerRef.current?.pauseVideo(),
      play: () => playerRef.current?.playVideo(),
      seekToStart: () => {
        playerRef.current?.seekTo(0, true);
        watchedRef.current = 0;
        completedRef.current = false;
      },
    },
    useAntiAfkOptions(antiAfkEnabled),
  );

  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(initialPositionSec) },
        events: {
          onStateChange: (e) => {
            setPlaying(e.data === YT_STATE_PLAYING);
            if (e.data === YT_STATE_ENDED) void saveProgress(true);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // saveProgress/initialPositionSec are stable enough; re-create only on video change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Periodic save while playing
  useEffect(() => {
    if (!playing) return;
    saveTimerRef.current = setInterval(() => void saveProgress(), DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [playing, saveProgress]);

  // Save on unmount
  useEffect(() => () => void saveProgress(true), [saveProgress]);

  // Save when the tab is hidden (switching tabs / closing) so resume survives.
  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === 'hidden') void saveProgress(true);
    }
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [saveProgress]);

  return (
    <div
      className="relative w-full overflow-hidden bg-black"
      style={{ paddingTop: '56.25%' }}
      role="region"
      aria-label="YouTube video player"
    >
      <div ref={hostRef} className="absolute inset-0 h-full w-full" />
      <AfkOverlays afk={afk} />
    </div>
  );
}

interface EmbedPlayerProps {
  lessonId: string;
  embedUrl: string;
  provider: 'youtube' | 'vimeo';
  onComplete?: () => void;
}

function EmbedPlayer({ lessonId, embedUrl, provider, onComplete }: EmbedPlayerProps) {
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function markComplete() {
    if (completed || saving) return;
    setSaving(true);
    try {
      await upsertLessonProgress(lessonId, {
        lastPositionSec: 0,
        secondsWatched: 0,
        completed: true,
      });
      setCompleted(true);
      onComplete?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3" role="region" aria-label="Embedded video player">
      <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          title={provider === 'youtube' ? 'YouTube video player' : 'Vimeo video player'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="flex items-center justify-between gap-3 border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <span>วิดีโอจาก {provider === 'youtube' ? 'YouTube' : 'Vimeo'} — ความคืบหน้าไม่ติดตามอัตโนมัติ</span>
        <button
          type="button"
          onClick={markComplete}
          disabled={completed || saving}
          className="inline-flex items-center gap-1.5 border border-emerald-300 bg-card px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          aria-label="ทำเครื่องหมายว่าเรียนจบบทเรียนนี้"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {completed ? 'เรียนจบแล้ว' : saving ? 'กำลังบันทึก…' : 'ทำเครื่องหมายว่าเรียนจบ'}
        </button>
      </div>
    </div>
  );
}
