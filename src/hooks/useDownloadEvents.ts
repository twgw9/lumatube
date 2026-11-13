import { notifyDownload } from "@/lib/notifications";
import { useEffect } from "react";
import { onDownloadDone, onDownloadError, onDownloadProgress } from "@/lib/bridge";
import { useLibrary } from "@/store/library";

/**
 * Bridges Rust download events into the local store.
 * No fake browser progress is generated.
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


    return () => {
      unProgress();
      unDone();
      unError();
      if (timer) window.clearInterval(timer);
    };
  }, []);
}
