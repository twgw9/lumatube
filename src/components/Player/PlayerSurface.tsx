import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Grid2x2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  Settings2,
  Moon,
  Repeat1,
  ListPlus,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Segment, Video } from "@/lib/types";
import type { StreamInfo } from "@/lib/bridge";
import { usePlayer } from "@/hooks/usePlayer";
import { cn, formatTime } from "@/lib/utils";
import { SPEEDS } from "@/store/settings";
import { IconButton } from "@/components/ui";

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  sponsor: { label: "Sponsor", color: "#22c55e" },
  selfpromo: { label: "Self-promo", color: "#eab308" },
  interaction: { label: "Subscribe ask", color: "#a855f7" },
  intro: { label: "Intro", color: "#38bdf8" },
  outro: { label: "Outro", color: "#38bdf8" },
  preview: { label: "Preview", color: "#64748b" },
  music_offtopic: { label: "Non-music", color: "#f472b6" },
  filler: { label: "Filler", color: "#94a3b8" },
  highlight: { label: "Highlight", color: "#f59e0b" },
  poi_highlight: { label: "Highlight", color: "#f59e0b" },
};

interface PlayerSurfaceProps {
  video: Video;
  stream: StreamInfo | null;
  segments: Segment[];
  enabledCategories: string[];
  muteInsteadOfSkip: boolean;
  startAt: number;
  onProgress: (pos: number, dur: number) => void;
  onEnded: () => void;
  onSpeedPersist?: (speed: number) => void;
  onDownload?: () => void;
  onBookmark?: (sec: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  autoplay: boolean;
  theater?: boolean;
  onToggleTheater?: () => void;
}

export function PlayerSurface({
  video,
  stream,
  segments,
  enabledCategories,
  muteInsteadOfSkip,
  startAt,
  onProgress,
  onEnded,
  onSpeedPersist,
  onDownload,
  onBookmark,
  onNext,
  onPrev,
  autoplay,
  theater,
  onToggleTheater,
}: PlayerSurfaceProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [doubleFlash, setDoubleFlash] = useState<{ side: "l" | "r"; id: number } | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const hideTimer = useRef<number>(0);

  const player = usePlayer({
    video,
    segments,
    enabledCategories,
    muteInsteadOfSkip,
    startAt,
    autoplay,
    initialSpeed: 1,
    onProgress,
    onEnded,
    onSpeedChange: onSpeedPersist,
  });

  const { ref: videoRef, handlers: rawHandlers } = player;

  // autoplay policy: browsers block sound-on autoplay → retry muted
  const handlers = {
    ...rawHandlers,
    onLoadedMetadata: () => {
      rawHandlers.onLoadedMetadata();
      const el = videoRef.current;
      if (!el) return;
      el.playbackRate = player.speed;
      el.volume = player.volume;
    },
  };
  const duration = player.duration || video.durationSec || 0;
  const pct = duration ? (player.time / duration) * 100 : 0;

  /* ── ui auto-hide ─────────────────────────────────────────── */
  const poke = () => {
    setUiVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (player.status === "playing") {
        setUiVisible(false);
        setShowSpeed(false);
        setShowSettings(false);
      }
    }, 2600);
  };
  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [player.status]);

  /* ── fullscreen sync ─────────────────────────────────────── */
  useEffect(() => {
    const h = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await wrapRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  };

  const pip = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      /* unsupported */
    }
  };

  /* ── double tap seek (mobile) ────────────────────────────── */
  const onSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - box.left;
    if (x < box.width * 0.3) {
      player.seek(-10, true);
      setDoubleFlash({ side: "l", id: Date.now() });
    } else if (x > box.width * 0.7) {
      player.seek(10, true);
      setDoubleFlash({ side: "r", id: Date.now() });
    } else {
      player.toggle();
    }
    poke();
  };

  /* ── chapter list ────────────────────────────────────────── */
  const chapters = useMemo(() => {
    const list = [...(video.chapters ?? [])];
    if (!list.length) return [];
    return list.sort((a, b) => a.startSec - b.startSec);
  }, [video.chapters]);

  const activeChapter = useMemo(() => {
    let idx = -1;
    chapters.forEach((c, i) => {
      if (player.time >= c.startSec) idx = i;
    });
    return idx >= 0 ? chapters[idx] : null;
  }, [chapters, player.time]);

  const bufferedPct = duration ? Math.min(100, (player.buffered / duration) * 100) : 0;

  const SkipBanner = player.skipped && (
    <div
      key={player.skipped.id}
      className="absolute left-1/2 top-4 z-30 -translate-x-1/2 anim-pop"
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3.5 py-1.5 text-[12px] font-medium text-white shadow-xl backdrop-blur-md">
        <SkipForward className="h-3.5 w-3.5 text-[var(--accent)]" />
        Skipped {CATEGORY_LABEL[player.skipped.category]?.label ?? player.skipped.category}
        <span className="text-white/50">·</span>
        <span className="tabular-nums text-white/70">{player.skipped.seconds}s</span>
        <button
          onClick={() => player.seek(player.time - player.skipped!.seconds)}
          className="ml-1 rounded px-1 text-[11.5px] text-[var(--accent)] hover:underline"
        >
          Undo
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group/player relative w-full select-none overflow-hidden bg-black",
        isFullscreen ? "h-screen" : "aspect-video rounded-[14px] ring-1 ring-[var(--border)]",
      )}
      onMouseMove={poke}
      onMouseLeave={() => player.status === "playing" && setUiVisible(false)}
    >
      <video
        ref={videoRef}
        src={stream?.muxedUrl}
        className="h-full w-full bg-black object-contain"
        playsInline
        preload="metadata"
        {...handlers}
        poster={video.thumb}
      />

      {/* click / gesture layer */}
      <div className="absolute inset-0 z-10" onClick={onSurfaceClick} onDoubleClick={(e) => e.preventDefault()}>
        {doubleFlash && (
          <div
            key={doubleFlash.id}
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 anim-pop",
              doubleFlash.side === "l" ? "left-[10%]" : "right-[10%]",
            )}
            onAnimationEnd={() => setDoubleFlash(null)}
          >
            {doubleFlash.side === "l" ? (
              <RotateCcw className="h-6 w-6 text-white" />
            ) : (
              <SkipForward className="h-6 w-6 text-white" />
            )}
          </div>
        )}
      </div>

      {SkipBanner}

      {/* stats for nerds */}
      {statsOpen && (
        <div className="absolute right-3 top-3 z-30 w-56 rounded-lg border border-white/10 bg-black/80 p-2.5 font-mono text-[10.5px] leading-relaxed text-white/80 backdrop-blur anim-pop">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-white/40">
            <span>Stats</span>
            <button onClick={() => setStatsOpen(false)} className="hover:text-white">
              ×
            </button>
          </div>
          <Row k="engine" v={stream?.source ?? "—"} />
          <Row k="quality" v={player.quality} />
          <Row k="speed" v={`${player.speed}×`} />
          <Row k="buffer" v={`${player.stats.bufferSec}s`} />
          <Row k="frames" v={`${player.stats.total}`} />
          <Row k="dropped" v={`${player.stats.dropped}`} />
          {player.stats.bitrateKbps > 0 && <Row k="bitrate" v={`${player.stats.bitrateKbps} kbps`} />}
          <Row k="sponsors" v={`${segments.filter((x) => x.action === "skip").length} seg`} />
        </div>
      )}

      {/* center play / error / loading */}
      {player.status === "error" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6 text-center">
          <div>
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
            <p className="mt-3 text-sm font-medium text-white">This video could not be played</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-white/60">
              Playback failed. Retry below, or try another engine in Settings → Playback.
            </p>
            <button className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-black" onClick={() => { if (player.ref.current) { player.ref.current.load(); void player.ref.current.play().catch(() => undefined); } }}>Retry playback</button>
          </div>
        </div>
      )}
      {player.status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-[var(--accent)]" />
        </div>
      )}

      {/* sleep timer countdown */}
      {player.sleepAt && (
        <div className="absolute right-4 top-16 z-30 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
          <Moon className="h-3 w-3 text-[var(--accent)]" />
          <SleepCountdown at={player.sleepAt} onDone={() => player.setSleepTimer(0)} />
        </div>
      )}

      {/* A-B loop indicator */}
      {player.ab && (
        <div className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-black/70 px-3 py-1.5 text-[11.5px] font-medium text-[var(--accent)] backdrop-blur">
          <Repeat className="h-3.5 w-3.5" />
          Loop {formatTime(player.ab.a)}
          {player.ab.b !== null ? ` – ${formatTime(player.ab.b)}` : " → ?"}
          {player.loopCount > 0 && <span className="text-white/60">×{player.loopCount}</span>}
          <button onClick={player.clearAB} className="ml-1 text-white/60 hover:text-white">
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* top gradient + chapter title */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-200",
          uiVisible ? "opacity-100" : "opacity-0",
        )}
      />
      {activeChapter && uiVisible && (
        <div className="absolute left-4 top-3 z-20 max-w-[70%] truncate text-[12.5px] font-medium text-white/80">
          {activeChapter.title}
        </div>
      )}

      {/* bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-200",
          uiVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* timeline */}
        <div
          className="group/bar relative mx-1 mb-2 h-1 cursor-pointer"
          onMouseMove={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setHoverPct(((e.clientX - r.left) / r.width) * 100);
          }}
          onMouseLeave={() => setHoverPct(null)}
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            player.seek(((e.clientX - r.left) / r.width) * duration);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 transition-all group-hover/bar:h-1.5">
            <div className="h-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
          </div>

          {/* SponsorBlock segments */}
          {segments
            .filter((s) => s.action === "skip")
            .map((s, i) => {
              const meta = CATEGORY_LABEL[s.category] ?? { color: "#22c55e" };
              return (
                <div
                  key={`${s.startSec}-${i}`}
                  title={`${meta.label ?? s.category} · ${formatTime(s.startSec)}`}
                  className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-sm opacity-90"
                  style={{
                    left: `${(s.startSec / (duration || 1)) * 100}%`,
                    width: `${Math.max(0.35, ((s.endSec - s.startSec) / (duration || 1)) * 100)}%`,
                    background: meta.color,
                  }}
                />
              );
            })}

          {/* chapters ticks */}
          {chapters.map((c) => (
            <div
              key={c.startSec}
              className="absolute top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-white/60"
              style={{ left: `${(c.startSec / (duration || 1)) * 100}%` }}
            />
          ))}

          {/* A-B markers */}
          {player.ab && (
            <>
              <div
                className="absolute top-0 h-full w-[2px] bg-[var(--accent)]"
                style={{ left: `${(player.ab.a / (duration || 1)) * 100}%` }}
              />
              {player.ab.b !== null && (
                <div
                  className="absolute top-0 h-full w-[2px] bg-[var(--accent)]"
                  style={{ left: `${(player.ab.b / (duration || 1)) * 100}%` }}
                />
              )}
            </>
          )}

          {/* played */}
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent)] transition-all group-hover/bar:h-1.5"
            style={{ width: `${pct}%` }}
          />

          {/* hover preview time */}
          {hoverPct !== null && (
            <div
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-black/90 px-1.5 py-0.5 text-[11px] tabular-nums text-white ring-1 ring-white/10"
              style={{ left: `${hoverPct}%` }}
            >
              {formatTime((hoverPct / 100) * duration)}
            </div>
          )}
        </div>

        {/* button row */}
        <div className="flex items-center gap-0.5 text-white">
          {onPrev && (
            <IconButton label="Previous" className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white" onClick={onPrev}>
              <SkipBack className="h-4.5 w-4.5 fill-current" />
            </IconButton>
          )}
          <IconButton
            label={player.status === "playing" ? "Pause (k)" : "Play (k)"}
            className="h-10 w-10 text-white hover:bg-white/10"
            onClick={player.toggle}
          >
            {player.status === "playing" ? (
              <Pause className="h-5.5 w-5.5 fill-current" />
            ) : (
              <Play className="h-5.5 w-5.5 translate-x-[1px] fill-current" />
            )}
          </IconButton>
          {onNext && (
            <IconButton label="Next" className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white" onClick={onNext}>
              <SkipForward className="h-4.5 w-4.5 fill-current" />
            </IconButton>
          )}

          {/* volume */}
          <div className="group/vol ml-1 flex items-center">
            <IconButton
              label="Mute (m)"
              className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={player.toggleMute}
            >
              {player.muted || player.volume === 0 ? (
                <VolumeX className="h-4.5 w-4.5" />
              ) : player.volume < 0.5 ? (
                <Volume1 className="h-4.5 w-4.5" />
              ) : (
                <Volume2 className="h-4.5 w-4.5" />
              )}
            </IconButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.muted ? 0 : player.volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              className="lt-range w-0 opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100"
              style={{ "--pct": `${(player.muted ? 0 : player.volume) * 100}%` } as React.CSSProperties}
              aria-label="Volume"
            />
          </div>

          <div className="ml-2 text-[12.5px] tabular-nums text-white/80">
            {formatTime(player.time)} <span className="text-white/35">/</span> {formatTime(duration)}
          </div>

          <div className="flex-1" />

          {/* A-B loop */}
          <button
            onClick={() => (player.ab ? player.clearAB() : player.setPoint("a"))}
            onContextMenu={(e) => {
              e.preventDefault();
              player.setPoint("b");
            }}
            title="A-B loop (a = start, b = end, Esc = clear)"
            className={cn(
              "hidden h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium transition sm:flex",
              player.ab
                ? "bg-[var(--accent)] text-black"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Repeat className="h-3.5 w-3.5" />
            A-B
          </button>

          {/* bookmark */}
          {onBookmark && (
            <IconButton
              label="Bookmark this moment"
              className="hidden h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white sm:grid"
              onClick={() => onBookmark(player.time)}
            >
              <Bookmark className="h-4.5 w-4.5" />
            </IconButton>
          )}

          {/* speed */}
          <div className="relative">
            <button
              onClick={() => setShowSpeed((v) => !v)}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold tabular-nums text-white/90 hover:bg-white/10"
            >
              <Gauge className="h-4 w-4" />
              {player.speed}×
            </button>
            {showSpeed && (
              <div className="absolute bottom-11 right-0 z-40 max-h-64 w-28 overflow-y-auto rounded-xl border border-white/10 bg-black/95 p-1 shadow-2xl backdrop-blur anim-pop">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      player.setSpeed(s);
                      setShowSpeed(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] tabular-nums",
                      player.speed === s
                        ? "bg-[var(--accent)] text-black font-semibold"
                        : "text-white/80 hover:bg-white/10",
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {s}×
                      {s === 4 && (
                        <span className="rounded bg-white/15 px-1 text-[9px] uppercase">max</span>
                      )}
                    </span>
                    {player.speed === s && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onDownload && (
            <IconButton
              label="Download"
              className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={onDownload}
            >
              <Download className="h-4.5 w-4.5" />
            </IconButton>
          )}

          <div className="relative">
            <IconButton
              label="Settings"
              className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings2 className="h-4.5 w-4.5" />
            </IconButton>
            {showSettings && (
              <div className="absolute bottom-11 right-0 z-40 w-56 rounded-xl border border-white/10 bg-black/95 p-2 text-[12.5px] text-white/80 shadow-2xl backdrop-blur anim-pop">
                <div className="flex items-center justify-between px-2 pb-1.5 pt-1 text-[11px] uppercase tracking-wide text-white/40">
                  <span>Quality</span>
                  <span className="text-white/30">{player.quality}</span>
                </div>
                <button
                  onClick={() => {
                    const first = stream?.qualities?.[0];
                    if (first) player.setSource(first.url, first.label);
                    setShowSettings(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/10",
                    player.quality === "auto" && "text-[var(--accent)]",
                  )}
                >
                  Auto
                  <span className="text-[10px] text-white/40">best available</span>
                </button>
                {[...(stream?.qualities ?? [])]
                  .sort((a, b) => b.height - a.height)
                  .map((q) => (
                    <button
                      key={q.label}
                      onClick={() => {
                        player.setSource(q.url, q.label);
                        setShowSettings(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/10",
                        player.quality === q.label && "text-[var(--accent)]",
                      )}
                    >
                      {q.label}
                      <span className="flex items-center gap-1">
                        {q.height >= 2160 && (
                          <span className="rounded bg-[var(--accent)]/25 px-1 text-[9.5px] font-bold uppercase text-[var(--accent)]">
                            Premium
                          </span>
                        )}
                        {q.height >= 1080 && q.height < 2160 && (
                          <span className="rounded bg-white/15 px-1 text-[9.5px] uppercase">HD</span>
                        )}
                      </span>
                    </button>
                  ))}
                <div className="my-1.5 h-px bg-white/10" />
                <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-white/40">
                  Playback
                </div>
                <button
                  onClick={() => player.setLoopVideo(!player.loopVideo)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/10"
                >
                  <span className="flex items-center gap-1.5">
                    <Repeat1 className="h-3.5 w-3.5" /> Loop this video
                  </span>
                  <span className={player.loopVideo ? "text-[var(--accent)]" : "text-white/40"}>
                    {player.loopVideo ? "on" : "off"}
                  </span>
                </button>
                <div className="px-2 pb-1 pt-1.5 text-[11px] uppercase tracking-wide text-white/40">
                  Sleep timer
                </div>
                <div className="flex flex-wrap gap-1 px-1 pb-1">
                  {[0, 15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => player.setSleepTimer(m)}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] transition-colors",
                        (m === 0 && !player.sleepAt) ||
                          (player.sleepAt && m > 0 && Math.abs(player.sleepAt - Date.now()) < m * 62_000)
                          ? "bg-[var(--accent)] text-black"
                          : "bg-white/10 hover:bg-white/20",
                      )}
                    >
                      {m === 0 ? "Off" : `${m}m`}
                    </button>
                  ))}
                </div>
                <div className="my-1.5 h-px bg-white/10" />
                <button
                  onClick={() => setStatsOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/10"
                >
                  Stats for nerds
                  <span className="text-[10px] text-white/40">{statsOpen ? "on" : "off"}</span>
                </button>
                <div className="my-1.5 h-px bg-white/10" />
                <button
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/10"
                  onClick={() => {
                    player.setPoint("a");
                    setShowSettings(false);
                  }}
                >
                  Set loop start (A)
                </button>
                <button
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/10"
                  onClick={() => {
                    player.setPoint("b");
                    setShowSettings(false);
                  }}
                >
                  Set loop end (B)
                </button>
                <div className="px-2 pt-2 text-[11px] text-white/35">
                  Engine: {stream?.source ?? "—"}
                </div>
              </div>
            )}
          </div>

          <IconButton
            label="Picture in picture"
            className="hidden h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white sm:grid"
            onClick={pip}
          >
            <PictureInPicture2 className="h-4.5 w-4.5" />
          </IconButton>

          {onToggleTheater && (
            <IconButton
              label="Theater mode (t)"
              className="hidden h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white sm:grid"
              onClick={onToggleTheater}
            >
              <Grid2x2 className="h-4.5 w-4.5" />
            </IconButton>
          )}

          <IconButton
            label="Fullscreen (f)"
            className="h-9 w-9 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize className="h-4.5 w-4.5" /> : <Maximize className="h-4.5 w-4.5" />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40">{k}</span>
      <span className="truncate text-white/85">{v}</span>
    </div>
  );
}

function SleepCountdown({ at, onDone }: { at: number; onDone: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, at - Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => {
      const ms = Math.max(0, at - Date.now());
      setLeft(ms);
      if (ms <= 0) onDone();
    }, 1000);
    return () => window.clearInterval(id);
  }, [at, onDone]);
  const m = Math.floor(left / 60000);
  const sLeft = Math.floor((left % 60000) / 1000);
  return (
    <span className="tabular-nums">
      {m}:{String(sLeft).padStart(2, "0")}
    </span>
  );
}
