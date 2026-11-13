import { cancelDownload } from "@/lib/bridge";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { Badge, Button, EmptyState, IconButton, Input, Segmented, Switch } from "@/components/ui";
import { cn, formatBytes, formatTime } from "@/lib/utils";
import type { DownloadJob } from "@/lib/types";
import { revealInFolder, updateExtractor } from "@/lib/bridge";

type Filter = "all" | "active" | "done" | "audio";

export function DownloadsPage() {
  const downloads = useLibrary((s) => s.downloads);
  const updateDownload = useLibrary((s) => s.updateDownload);
  const removeDownload = useLibrary((s) => s.removeDownload);
  const clearFinished = useLibrary((s) => s.clearFinishedDownloads);
  const settings = useSettings();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [updating, setUpdating] = useState(false);

  const filtered = useMemo(() => {
    return downloads.filter((d) => {
      if (filter === "active" && !["running", "queued", "paused"].includes(d.status)) return false;
      if (filter === "done" && d.status !== "done") return false;
      if (filter === "audio" && !d.preset.startsWith("audio")) return false;
      if (q && !`${d.title} ${d.channelName}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [downloads, filter, q]);

  const usedBytes = downloads.reduce((acc, d) => acc + (d.bytesTotal ?? 0), 0);
  const quota = settings.maxStorageGb * 1024 ** 3;
  const usedPct = Math.min(100, (usedBytes / quota) * 100);
  const galleryOn = downloads.filter((d) => d.showInGallery && d.status === "done").length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[20px] font-semibold tracking-tight">Downloads</h1>
        <Badge tone="accent">
          <HardDrive className="h-3 w-3" /> {formatBytes(usedBytes)} / {settings.maxStorageGb} GB
        </Badge>
        {galleryOn > 0 && (
          <Badge>
            <ImageIcon className="h-3 w-3" /> {galleryOn} in gallery
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              setUpdating(true);
              await updateExtractor();
              setUpdating(false);
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", updating && "animate-spin")} />
            Update extractor
          </Button>
          <Button size="sm" variant="ghost" onClick={() => (window.location.hash = "#/settings/downloads")}>
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </Button>
        </div>
      </div>

      {/* storage bar */}
      <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3.5">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="text-[var(--text-dim)]">
            Storage · {settings.downloadFolder}
            {settings.downloadSubfoldersByChannel && "/<channel>"}
          </span>
          <span className="tabular-nums text-[var(--text-mute)]">{Math.round(usedPct)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-elev-2)]">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              usedPct > 90 ? "bg-rose-500" : usedPct > 70 ? "bg-amber-400" : "bg-[var(--accent)]",
            )}
            style={{ width: `${Math.max(2, usedPct)}%` }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[var(--text-mute)]">
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3 text-emerald-400" />
            {downloads.filter((d) => d.status === "done").length} complete
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {downloads.filter((d) => d.status === "running").length} running
          </span>
          <span className="flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            {settings.wifiOnlyDownloads ? "Wi-Fi only" : "Any network"}
          </span>
          <button
            onClick={clearFinished}
            className="ml-auto text-[11.5px] text-[var(--text-mute)] hover:text-[var(--text)]"
          >
            Clear finished
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "done", label: "Done" },
            { value: "audio", label: "Audio" },
          ]}
          size="sm"
        />
        <div className="relative ml-auto w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-mute)]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search downloads"
            className="h-8 pl-8 text-[12.5px]"
          />
        </div>
      </div>

      {filtered.length ? (
        <ul className="space-y-1.5">
          {filtered.map((job) => (
            <DownloadRow
              key={job.id}
              job={job}
              onPause={() => window.alert("Pause/resume is not implemented yet. Cancel the download instead.")}
              onResume={() => window.alert("Resume is not implemented in this build.")}
              onRemove={async () => {
                try {
                  if (["running", "queued", "paused"].includes(job.status)) await cancelDownload(job.id);
                  removeDownload(job.id);
                } catch (err) { window.alert(err instanceof Error ? err.message : String(err)); }
              }}
              onToggleGallery={(v) => updateDownload(job.id, { showInGallery: v })}
              onReveal={() => job.filePath && revealInFolder(job.filePath)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Download className="h-6 w-6" />}
          title="No downloads yet"
          description="Hit Download on any video. 1080p, 4K, audio-only or sponsor-free copy — all available."
          action={
            <Button variant="primary" onClick={() => (window.location.hash = "#/")}>
              Browse videos
            </Button>
          }
        />
      )}
    </div>
  );
}

function DownloadRow({
  job,
  onPause,
  onResume,
  onRemove,
  onToggleGallery,
  onReveal,
}: {
  job: DownloadJob;
  onPause: () => void;
  onResume: () => void;
  onRemove: () => void;
  onToggleGallery: (v: boolean) => void;
  onReveal: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const running = job.status === "running";
  const done = job.status === "done";

  return (
    <li className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] transition-colors">
      <div className="flex items-center gap-3 p-2.5">
        <div className="relative w-28 shrink-0 overflow-hidden rounded-lg">
          <img src={job.thumb} alt="" className="aspect-video w-full object-cover" />
          {done && (
            <span className="absolute inset-0 grid place-items-center bg-black/45">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-black">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="clamp-1 text-[13px] font-medium">{job.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[var(--text-mute)]">
            <span>{job.channelName}</span>
            <span>·</span>
            <span className="uppercase tracking-wide">{job.preset}</span>
            {job.bytesTotal ? (
              <>
                <span>·</span>
                <span className="tabular-nums">
                  {formatBytes(job.bytesDone)} / {formatBytes(job.bytesTotal)}
                </span>
              </>
            ) : null}
            {running && job.speedBps ? (
              <>
                <span>·</span>
                <span className="tabular-nums text-[var(--accent)]">
                  {formatBytes(job.speedBps)}/s
                </span>
              </>
            ) : null}
            {job.showInGallery && done && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <ImageIcon className="h-3 w-3" /> gallery
                </span>
              </>
            )}
          </p>

          {(running || job.status === "paused") && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--bg-elev-2)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  job.status === "paused" ? "bg-[var(--text-mute)]" : "bg-[var(--accent)]",
                )}
                style={{ width: `${Math.max(2, job.progress * 100)}%` }}
              />
            </div>
          )}
          {job.status === "error" && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-400">
              <AlertTriangle className="h-3 w-3" /> {job.error ?? "Extractor failed — try updating it"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {running && (
            <IconButton label="Pause unavailable in this build" disabled className="h-8 w-8" onClick={onPause}>
              <Pause className="h-4 w-4" />
            </IconButton>
          )}
          {job.status === "paused" && (
            <IconButton label="Resume unavailable in this build" disabled className="h-8 w-8" onClick={onResume}>
              <Play className="h-4 w-4" />
            </IconButton>
          )}
          {done && (
            <>
              <IconButton label="Open in folder" className="h-8 w-8" onClick={onReveal}>
                <FolderOpen className="h-4 w-4" />
              </IconButton>
              <IconButton label="Play locally" className="h-8 w-8">
                <Play className="h-4 w-4" />
              </IconButton>
            </>
          )}
          <IconButton label="Details" className="h-8 w-8" onClick={() => setExpanded((v) => !v)}>
            <Settings2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Remove" className="h-8 w-8 hover:text-rose-400" onClick={onRemove}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-elev-2)] px-3.5 py-2.5">
          <Switch
            checked={job.showInGallery ?? true}
            onChange={onToggleGallery}
            label="Show in gallery"
            description="Off = the file stays private inside the app."
          />
          <div className="mt-1 grid gap-1 text-[11.5px] text-[var(--text-mute)]">
            <span>
              <span className="text-[var(--text-dim)]">Path:</span>{" "}
              <span className="break-all font-mono text-[10.5px]">{job.filePath ?? "—"}</span>
            </span>
            <span>
              <span className="text-[var(--text-dim)]">Created:</span>{" "}
              {new Date(job.createdAt).toLocaleString()}
            </span>
            {job.etaSec ? (
              <span>
                <span className="text-[var(--text-dim)]">ETA:</span> {formatTime(job.etaSec)}
              </span>
            ) : null}
          </div>
          {done && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={onReveal}>
                <FolderOpen className="h-3.5 w-3.5" /> Open folder
              </Button>
              <Button size="sm" variant="ghost">
                <Trash2 className="h-3.5 w-3.5" /> Delete file
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
