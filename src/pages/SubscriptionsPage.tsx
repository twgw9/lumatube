import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FolderPlus, Plus, Rss, Search, Users } from "lucide-react";
import { demoVideos } from "@/lib/mock";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { VideoGrid } from "@/components/VideoCard";
import { Button, EmptyState, Input, Segmented, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export function SubscriptionsPage() {
  const [params, setParams] = useSearchParams();
  const folderId = params.get("folder");
  const folders = useLibrary((s) => s.folders);
  const channels = useLibrary((s) => s.channels);
  const addFolder = useLibrary((s) => s.addFolder);
  const toggleSubscribe = useLibrary((s) => s.toggleSubscribe);
  const hideShorts = useSettings((s) => s.hideShorts);

  const [q, setQ] = useState("");
  const [view, setView] = useState<"videos" | "channels">("videos");
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const activeFolder = folders.find((f) => f.id === folderId) ?? null;

  const visibleChannels = useMemo(() => {
    let list = channels.filter((c) => c.subscribed !== false);
    if (activeFolder) list = list.filter((c) => activeFolder.channelIds.includes(c.id));
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [channels, activeFolder, q]);

  const videos = useMemo(() => {
    const ids = new Set(visibleChannels.map((c) => c.id));
    return demoVideos.filter(
      (v) => ids.has(v.channelId) && (!hideShorts || !v.isShort),
    );
  }, [visibleChannels, hideShorts]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 pb-16 pt-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-semibold tracking-tight">Subscriptions</h1>
        <Badge>
          <Users className="h-3 w-3" /> {channels.filter((c) => c.subscribed !== false).length} channels
        </Badge>
        <Badge tone="accent">
          <Rss className="h-3 w-3" /> RSS based · zero quota
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "videos", label: "Videos" },
              { value: "channels", label: "Channels" },
            ]}
            size="sm"
          />
          <Button size="sm" variant="secondary" onClick={() => setNewFolder(true)}>
            <FolderPlus className="h-3.5 w-3.5" /> Folder
          </Button>
        </div>
      </div>

      {/* folder chips */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setParams({})}
          className={cn(
            "h-7.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
            !folderId
              ? "border-transparent bg-[var(--text)] text-[var(--bg)]"
              : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--bg-elev)]",
          )}
        >
          All
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => setParams({ folder: f.id })}
            className={cn(
              "h-7.5 rounded-full border px-3 text-[12px] font-medium transition-colors",
              folderId === f.id
                ? "border-transparent bg-[var(--text)] text-[var(--bg)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--bg-elev)]",
            )}
          >
            {f.name}
            <span className="ml-1.5 text-[10.5px] opacity-60">{f.channelIds.length}</span>
          </button>
        ))}
        {newFolder && (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderName.trim()) {
                  addFolder(folderName.trim());
                  setFolderName("");
                  setNewFolder(false);
                }
                if (e.key === "Escape") setNewFolder(false);
              }}
              placeholder="Folder name"
              className="h-7.5 w-40 text-[12px]"
            />
          </div>
        )}
      </div>

      {view === "channels" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleChannels.map((c) => (
            <div
              key={c.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-center"
            >
              <img src={c.avatar} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-[var(--border)]" />
              <p className="clamp-1 text-[13px] font-medium">{c.name}</p>
              <p className="text-[11px] text-[var(--text-mute)]">{c.handle && `@${c.handle}`}</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-7 rounded-full px-2.5 text-[11.5px]"
                onClick={() => toggleSubscribe(c.id)}
              >
                Unsubscribe
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <VideoGrid
          videos={videos}
          empty={
            <EmptyState
              icon={<Rss className="h-6 w-6" />}
              title="Nothing in this folder"
              description="Add channels or switch folders. The feed only comes from your subscriptions."
              action={<Button variant="primary" onClick={() => setView("channels")}>Browse channels</Button>}
            />
          }
        />
      )}
    </div>
  );
}
