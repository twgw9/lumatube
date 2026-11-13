import { isTauri, formatBytes } from "./utils";
import { useSettings } from "@/store/settings";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
export async function enableDownloadNotifications() {
  if (!isTauri()) { window.alert("System download notifications require the native app, not this browser demo."); return false; }
  return await isPermissionGranted() || await requestPermission() === "granted";
}
const last = new Map<string, number>();
export async function notifyDownload(id: string, progress: number, done?: number, total?: number, eta?: number, complete = false) {
  if (!isTauri() || !useSettings.getState().downloadNotifications) return;
  if (!complete && Date.now() - (last.get(id) ?? 0) < 15000) return;
  last.set(id, Date.now());
  try {
    if (!await isPermissionGranted()) return;
    let hash = 0; for (const char of id) hash = ((hash * 31) + char.charCodeAt(0)) | 0;
    sendNotification({ id: Math.abs(hash) || 1, title: complete ? "LumaTube · Download complete" : `LumaTube · ${Math.round(progress * 100)}% downloaded`, body: `${formatBytes(done)} / ${total ? formatBytes(total) : "unknown size"} · ${total ? formatBytes(Math.max(0, total - (done ?? 0))) + " remaining" : "Calculating remaining size"}${eta ? ` · ${Math.ceil(eta / 60)} min left` : ""}`, silent: !complete });
    if (complete) last.delete(id);
  } catch (error) { console.warn("Download notification unavailable", error); }
}
