import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 3725 -> "1:02:05", 125 -> "2:05" */
export function formatTime(seconds: number | undefined | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

/** 1250000 -> "1.2M" */
export function formatCount(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, "")}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
}

/** SEO-friendly byte formatting */
export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

export function timeAgo(iso?: string | number | null): string {
  if (!iso) return "";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = (t - Date.now()) / 1000;
  for (const [unit, sec] of UNITS) {
    if (Math.abs(diff) >= sec || unit === "second") {
      return RTF.format(Math.round(diff / sec), unit);
    }
  }
  return "";
}

/** "+1 day" / "3 weeks ago" style, used in feed meta */
export function publishedLabel(iso?: string | null): string {
  const rel = timeAgo(iso);
  return rel.replace(" ago", " pehle") === rel ? rel : rel.replace(" ago", " pehle");
}

export function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function formatTimestampInput(sec: number): string {
  return formatTime(sec);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 250) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function thumbUrl(videoId: string, quality: "default" | "hq" | "mq" | "maxres" = "hq") {
  return `https://i.ytimg.com/vi/${videoId}/${quality === "maxres" ? "maxresdefault" : quality === "mq" ? "mqdefault" : "hqdefault"}.jpg`;
}
