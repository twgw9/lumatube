import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Segment, Video } from "@/lib/types";
import { clamp } from "@/lib/utils";

export interface ABLoop {
  a: number;
  b: number | null;
}

export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

interface UsePlayerOptions {
  video: Video | null;
  segments: Segment[];
  enabledCategories: string[];
  muteInsteadOfSkip: boolean;
  startAt?: number;
  autoplay?: boolean;
  initialSpeed?: number;
  seekStep?: number;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
  onSpeedChange?: (speed: number) => void;
}

/**
 * Headless player controller for the native engine (`<video>`).
 * Keeps all "smart" behaviour in one place so the UI stays dumb:
 *  - SponsorBlock auto-skip / mute with per-category toggles
 *  - A-B loop with frame-accurate guards
 *  - speed + volume persistence
 *  - resume + progress throttling
 *  - keyboard shortcuts (space, arrows, j/k/l, [, ], m, f)
 */
export function usePlayer({
  video,
  segments,
  enabledCategories,
  muteInsteadOfSkip,
  startAt = 0,
  autoplay = true,
  initialSpeed = 1,
  seekStep = 10,
  onProgress,
  onEnded,
  onSpeedChange,
}: UsePlayerOptions) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeedState] = useState(initialSpeed);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [ab, setAB] = useState<ABLoop | null>(null);
  const [skipped, setSkipped] = useState<{ category: string; seconds: number; id: number } | null>(null);
  const [loopCount, setLoopCount] = useState(0);
  const [quality, setQualityState] = useState("auto");
  const [stats, setStats] = useState({ dropped: 0, total: 0, bitrateKbps: 0, bufferSec: 0 });
  const [sleepAt, setSleepAt] = useState<number | null>(null); // epoch ms
  const [loopVideo, setLoopVideo] = useState(false);

  const lastSave = useRef(0);
  const skipGuard = useRef(0);
  const sleepAtRef = useRef<number | null>(null);

  /* ── active skip segments (skip action only) ─────────────── */
  const activeSegments = useMemo(
    () =>
      segments
        .filter((s) => s.action === "skip" && enabledCategories.includes(s.category))
        .sort((a, b) => a.startSec - b.startSec),
    [segments, enabledCategories],
  );

  const applyStartPosition = useCallback(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(startAt)) return;
    try {
      el.currentTime = startAt;
    } catch {
      /* metadata not ready yet */
    }
  }, [startAt]);

  /* ── element wiring ──────────────────────────────────────── */
  const bind = useCallback(
    (el: HTMLVideoElement | null) => {
      ref.current = el;
      if (!el) return;
      el.playbackRate = initialSpeed;
      el.volume = volume;
    },
    [initialSpeed, volume],
  );

  const seek = useCallback((sec: number, rel = false) => {
    const el = ref.current;
    if (!el) return;
    const target = clamp(rel ? el.currentTime + sec : sec, 0, el.duration || Infinity);
    el.currentTime = target;
    setTime(target);
  }, []);

  const play = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    try {
      await el.play();
      setStatus("playing");
    } catch {
      // autoplay blocked by the browser → start muted (user can unmute)
      try {
        el.muted = true;
        setMuted(true);
        await el.play();
        setStatus("playing");
      } catch {
        setStatus("paused");
      }
    }
  }, []);

  const pause = useCallback(() => {
    ref.current?.pause();
    setStatus("paused");
  }, []);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void play();
    else pause();
  }, [pause, play]);

  const setSpeed = useCallback(
    (v: number) => {
      const el = ref.current;
      if (!el) return;
      el.playbackRate = v;
      setSpeedState(v);
      onSpeedChange?.(v);
    },
    [onSpeedChange],
  );

  /** Switch stream URL in place, keeping position, speed and volume. */
  const setSource = useCallback(
    (url: string, label: string) => {
      const el = ref.current;
      if (!el || !url) return;
      const at = el.currentTime;
      const playing = !el.paused;
      el.src = url;
      el.load();
      const restore = () => {
        el.currentTime = at;
        el.playbackRate = speed;
        if (playing) void el.play().catch(() => undefined);
        el.removeEventListener("loadedmetadata", restore);
      };
      el.addEventListener("loadedmetadata", restore);
      setQualityState(label);
    },
    [speed],
  );

  const setVolume = useCallback((v: number) => {
    const el = ref.current;
    const nv = clamp(v, 0, 1);
    if (el) {
      el.volume = nv;
      el.muted = nv === 0;
    }
    setVolumeState(nv);
    setMuted(nv === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  /** minutes = 0 cancels */
  const setSleepTimer = useCallback((minutes: number) => {
    if (minutes <= 0) {
      sleepAtRef.current = null;
      setSleepAt(null);
      return;
    }
    const at = Date.now() + minutes * 60_000;
    sleepAtRef.current = at;
    setSleepAt(at);
  }, []);

  /* ── A-B loop ────────────────────────────────────────────── */
  const setPoint = useCallback(
    (which: "a" | "b") => {
      const t = ref.current?.currentTime ?? time;
      setAB((prev) => {
        if (which === "a") {
          const b = prev?.b ?? null;
          return { a: t, b: b !== null && b > t ? b : null };
        }
        const a = prev?.a ?? 0;
        return t > a ? { a, b: t } : { a, b: null };
      });
    },
    [time],
  );
  const clearAB = useCallback(() => {
    setAB(null);
    setLoopCount(0);
  }, []);

  /* ── main tick loop (single source of truth) ─────────────── */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = 0;

    const tick = () => {
      const t = el.currentTime;
      const now = performance.now();

      if (now - last > 100) {
        last = now;
        setTime(t);
        setDuration(el.duration || 0);
        const buf = el.buffered;
        setBuffered(buf.length ? buf.end(buf.length - 1) : 0);

        // playback health (shown in the stats panel)
        const q = el.getVideoPlaybackQuality?.();
        if (q) {
          const bufferSec = Math.max(0, (buf.length ? buf.end(buf.length - 1) : 0) - t);
          setStats({
            dropped: q.droppedVideoFrames ?? 0,
            total: q.totalVideoFrames ?? 0,
            bitrateKbps:
              el.duration && "webkitVideoDecodedByteCount" in el
                ? Math.round(
                    ((el as unknown as { webkitVideoDecodedByteCount: number })
                      .webkitVideoDecodedByteCount /
                      1024) /
                      Math.max(1, el.duration),
                  )
                : 0,
            bufferSec: Math.round(bufferSec),
          });
        }

        /* sleep timer */
        if (sleepAtRef.current && Date.now() >= sleepAtRef.current) {
          el.pause();
          setSleepAt(null);
          sleepAtRef.current = null;
        }

        /* A-B loop */
        if (ab && ab.b !== null && t >= ab.b) {
          el.currentTime = ab.a;
          setLoopCount((c) => c + 1);
        }

        /* SponsorBlock skip */
        if (now - skipGuard.current > 800) {
          const hit = activeSegments.find((s) => t >= s.startSec && t < s.endSec - 0.15);
          if (hit) {
            skipGuard.current = now;
            if (muteInsteadOfSkip) {
              el.volume = 0;
              const targetEnd = hit.endSec;
              const restore = () => {
                if (el.currentTime >= targetEnd - 0.2) {
                  el.volume = volume;
                  el.removeEventListener("timeupdate", restore);
                }
              };
              el.addEventListener("timeupdate", restore);
            } else {
              el.currentTime = hit.endSec + 0.05;
            }
            setSkipped({
              category: hit.category,
              seconds: Math.round(hit.endSec - hit.startSec),
              id: Date.now(),
            });
            window.setTimeout(() => setSkipped(null), 4200);
          }
        }

        /* throttled progress persistence (every 5s) */
        if (now - lastSave.current > 5000 && el.duration > 0) {
          lastSave.current = now;
          onProgress?.(t, el.duration);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ab, activeSegments, muteInsteadOfSkip, onProgress, volume]);

  /* ── keyboard shortcuts ──────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest("input, textarea, [contenteditable='true'], select")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = ref.current;
      if (!el) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seek(seekStep, true);
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seek(-seekStep, true);
          break;
        case "arrowup":
          e.preventDefault();
          setVolume(volume + 0.05);
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume(volume - 0.05);
          break;
        case "]":
          e.preventDefault();
          setSpeed(nextSpeed(speed, 1));
          break;
        case "[":
          e.preventDefault();
          setSpeed(nextSpeed(speed, -1));
          break;
        case "m":
          toggleMute();
          break;
        case "a":
          setPoint("a");
          break;
        case "b":
          setPoint("b");
          break;
        case "escape":
          clearAB();
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          seek(((el.duration || 0) * Number(e.key)) / 10);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearAB, seek, seekStep, setPoint, setSpeed, setVolume, speed, toggle, toggleMute, volume]);

  /* ── media events ────────────────────────────────────────── */
  const handlers = {
    onLoadedMetadata: () => {
      setDuration(ref.current?.duration ?? 0);
      if (startAt > 0.5) applyStartPosition();
      setStatus("ready");
      if (autoplay) void play();
    },
    onPlay: () => setStatus("playing"),
    onPause: () => setStatus((s) => (s === "ended" ? s : "paused")),
    onWaiting: () => setStatus("loading"),
    onPlaying: () => setStatus("playing"),
    onEnded: () => {
      if (loopVideo && ref.current) {
        ref.current.currentTime = 0;
        void ref.current.play().catch(() => undefined);
        return;
      }
      setStatus("ended");
      onProgress?.(duration, duration);
      onEnded?.();
    },
    onError: () => setStatus("error"),
    onProgress: () => {
      const el = ref.current;
      if (!el) return;
      const b = el.buffered;
      setBuffered(b.length ? b.end(b.length - 1) : 0);
    },
  };

  return {
    ref,
    bind,
    handlers,
    quality,
    loopVideo,
    setLoopVideo,
    sleepAt,
    setSleepTimer,
    setSource,
    stats,
    setQualityState,
    status,
    time,
    duration,
    buffered,
    speed,
    volume,
    muted,
    ab,
    loopCount,
    skipped,
    segments,
    activeSegments,
    play,
    pause,
    toggle,
    seek,
    setSpeed,
    setVolume,
    toggleMute,
    setPoint,
    clearAB,
  };
}

function nextSpeed(current: number, dir: 1 | -1): number {
  const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
  const i = steps.findIndex((s) => Math.abs(s - current) < 0.01);
  const next = clamp((i === -1 ? steps.indexOf(1) : i) + dir, 0, steps.length - 1);
  return steps[next];
}
