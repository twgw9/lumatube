import { notifyDownload } from "@/lib/notifications";
import { useEffect } from "react";
import { onDownloadDone, onDownloadError, onDownloadProgress } from "@/lib/bridge";
import { useLibrary } from "@/store/library";

/**
 * Bridges Rust download events into the local store.
 * In the browser demo there is no backend, so the seeded demo job is animated
 * instead — same code paths, no special-casing in components.
 */
export function useDownloadEvents() {
  useEffect(() => {
    let unProgress = () => {};
    let unDone = () => {};
    let unError = () => {};
    let timer: number | undefined;

    (async () => {
      unProgress = await onDownloadProgress((e) => {
        void notifyDownload(e.jobId, e.progress, e.bytesDone, e.bytesTotal, e.etaSec);
        useLibrary.getState().updateDownload(e.jobId, {
          status: "running",
          progress: e.progress,
          bytesDone: e.bytesDone,
          bytesTotal: e.bytesTotal,
          speedBps: e.speedBps,
          etaSec: e.etaSec,
        });
      });
      unDone = await onDownloadDone((e) => {
        void notifyDownload(e.jobId, 1, e.bytesTotal, e.bytesTotal, 0, true);
        useLibrary.getState().updateDownload(e.jobId, {
          status: "done",
          progress: 1,
          filePath: e.filePath,
          bytesTotal: e.bytesTotal,
          bytesDone: e.bytesTotal,
          finishedAt: Date.now(),
          showInGallery: e.inGallery,
        });
      });
      unError = await onDownloadError((e) => {
        useLibrary.getState().updateDownload(e.jobId, {
          status: "error",
          error: e.error,
        });
      });
    })();

    // demo animation: keeps the running seed job moving so the UI feels alive
    const hasBackend = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!hasBackend) {
      timer = window.setInterval(() => {
        const { downloads, updateDownload } = useLibrary.getState();
        const running = downloads.find((d) => d.status === "running");
        if (running && running.progress < 1) {
          updateDownload(running.id, { progress: Math.min(1, running.progress + 0.006) });
        } else if (running) {
          updateDownload(running.id, { status: "done", progress: 1, finishedAt: Date.now() });
        }
      }, 900);
    }

    return () => {
      unProgress();
      unDone();
      unError();
      if (timer) window.clearInterval(timer);
    };
  }, []);
}
