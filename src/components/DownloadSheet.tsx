import { isAndroidNative } from "@/lib/android";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Download, FolderOpen, HardDrive, Info, Loader2, X } from "lucide-react";
import type { DownloadPreset, Video } from "@/lib/types";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { Button, Switch } from "@/components/ui";
import { cn, formatBytes, uid, isNativeApp } from "@/lib/utils";
import { startDownload } from "@/lib/bridge";

const PRESETS: { id: DownloadPreset; label: string; sub: string; perHour: number }[] = [
  { id: "best", label: "Best available", sub: "Up to 8K · original quality · MKV", perHour: 8_000_000_000 },
  { id: "8k", label: "8K (4320p)", sub: "Highest available up to 8K · MKV", perHour: 12_000_000_000 },
  { id: "1440p", label: "1440p · QHD", sub: "Sharper than Full HD", perHour: 2_400_000_000 },
  { id: "360p", label: "360p", sub: "Smallest video · save storage", perHour: 160_000_000 },
  { id: "1080p", label: "1080p MP4", sub: "Best balance · H.264 (universal)", perHour: 1_200_000_000 },
  { id: "4k", label: "4K (2160p)", sub: "Archival · big files", perHour: 5_400_000_000 },
  { id: "720p", label: "720p", sub: "Smaller, still sharp", perHour: 600_000_000 },
  { id: "480p", label: "480p", sub: "Data saver · phone friendly", perHour: 250_000_000 },
  { id: "audio-m4a", label: "Audio only · M4A", sub: "Music / podcasts · ~55 MB/hr", perHour: 55_000_000 },
  { id: "audio-mp3", label: "Audio only · MP3 320", sub: "Max compatibility", perHour: 90_000_000 },
  { id: "sponsor-free", label: "Sponsor-free copy", sub: "1080p + sponsor segments physically cut", perHour: 1_100_000_000 },
  { id: "subs-only", label: "Subtitles only", sub: "Just the .vtt / .srt", perHour: 200_000 },
];

export function DownloadSheet({
  open,
  onClose,
  video,
}: {
  open: boolean;
  onClose: () => void;
  video: Video;
}) {
  const settings = useSettings();
  const enqueue = useLibrary((s) => s.enqueueDownload);
  const [preset, setPreset] = useState<DownloadPreset>(isAndroidNative() ? "720p" : settings.downloadPreset);
  const [showInGallery, setShowInGallery] = useState(settings.showDownloadsInGallery);
  const [sponsorCut, setSponsorCut] = useState(settings.sponsorCutOnDownload);
  const [embedThumb, setEmbedThumb] = useState(settings.embedThumbnail);
  const [embedChapters, setEmbedChapters] = useState(settings.embedChapters);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setPreset(isAndroidNative() ? "720p" : settings.downloadPreset);
      setShowInGallery(settings.showDownloadsInGallery);
      if (isAndroidNative()) setSponsorCut(false);
      setDone(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const estimate = (PRESETS.find((p) => p.id === preset)?.perHour ?? 0) * (video.durationSec / 3600);

  const submit = async () => {
    if (!isNativeApp()) { window.alert("Downloads require the native desktop app; no download was started."); return; }
    const used = useLibrary.getState().downloads.filter((d) => d.status !== "canceled" && d.status !== "error").reduce((n, d) => n + Math.max(d.bytesDone ?? 0, d.bytesTotal ?? 0), 0);
    if (used + estimate > settings.maxStorageGb * 1024 ** 3) {
      window.alert("Storage limit reached. Remove downloads or increase your storage cap in Settings → Downloads.");
      return;
    }
    if (isAndroidNative() && sponsorCut) { window.alert("Sponsor-cut files are not supported in the Android preview. Turn this option off."); return; }
    setBusy(true);
    const jobId = uid("dl");
    enqueue({
      id: jobId,
      videoId: video.id,
      title: video.title,
      channelName: video.channelName,
      thumb: video.thumb,
      preset,
      showInGallery,
    });
    try { await startDownload({
      videoId: video.id,
      title: video.title,
      channelName: video.channelName,
      preset,
      folder: settings.downloadFolder,
      showInGallery,
      sponsorCut: sponsorCut || preset === "sponsor-free",
      embedThumbnail: embedThumb,
      embedChapters,
      embedSubs: settings.embedSubs,
    }, jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useLibrary.getState().updateDownload(jobId, { status: "error", error: message });
      window.alert(message); setBusy(false); return;
    }
    setBusy(false);
    setDone(true);
    window.setTimeout(onClose, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm anim-fade sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl anim-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--border)] p-4">
          <img src={video.thumb} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold leading-snug">Download</h2>
            <p className="clamp-2 mt-0.5 text-[12px] text-[var(--text-mute)]">{video.title}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-mute)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-mute)]">
            Format
          </div>
          <div className="grid gap-1.5">
            {PRESETS.filter(p => !isAndroidNative() || ["720p", "480p", "360p", "audio-m4a"].includes(p.id)).map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  preset === p.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/8"
                    : "border-[var(--border)] hover:bg-[var(--bg-elev-2)]",
                )}
              >
                <span
                  className={cn(
                    "grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border",
                    preset === p.id ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--text-mute)]",
                  )}
                >
                  {preset === p.id && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{p.label}</span>
                  <span className="block text-[11.5px] text-[var(--text-mute)]">{p.sub}</span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-mute)]">
                  ~{formatBytes((p.perHour * video.durationSec) / 3600)}
                </span>
              </button>
            ))}
          </div>

          {isAndroidNative() && <p className="mt-3 text-xs leading-5 text-[var(--text-dim)]">Android uses system downloads for compatible combined MP4 streams or M4A audio. Adaptive merging, sponsor-cut files, embedded thumbnails and chapters are not supported in this preview.</p>}
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elev-2)] px-3">
            <Switch
              checked={showInGallery}
              onChange={setShowInGallery}
              label="Show in gallery"
              description="Off keeps the file private inside the app (it won't appear in your phone gallery)."
            />
            <Switch
              checked={sponsorCut || preset === "sponsor-free"}
              onChange={setSponsorCut}
              disabled={isAndroidNative() || preset === "sponsor-free"}
              label="Cut sponsor segments"
              description="Physically removed with ffmpeg — the file itself is clean."
            />
            <Switch checked={!isAndroidNative() && embedThumb} disabled={isAndroidNative()} onChange={setEmbedThumb} label="Embed thumbnail" />
            <Switch checked={!isAndroidNative() && embedChapters} disabled={isAndroidNative()} onChange={setEmbedChapters} label="Embed chapters" />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--bg-elev-2)] p-2.5 text-[11.5px] leading-relaxed text-[var(--text-mute)]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Save to: <span className="text-[var(--text-dim)]">{isAndroidNative() ? (showInGallery ? "Movies or Music / LumaTube" : "App-private Downloads") : settings.downloadFolder}</span>
              {!isAndroidNative() && settings.downloadSubfoldersByChannel && `/${video.channelName}`}
              {" · "}
              ~{formatBytes(estimate)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] p-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-mute)]">
            <HardDrive className="h-3.5 w-3.5" /> yt-dlp + ffmpeg
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={busy || done}>
              {done ? (
                <>
                  <Check className="h-4 w-4" /> Queued
                </>
              ) : busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
