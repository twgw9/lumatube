import type { Chapter, Segment, SponsorCategory, Video } from "@/lib/types";
import { demoTranscript, demoSegments } from "@/lib/mock";
import { isTauri } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────────
   bridge.ts — single frontend entry point to the Rust backend.

   Every call has a browser fallback so the UI can be developed and
   demoed in a plain browser (npm run dev) while the Tauri build uses
   the real Rust commands. Command names match src-tauri/src/commands.rs.
   ─────────────────────────────────────────────────────────────── */

async function invokeSafe<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[bridge] ${cmd} failed`, err);
    return null;
  }
}

export async function invokeRequired<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error("This action requires the native desktop app. Browser mode cannot run the extractor or save native downloads.");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/* ── streams ─────────────────────────────────────────────────── */

export interface StreamInfo {
  videoUrl?: string;
  audioUrl?: string;
  muxedUrl?: string;
  durationSec: number;
  source: "ytdlp" | "innertube" | "instance" | "official" | "demo";
  qualities: { label: string; height: number; url: string; sizeBytes?: number }[];
  expiresAt?: number;
}

export async function resolveStream(
  videoId: string,
  preferredQuality = "auto",
  engine = "auto",
): Promise<StreamInfo> {
  return invokeRequired<StreamInfo>("resolve_stream", { videoId, preferredQuality, engine });
}

/* ── feeds ───────────────────────────────────────────────────── */

export async function refreshSubscriptionFeed(channelIds: string[]): Promise<Video[]> {
  const real = await invokeSafe<Video[]>("refresh_feed", { channelIds });
  return real ?? [];
}

export async function resolveChannelHandle(handle: string): Promise<{ id: string; name: string } | null> {
  return invokeSafe("resolve_channel", { handle });
}

/* ── enrichment ──────────────────────────────────────────────── */

const SB_BASE = "https://sponsor.ajay.app";

/** SponsorBlock via the privacy-preserving hash-prefix endpoint (no full id sent). */
export async function fetchSkipSegments(
  videoId: string,
  categories: string[],
): Promise<Segment[]> {
  const real = await invokeSafe<Segment[]>("fetch_segments", { videoId, categories });
  if (real) return real;

  // browser fallback: try the public API directly, else demo data
  try {
    const hash = await sha256(videoId);
    const prefix = hash.slice(0, 4);
    const params = new URLSearchParams();
    for (const c of categories) params.append("category", c);
    const res = await fetch(`${SB_BASE}/api/skipSegments/${prefix}?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const groups: {
      videoID: string;
      segments: { category: SponsorCategory; actionType: string; segment: [number, number]; UUID: string }[];
    }[] = await res.json();
    const mine = groups.find((g) => g.videoID === videoId);
    if (!mine) return [];
    return mine.segments.map((s) => ({
      category: s.category,
      startSec: s.segment[0],
      endSec: s.segment[1],
      action: s.actionType === "mute" ? "mute" : s.actionType === "full" ? "full" : "skip",
      uuid: s.UUID,
    }));
  } catch {
    return [];
  }
}

export async function fetchDeArrow(videoIds: string[]) {
  const real = await invokeSafe<Record<string, { title?: string; thumb?: string }>>(
    "fetch_dearrow",
    { videoIds },
  );
  return real ?? {};
}

export async function fetchDislikes(videoId: string) {
  const real = await invokeSafe<{ likes: number; dislikes: number; views: number }>(
    "fetch_votes",
    { videoId },
  );
  if (real) return real;
  try {
    const res = await fetch(
      `https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as { likes: number; dislikes: number; views: number };
  } catch {
    return null;
  }
}

export async function fetchTranscript(videoId: string) {
  const real = await invokeSafe<{ t: number; text: string }[]>("fetch_transcript", { videoId });
  return real ?? [];
}

export function parseChaptersFromDescription(desc?: string): Chapter[] {
  if (!desc) return [];
  const out: Chapter[] = [];
  const re = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:]\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(desc))) {
    const parts = m[1].split(":").map(Number);
    const sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    out.push({ startSec: sec, title: m[2].trim() });
  }
  return out;
}

/* ── downloads ───────────────────────────────────────────────── */

export interface DownloadRequest {
  videoId: string;
  title: string;
  channelName: string;
  preset: string;
  folder: string;
  showInGallery: boolean;
  sponsorCut: boolean;
  embedThumbnail: boolean;
  embedChapters: boolean;
  embedSubs: boolean;
}

export async function startDownload(req: DownloadRequest, jobId: string): Promise<{ jobId: string }> {
  return invokeRequired("start_download", { req, jobId });
}
export async function pauseDownload(jobId: string) {
  return invokeSafe("pause_download", { jobId });
}
export async function resumeDownload(jobId: string) {
  return invokeSafe("resume_download", { jobId });
}
export async function cancelDownload(jobId: string) {
  return invokeRequired("cancel_download", { jobId });
}
export async function revealInFolder(path: string) {
  return invokeSafe("reveal_in_folder", { path });
}
export async function updateExtractor(): Promise<{ version: string; updatedAt: number } | null> {
  return invokeSafe("update_extractor");
}

/* ── system ──────────────────────────────────────────────────── */

export async function getExtractorStatus() {
  const real = await invokeSafe<{ version: string; updatedAt: number; available: boolean }>(
    "extractor_status",
  );
  return real ?? { version: "browser-demo", updatedAt: Date.now(), available: false };
}

export async function googleSignIn(): Promise<{ email: string } | null> {
  return invokeSafe("google_sign_in");
}
export async function googleSignOut() {
  return invokeSafe("google_sign_out");
}
export async function importTakeout(filePath: string) {
  return invokeSafe<{ imported: number }>("import_takeout", { filePath });
}

/* ── helpers ─────────────────────────────────────────────────── */

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── persistence (Rust-backed, silent no-op in browser) ───── */

export interface ProgressPayload {
  videoId: string;
  positionSec: number;
  durationSec: number;
  percent: number;
  completed: boolean;
}

export async function persistProgress(p: ProgressPayload) {
  return invokeSafe("save_progress", { progress: p });
}

export async function loadProgress(videoId: string) {
  return invokeSafe<ProgressPayload>("get_progress", { videoId });
}

export async function persistHistory(event: {
  videoId: string;
  title: string;
  channelName: string;
  thumb: string;
  secondsWatched: number;
  source: string;
  watchedAt: number;
}) {
  return invokeSafe("push_history", { event });
}

export async function listChannels() {
  return invokeSafe<{ id: string; name: string; avatar?: string; handle?: string }[]>("list_channels");
}

export async function addChannel(channel: Record<string, unknown>) {
  return invokeSafe("add_channel", { channel });
}

export async function getFeed(limit = 100) {
  return invokeSafe<unknown[]>("get_feed", { limit });
}

/** Subscribe to download progress from the Rust side. Returns an unsubscribe fn. */
export async function onDownloadProgress(
  cb: (e: {
    jobId: string;
    progress: number;
    bytesDone?: number;
    bytesTotal?: number;
    speedBps?: number;
    etaSec?: number;
    stage: string;
  }) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const un = await listen<Parameters<typeof cb>[0]>("download://progress", (e) => cb(e.payload));
    return un;
  } catch {
    return () => {};
  }
}

export async function onDownloadDone(
  cb: (e: { jobId: string; filePath: string; bytesTotal: number; inGallery: boolean }) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const un = await listen<Parameters<typeof cb>[0]>("download://done", (e) => cb(e.payload));
    return un;
  } catch {
    return () => {};
  }
}

export async function onDownloadError(
  cb: (e: { jobId: string; error: string }) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const un = await listen<Parameters<typeof cb>[0]>("download://error", (e) => cb(e.payload));
    return un;
  } catch {
    return () => {};
  }
}

/* ── feed rows → Video ────────────────────────────────────── */

/** Shape returned by `feed.rs` / `commands::get_feed` (camelCase serde). */
export interface VideoRowDto {
  id: string;
  channelId: string;
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  publishedAt?: number | null;
  durationSec: number;
  thumb?: string | null;
  views?: number | null;
  likes?: number | null;
  dislikes?: number | null;
  isLive: boolean;
  isShort: boolean;
  dearrowTitle?: string | null;
  dearrowThumb?: string | null;
}

export function rowToVideo(row: VideoRowDto, channelName = "YouTube"): Video {
  const published = row.publishedAt ? new Date(row.publishedAt * 1000).toISOString() : new Date().toISOString();
  return {
    id: row.id,
    title: row.dearrowTitle ?? row.title,
    originalTitle: row.originalTitle ?? row.title,
    channelId: row.channelId,
    channelName,
    publishedAt: published,
    durationSec: row.durationSec,
    thumb: row.dearrowThumb ?? row.thumb ?? `https://i.ytimg.com/vi/${row.id}/hqdefault.jpg`,
    originalThumb: row.thumb ?? undefined,
    views: row.views ?? undefined,
    likes: row.likes ?? undefined,
    dislikes: row.dislikes ?? undefined,
    description: row.description ?? undefined,
    isLive: row.isLive,
    isShort: row.isShort,
    dearrow: Boolean(row.dearrowTitle || row.dearrowThumb),
  };
}

/** Load the local feed (subscriptions, newest first). Empty array when no backend. */
export async function loadFeed(limit = 120): Promise<Video[]> {
  const rows = await invokeSafe<VideoRowDto[]>("get_feed", { limit });
  if (!rows?.length) return [];
  const channels = (await invokeSafe<{ id: string; name: string }[]>("list_channels")) ?? [];
  const byId = new Map(channels.map((c) => [c.id, c.name]));
  return rows.map((r) => rowToVideo(r, byId.get(r.channelId) ?? "YouTube"));
}

/** Refresh all subscribed channels via RSS, persist, return the new rows. */
export async function refreshFeed(channelIds: string[], apiKey?: string): Promise<Video[]> {
  const rows = await invokeRequired<VideoRowDto[]>("refresh_feed", {
    channelIds,
    apiKey: apiKey || null,
  });
  if (!rows?.length) return [];
  return rows.map((r) => rowToVideo(r));
}

/** Resolve @handle → channel id/name/avatar using the Rust resolver. */
export async function resolveChannel(handle: string) {
  return invokeRequired<{ id: string; name: string; avatar?: string }>("resolve_channel", { handle });
}

/** SEARCH video via Data API (quota-aware, 100 units per call). */
export async function searchYouTube(query: string, apiKey?: string): Promise<Video[]> {
  const rows = await invokeSafe<VideoRowDto[]>("search_videos", {
    query,
    apiKey: apiKey || null,
  });
  if (!rows?.length) return [];
  return rows.map((r) => rowToVideo(r));
}
