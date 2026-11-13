import { useCatalog } from "@/store/catalog";
import { useSearchParams } from "react-router-dom";
import { useSettings } from "@/store/settings";
import { useMemo, useState } from "react";
import { Bookmark, Download, Folder, Heart, ListVideo, Plus, Trash2 } from "lucide-react";
import { demoVideos } from "@/lib/mock";
import { useLibrary } from "@/store/library";
import { VideoCard } from "@/components/VideoCard";
import { Badge, Button, EmptyState, Input, Segmented } from "@/components/ui";
import { cn } from "@/lib/utils";

type Tab = "playlists" | "liked" | "history" | "clips";

export function LibraryPage() {
  const lib = useLibrary();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab");
  const tab: Tab = ["playlists", "liked", "history", "clips"].includes(requestedTab ?? "") ? requestedTab as Tab : "playlists";
  const setTab = (value: Tab) => setParams({ tab: value });
  const recordHistory = useSettings(s => s.recordHistory);
  const [historyQuery, setHistoryQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const catalog = useCatalog(s => s.videos);
  const videoMap = useMemo(() => new Map(Object.values(catalog).map(v => [v.id, v])), [catalog]);

  const likedVideos = lib.liked.map((id) => videoMap.get(id)).filter(Boolean) as typeof demoVideos;
  const historyVideos = Array.from(new Map(lib.history.map(h => [h.videoId, videoMap.get(h.videoId) ?? {
    id: h.videoId, title: h.title, channelName: h.channelName, channelId: "", thumb: h.thumb,
    publishedAt: new Date(h.watchedAt).toISOString(), durationSec: 0,
  }])).values()).filter(v => `${v.title} ${v.channelName}`.toLowerCase().includes(historyQuery.toLowerCase()));

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 pb-16 pt-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-semibold tracking-tight">Library</h1>
        <Badge>
          {lib.playlists.length} playlists · {lib.history.length} history
        </Badge>
        <div className="ml-auto">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "playlists", label: "Playlists" },
              { value: "liked", label: "Liked" },
              { value: "history", label: "History" },
              { value: "clips", label: "Clips" },
            ]}
            size="sm"
          />
        </div>
      </div>

      {tab === "playlists" && (
        <>
          <div className="mb-4 flex items-center gap-2">
            {creating ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      lib.createPlaylist(newName.trim());
                      setNewName("");
                      setCreating(false);
                    }
                  }}
                  placeholder="Playlist name"
                  className="w-52"
                />
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => {
                    if (newName.trim()) lib.createPlaylist(newName.trim());
                    setNewName("");
                    setCreating(false);
                  }}
                >
                  Create
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> New playlist
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lib.playlists.map((p) => (
              <div
                key={p.id}
                className="group rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 transition-colors hover:border-[color-mix(in_oklab,var(--accent)_35%,var(--border))]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <ListVideo className="h-4 w-4 text-[var(--accent)]" />
                  <h3 className="clamp-1 flex-1 text-[13.5px] font-semibold">{p.name}</h3>
                  <button
                    onClick={() => lib.deletePlaylist(p.id)}
                    className="text-[var(--text-mute)] opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                    aria-label="Delete playlist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-1.5 overflow-hidden">
                  {p.videoIds.slice(0, 3).map((id) => {
                    const v = videoMap.get(id);
                    return v ? (
                      <img
                        key={id}
                        src={v.thumb}
                        alt=""
                        className="aspect-video w-1/3 rounded object-cover"
                      />
                    ) : null;
                  })}
                  {!p.videoIds.length && (
                    <p className="py-3 text-[12px] text-[var(--text-mute)]">Empty playlist — use "Save" on a video.</p>
                  )}
                </div>
                <p className="mt-2 text-[11.5px] text-[var(--text-mute)]">{p.videoIds.length} videos</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "liked" && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {likedVideos.length ? (
            likedVideos.map((v) => <VideoCard key={v.id} video={v} />)
          ) : (
            <div className="col-span-full">
              <EmptyState icon={<Heart className="h-6 w-6" />} title="No liked videos yet" />
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <>
          <p className="mb-3 text-sm text-[var(--text-dim)]">Guest history · saved on this device · {recordHistory ? "Recording on" : "Paused (progress saving also paused)"}</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input aria-label="Search watch history" placeholder="Search watch history" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} className="max-w-sm" />
            <Button size="sm" onClick={() => useSettings.getState().set("recordHistory", !recordHistory)}>{recordHistory ? "Pause history" : "Resume history"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Clear local watch history? Saved playback progress will remain.")) lib.clearHistory(); }}>
              <Trash2 className="h-3.5 w-3.5" /> Clear history
            </Button>
          </div>
          <ul className="space-y-1">
            {historyVideos.map((v) => (
              <li key={v.id}>
                <VideoCard video={v} layout="list" />
              </li>
            ))}
          </ul>
          {!historyVideos.length && <EmptyState icon={<Bookmark className="h-6 w-6" />} title={historyQuery ? "No matching history" : "History is empty"} />}
        </>
      )}

      {tab === "clips" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lib.clips.length ? (
            lib.clips.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]">
                <img src={c.thumb} alt="" className="aspect-video w-full object-cover" />
                <div className="p-2.5">
                  <p className="clamp-1 text-[12.5px] font-medium">{c.videoTitle}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-mute)]">
                    {c.label} · {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState
                icon={<Bookmark className="h-6 w-6" />}
                title="Clip bookmarks"
                description="Press 'Clip' in the player to save a moment."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
