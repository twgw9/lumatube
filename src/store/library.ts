import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Channel,
  Clip,
  DownloadJob,
  Note,
  Playlist,
  Progress,
  WatchEvent,
} from "@/lib/types";
import {
  demoChannels,
  demoDownloadSeed,
  demoHistorySeed,
  demoNoteSeed,
} from "@/lib/mock";
import { uid } from "@/lib/utils";

export interface Folder {
  id: string;
  name: string;
  channelIds: string[];
}

interface LibraryState {
  channels: Channel[];
  folders: Folder[];
  notes: Note[];
  clips: Clip[];
  playlists: Playlist[];
  progress: Record<string, Progress>;
  history: WatchEvent[];
  downloads: DownloadJob[];
  liked: string[];
  watchLater: string[];
  bookmarks: Record<string, number>; // videoId -> last bookmarked second

  addChannel: (c: Channel) => void;
  removeChannel: (id: string) => void;
  toggleSubscribe: (id: string) => void;
  addFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void;
  assignChannelToFolder: (channelId: string, folderId: string, on: boolean) => void;

  addNote: (n: Omit<Note, "id" | "createdAt" | "updatedAt">) => Note;
  updateNote: (id: string, body: string, tags?: string[]) => void;
  deleteNote: (id: string) => void;

  addClip: (c: Omit<Clip, "id" | "createdAt">) => void;
  deleteClip: (id: string) => void;

  createPlaylist: (name: string) => string;
  addToPlaylist: (playlistId: string, videoId: string) => void;
  removeFromPlaylist: (playlistId: string, videoId: string) => void;
  deletePlaylist: (id: string) => void;

  setProgress: (p: Progress) => void;
  clearProgress: (videoId: string) => void;
  pushHistory: (e: Omit<WatchEvent, "id" | "watchedAt">) => void;
  clearHistory: () => void;

  enqueueDownload: (j: Omit<DownloadJob, "createdAt" | "status" | "progress">) => void;
  updateDownload: (id: string, patch: Partial<DownloadJob>) => void;
  removeDownload: (id: string) => void;
  clearFinishedDownloads: () => void;

  toggleLike: (videoId: string) => void;
  toggleWatchLater: (videoId: string) => void;
  setBookmark: (videoId: string, sec: number) => void;

  importState: (data: Partial<LibraryState>) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      channels: [], folders: [], notes: [], clips: [], playlists: [], progress: {}, history: [], downloads: [], liked: [], watchLater: [], bookmarks: {},

      addChannel: (c) =>
        set((s) =>
          s.channels.some((x) => x.id === c.id)
            ? { channels: s.channels.map((x) => (x.id === c.id ? { ...x, ...c } : x)) }
            : { channels: [...s.channels, { ...c, subscribed: true }] },
        ),
      removeChannel: (id) =>
        set((s) => ({
          channels: s.channels.filter((c) => c.id !== id),
          folders: s.folders.map((f) => ({ ...f, channelIds: f.channelIds.filter((c) => c !== id) })),
        })),
      toggleSubscribe: (id) =>
        set((s) => ({
          channels: s.channels.map((c) =>
            c.id === id ? { ...c, subscribed: !c.subscribed } : c,
          ),
        })),
      addFolder: (name) => {
        const id = uid("f");
        set((s) => ({ folders: [...s.folders, { id, name, channelIds: [] }] }));
        return id;
      },
      renameFolder: (id, name) =>
        set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),
      deleteFolder: (id) => set((s) => ({ folders: s.folders.filter((f) => f.id !== id) })),
      assignChannelToFolder: (channelId, folderId, on) =>
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id !== folderId
              ? f
              : {
                  ...f,
                  channelIds: on
                    ? Array.from(new Set([...f.channelIds, channelId]))
                    : f.channelIds.filter((c) => c !== channelId),
                },
          ),
        })),

      addNote: (n) => {
        const note: Note = { ...n, id: uid("n"), createdAt: Date.now(), updatedAt: Date.now() };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note;
      },
      updateNote: (id, body, tags) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, body, tags: tags ?? n.tags, updatedAt: Date.now() } : n,
          ),
        })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addClip: (c) =>
        set((s) => ({ clips: [{ ...c, id: uid("c"), createdAt: Date.now() }, ...s.clips] })),
      deleteClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),

      createPlaylist: (name) => {
        const id = uid("p");
        set((s) => ({
          playlists: [...s.playlists, { id, name, videoIds: [], createdAt: Date.now(), updatedAt: Date.now() }],
        }));
        return id;
      },
      addToPlaylist: (playlistId, videoId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId && !p.videoIds.includes(videoId)
              ? { ...p, videoIds: [...p.videoIds, videoId], updatedAt: Date.now() }
              : p,
          ),
        })),
      removeFromPlaylist: (playlistId, videoId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, videoIds: p.videoIds.filter((v) => v !== videoId), updatedAt: Date.now() }
              : p,
          ),
        })),
      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),

      setProgress: (p) =>
        set((s) => ({ progress: { ...s.progress, [p.videoId]: p } })),
      clearProgress: (videoId) =>
        set((s) => {
          const next = { ...s.progress };
          delete next[videoId];
          return { progress: next };
        }),
      pushHistory: (e) =>
        set((s) => ({
          history: [
            { ...e, id: uid("w"), watchedAt: Date.now() },
            ...s.history.filter((h) => h.videoId !== e.videoId),
          ].slice(0, 500),
        })),
      clearHistory: () => set({ history: [] }),

      enqueueDownload: (j) =>
        set((s) => ({
          downloads: [
            {
              ...j,
              id: j.id,
              status: "queued",
              progress: 0,
              createdAt: Date.now(),
              showInGallery: j.showInGallery ?? true,
            },
            ...s.downloads,
          ],
        })),
      updateDownload: (id, patch) =>
        set((s) => ({
          downloads: s.downloads.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeDownload: (id) => set((s) => ({ downloads: s.downloads.filter((d) => d.id !== id) })),
      clearFinishedDownloads: () =>
        set((s) => ({ downloads: s.downloads.filter((d) => d.status !== "done") })),

      toggleLike: (videoId) =>
        set((s) => ({
          liked: s.liked.includes(videoId)
            ? s.liked.filter((v) => v !== videoId)
            : [...s.liked, videoId],
        })),
      toggleWatchLater: (videoId) =>
        set((s) => ({
          watchLater: s.watchLater.includes(videoId)
            ? s.watchLater.filter((v) => v !== videoId)
            : [videoId, ...s.watchLater],
        })),
      setBookmark: (videoId, sec) =>
        set((s) => ({ bookmarks: { ...s.bookmarks, [videoId]: sec } })),

      importState: (data) => set(data as Partial<LibraryState>),
    }),
    { name: "localtube.library.v1", version: 2, migrate: (persisted) => {
      const state = persisted as Partial<LibraryState>;
      const seededChannels = new Set(demoChannels.map(c => c.id));
      const seededDownloads = new Set(demoDownloadSeed.map(d => d.id));
      const seededHistory = new Set(demoHistorySeed.map(h => h.id));
      return { ...state,
        channels: (state.channels ?? []).filter(c => !seededChannels.has(c.id)),
        downloads: (state.downloads ?? []).filter(d => !seededDownloads.has(d.id)),
        history: (state.history ?? []).filter(h => !seededHistory.has(h.id)),
      };
    } },
  ),
);
