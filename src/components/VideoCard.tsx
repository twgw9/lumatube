import { Link } from "react-router-dom";
import { Clock, Check, Download, MoreVertical, Play, Trash2 } from "lucide-react";
import type { Video } from "@/lib/types";
import { cn, formatCount, formatTime, timeAgo } from "@/lib/utils";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { Badge } from "@/components/ui";
import { useState } from "react";

interface VideoCardProps {
  video: Video;
  layout?: "grid" | "list" | "compact";
  showChannel?: boolean;
  onRemove?: () => void;
}

export function VideoCard({ video, layout = "grid", showChannel = true, onRemove }: VideoCardProps) {
  const progress = useLibrary((s) => s.progress[video.id]);
  const downloads = useLibrary((s) => s.downloads);
  const density = useSettings((s) => s.density);
  const dearrow = useSettings((s) => s.dearrow);
  const [menuOpen, setMenuOpen] = useState(false);

  const layoutMode = layout === "grid" ? (density === "compact" ? "compact" : density === "grid" ? "grid" : "grid") : layout;
  const downloaded = downloads.some((d) => d.videoId === video.id && d.status === "done");

  const thumb = !dearrow && video.originalThumb ? video.originalThumb : video.thumb;
  const title = !dearrow && video.originalTitle ? video.originalTitle : video.title;

  if (layoutMode === "list") {
    return (
      <Link
        to={`/watch/${video.id}`}
        className="group flex gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--bg-elev)]"
      >
        <Thumb video={video} src={thumb} small />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="clamp-2 text-[13.5px] font-medium leading-snug group-hover:text-[var(--text)]">
            {title}
          </h3>
          <p className="mt-1 truncate text-[12px] text-[var(--text-mute)]">
            {video.channelName} · {formatCount(video.views)} views · {timeAgo(video.publishedAt)}
          </p>
          {progress && !progress.completed && <ProgressBar percent={progress.percent} />}
        </div>
      </Link>
    );
  }

  if (layoutMode === "compact") {
    return (
      <Link to={`/watch/${video.id}`} className="group flex gap-3">
        <Thumb video={video} src={thumb} small />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="clamp-2 text-[13px] font-medium leading-snug">{title}</h3>
          <p className="mt-1 truncate text-[11.5px] text-[var(--text-mute)]">
            {video.channelName}
          </p>
          <p className="text-[11.5px] text-[var(--text-mute)]">
            {formatCount(video.views)} views · {timeAgo(video.publishedAt)}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <article className="group relative anim-fade-up">
      <Link to={`/watch/${video.id}`} className="block">
        <div className="relative overflow-hidden rounded-[14px] bg-[var(--bg-elev-2)] ring-1 ring-[var(--border)] transition-[transform,box-shadow] duration-200 group-hover:ring-[color-mix(in_oklab,var(--accent)_35%,var(--border))]">
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/media/thumbnail.svg";
            }}
          />
          {/* hover play affordance */}
          <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/25 group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 backdrop-blur-md ring-1 ring-white/20">
              <Play className="h-5 w-5 translate-x-[1px] fill-white text-white" />
            </span>
          </div>

          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
            {video.isLive ? (
              <Badge tone="live" className="uppercase tracking-wide">
                <span className="mr-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Live
              </Badge>
            ) : (
              <span className="rounded-md bg-black/80 px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-white backdrop-blur-sm">
                {formatTime(video.durationSec)}
              </span>
            )}
          </div>

          {downloaded && (
            <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-emerald-500/90 text-black shadow">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          )}
          {video.isShort && (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Short
            </span>
          )}

          {progress && !progress.completed && <ProgressBar percent={progress.percent} overlay />}
        </div>

        <div className="flex gap-2.5 pt-2.5">
          {showChannel && (
            <img
              src={video.channelAvatar}
              alt=""
              className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-[var(--bg-elev-2)] object-cover ring-1 ring-[var(--border)]"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="clamp-2 text-[13.5px] font-medium leading-snug tracking-[-0.006em]">
              {title}
            </h3>
            <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-[var(--text-mute)]">
              <span className="truncate">{video.channelName}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--text-mute)]">
              {formatCount(video.views) && <span>{formatCount(video.views)} views</span>}
              {formatCount(video.views) && <span>·</span>}
              <Clock className="h-3 w-3" />
              <span>{timeAgo(video.publishedAt)}</span>
            </p>
          </div>
        </div>
      </Link>

      {/* contextual menu */}
      <div className="absolute right-1 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen((v) => !v);
          }}
          className="grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white backdrop-blur hover:bg-black/80"
          aria-label="More"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-8 z-20 w-48 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1 text-[13px] shadow-2xl anim-pop"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <MenuItem icon={<Download className="h-4 w-4" />} label="Download" />
            <MenuItem icon={<Play className="h-4 w-4" />} label="Play next" />
            {onRemove && (
              <MenuItem
                icon={<Trash2 className="h-4 w-4" />}
                label="Remove"
                onClick={onRemove}
                danger
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        danger
          ? "text-rose-300 hover:bg-rose-500/15"
          : "text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Thumb({ video, src, small }: { video: Video; src: string; small?: boolean }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elev-2)] ring-1 ring-[var(--border)]",
        small ? "w-40" : "w-full",
      )}
    >
      <img src={src} alt="" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/media/thumbnail.svg"; }} loading="lazy" className="aspect-video w-full object-cover" />
      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10.5px] font-medium tabular-nums text-white">
        {formatTime(video.durationSec)}
      </span>
    </div>
  );
}

function ProgressBar({ percent, overlay }: { percent: number; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-white/20",
        overlay ? "absolute inset-x-0 bottom-0 h-[3px]" : "mt-1.5 h-[3px] w-full",
      )}
    >
      <div
        className="h-full rounded-full bg-[var(--accent)]"
        style={{ width: `${Math.min(100, Math.max(2, percent * 100))}%` }}
      />
    </div>
  );
}

export function VideoGrid({
  videos,
  loading,
  empty,
}: {
  videos: Video[];
  loading?: boolean;
  empty?: React.ReactNode;
}) {
  const density = useSettings((s) => s.density);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 min-[1200px]:grid-cols-3 min-[1800px]:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="anim-fade">
            <div className="skeleton aspect-video w-full rounded-[14px]" />
            <div className="mt-3 flex gap-2.5">
              <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-3.5 w-11/12 rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!videos.length) return <>{empty}</>;

  if (density === "compact") {
    return (
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} layout="compact" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 min-[1200px]:grid-cols-3 min-[1800px]:grid-cols-4">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}
