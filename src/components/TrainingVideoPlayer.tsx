import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Badge, ProgressBar } from './ui';
import { getSignedUrl } from '@/lib/materialsService';
import { reportVideoProgress, friendlyError, type VideoHeartbeatResult } from '@/lib/assessmentService';
import type { TrainingMaterial, VideoLessonProgress } from '@/types';

interface Props {
  material: TrainingMaterial;
  progress: VideoLessonProgress | undefined;
  onServerProgress: (r: VideoHeartbeatResult) => void;
}

const FLUSH_MS = 4000;
const MAX_RATE = 2;

/**
 * Plays an uploaded training video and reports actually-watched segments to the server.
 * Completion (>= 95% of the video covered) is decided by the database — the browser cannot mark it.
 */
export function TrainingVideoPlayer({ material, progress, onServerProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState(progress?.coverage ?? 0);
  const [completed, setCompleted] = useState(progress?.completed ?? false);
  const [time, setTime] = useState({ current: 0, duration: material.duration_seconds ?? 0 });

  const seg = useRef<{ start: number; last: number } | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const lastFlush = useRef(0);
  const resumed = useRef(false);

  useEffect(() => { setCoverage(progress?.coverage ?? 0); setCompleted(progress?.completed ?? false); }, [progress?.coverage, progress?.completed]);

  useEffect(() => {
    let cancelled = false;
    setSrc(null); setLoadError(null);
    getSignedUrl(material).then((u) => { if (!cancelled) setSrc(u); }).catch((e) => { if (!cancelled) setLoadError((e as Error).message); });
    return () => { cancelled = true; };
  }, [material]);

  const flush = useCallback(() => {
    const s = seg.current;
    const v = videoRef.current;
    if (!s || !v) return;
    const from = s.start;
    const to = s.last;
    seg.current = { start: to, last: to };
    lastFlush.current = Date.now();
    if (to - from < 0.25) return;
    const duration = Number.isFinite(v.duration) ? v.duration : null;
    queue.current = queue.current.then(async () => {
      try {
        const r = await reportVideoProgress(material.id, from, to, duration);
        setCoverage(Number(r.coverage));
        setCompleted(r.completed);
        setSyncError(null);
        onServerProgress(r);
      } catch (err) {
        setSyncError(friendlyError(err));
      }
    });
  }, [material.id, onServerProgress]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setTime({ current: t, duration: Number.isFinite(v.duration) ? v.duration : time.duration });
    if (v.paused || v.seeking) return;
    const s = seg.current;
    if (!s) { seg.current = { start: t, last: t }; return; }
    // timeupdate fires ~4x/sec; a larger jump means the student seeked — close the segment there.
    if (t < s.last || t - s.last > 1.5) {
      flush();
      seg.current = { start: t, last: t };
      return;
    }
    s.last = t;
    if (Date.now() - lastFlush.current >= FLUSH_MS) flush();
  };

  const onPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    seg.current = { start: v.currentTime, last: v.currentTime };
    lastFlush.current = Date.now();
  };

  const onPauseLike = () => { flush(); seg.current = null; };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setTime({ current: v.currentTime, duration: v.duration });
    // Resume where the student left off (unless already finished).
    if (!resumed.current && progress && !progress.completed && progress.lastPosition > 5 && progress.lastPosition < v.duration - 5) {
      v.currentTime = progress.lastPosition;
    }
    resumed.current = true;
  };

  const onRateChange = () => {
    const v = videoRef.current;
    if (v && v.playbackRate > MAX_RATE) v.playbackRate = MAX_RATE;
  };

  // Flush on tab hide / unmount so watched time isn't lost.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [flush]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-line-subtle">
        {!src && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 text-muted-500 animate-spin" /></div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <AlertCircle className="w-8 h-8 text-lava-400 mb-2" />
            <p className="text-sm text-lava-400">The video could not be loaded.</p>
            <p className="text-xs text-muted-500 mt-1">{loadError}</p>
          </div>
        )}
        {src && (
          <video
            ref={videoRef}
            src={src}
            controls
            controlsList="nodownload"
            disablePictureInPicture
            playsInline
            preload="metadata"
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            onPlay={onPlay}
            onPause={onPauseLike}
            onSeeking={onPauseLike}
            onEnded={onPauseLike}
            onRateChange={onRateChange}
            onError={() => setLoadError('This browser cannot play the uploaded format. MP4 (H.264) or WebM is recommended.')}
            className="w-full h-full object-contain"
          />
        )}
        {completed && (
          <div className="absolute top-3 right-3 pointer-events-none"><Badge variant="success"><CheckCircle className="w-3 h-3" /> Completed</Badge></div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1"><ProgressBar value={completed ? 100 : coverage} color={completed ? 'emerald' : 'lava'} size="sm" /></div>
        <span className="text-xs text-muted-400 tabular-nums w-24 text-right">{completed ? 'Complete' : `${Math.round(coverage)}% watched`}</span>
        {time.duration > 0 && <span className="text-xs text-muted-500 tabular-nums">{fmt(time.current)} / {fmt(time.duration)}</span>}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-500">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
        Progress is verified by the server from the portions you actually watch (95% required; up to 2× speed). Skipping ahead does not count.
      </div>
      {syncError && <p className="text-xs text-amber-400">Progress sync issue: {syncError}</p>}
    </div>
  );
}
