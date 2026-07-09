import { useEffect, useRef } from 'react';
import { upsertLessonProgress } from './learning-phase3.api';

interface Props {
  lessonId: string;
  src: string;
  initialPositionSec: number;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ lessonId, src, initialPositionSec }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchedRef = useRef(0);

  // Resume from saved position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || initialPositionSec <= 0) return;
    const onCanPlay = () => {
      if (audio.currentTime < initialPositionSec) {
        audio.currentTime = initialPositionSec;
      }
    };
    audio.addEventListener('canplay', onCanPlay, { once: true });
    return () => audio.removeEventListener('canplay', onCanPlay);
  }, [initialPositionSec]);

  // Save progress while playing + mark complete on ended
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const save = (completed = false) => {
      void upsertLessonProgress(lessonId, {
        lastPositionSec: Math.floor(audio.currentTime),
        secondsWatched: watchedRef.current,
        completed,
      });
    };

    const onPlay = () => {
      timerRef.current = setInterval(() => {
        watchedRef.current += 10;
        save();
      }, 10_000);
    };
    const onPause = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      save();
    };
    const onEnded = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      save(true);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [lessonId]);

  return (
    <div className="border border-border bg-muted p-4">
      <audio ref={audioRef} src={src} controls className="w-full" preload="metadata" />
      {initialPositionSec > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          เล่นต่อจากตำแหน่ง {formatTime(initialPositionSec)}
        </p>
      )}
    </div>
  );
}
