import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Flame, Play, Plus, Sparkles, TrendingUp } from "lucide-react";
import { demoVideos } from "@/lib/mock";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { VideoGrid } from "@/components/VideoCard";
import { loadFeed } from "@/lib/bridge";
import { Button, EmptyState, Segmented } from "@/components/ui";
import { cn, formatTime } from "@/lib/utils";
import type { Video } from "@/lib/types";

export function HomePage() {
  const tabs = useSettings((s) => s.homeTabs);
  const hideShorts = useSettings((s) => s.hideShorts);
  const hideRecommendations = useSettings((s) => s.hideRecommendations);
  const focusMode = useSettings((s) => s.focusMode);
  const keywordBlocklist = useSettings((s) => s.keywordBlocklist);
  const channelBlocklist = useSettings((s) => s.channelBlocklist);

  const folders = useLibrary((s) => s.folders);
  const progress = useLibrary((s) => s.progress);
  const history = useLibrary((s) => s.history);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "t_new");
  const [remoteFeed, setRemoteFeed] = useState<Video[] | null>(null);

  // With the Rust backend present this pulls the real SQLite feed; in the
  // browser demo it returns [] and we fall back to the sample dataset.
  useEffect(() => {
    let alive = true;
    loadFeed(150).then((rows) => {
      if (alive && rows.length) setRemoteFeed(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const source = remoteFeed ?? demoVideos;
    let list = source.filter((v) => {
      if (hideShorts && v.isShort) return false;
      if (channelBlocklist.includes(v.channelId)) return false;
      const hay = `${v.title} ${v.channelName}`.toLowerCase();
      if (keywordBlocklist.some((k) => k && hay.includes(k.toLowerCase()))) return false;
      return true;
    });

    const tab = tabs.find((t) => t.id === activeTab);
    if (tab?.kind === "folder" && tab.folderId) {
      const folder = folders.find((f) => f.id === tab.folderId);
      if (folder) {
        list = list.filter((v) => folder.channelIds.includes(v.channelId));
      }
    }
    return list;
  }, [activeTab, tabs, folders, hideShorts, keywordBlocklist, channelBlocklist, remoteFeed]);

  const continueList = useMemo(() => {
    return Object.values(progress)
      .filter((p) => !p.completed && p.percent > 0.02 && p.percent < 0.97)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((p) => demoVideos.find((v) => v.id === p.videoId))
      .filter(Boolean) as Video[];
  }, [progress]);

  const tab = tabs.find((t) => t.id === activeTab);
  const isContinueTab = tab?.kind === "continue";

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 pb-16 pt-4 sm:px-6">
      {/* header row */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-[19px] font-semibold tracking-tight">
          {focusMode ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-[var(--accent)]" /> Focus feed
            </span>
          ) : (
            "Home"
          )}
        </h1>
        <span className="hidden text-[12px] text-[var(--text-mute)] sm:inline">
          · {filtered.length} videos · algorithm off
        </span>
      </div>

      {/* tabs */}
      <div className="sticky top-14 z-20 -mx-4 mb-5 mt-2 flex items-center gap-1.5 overflow-x-auto bg-[var(--bg)]/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors",
              activeTab === t.id
                ? "border-transparent bg-[var(--text)] text-[var(--bg)]"
                : "border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]",
            )}
          >
            {t.label}
          </button>
        ))}
        <Link
          to="/settings/appearance"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-mute)] hover:text-[var(--text)]"
          title="Customize tabs"
        >
          <Plus className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* continue watching rail */}
      {!isContinueTab && continueList.length > 0 && !hideRecommendations && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--text-dim)]">
              <Play className="h-3.5 w-3.5" /> Continue watching
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("t_continue")}>
              See all
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {continueList.slice(0, 3).map((v) => {
              const p = progress[v.id];
              return (
                <Link
                  key={v.id}
                  to={`/watch/${v.id}`}
                  className="group flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-2.5 transition-colors hover:border-[color-mix(in_oklab,var(--accent)_35%,var(--border))]"
                >
                  <div className="relative w-36 shrink-0 overflow-hidden rounded-lg">
                    <img src={v.thumb} alt="" className="aspect-video w-full object-cover" />
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] text-white">
                      {formatTime(v.durationSec)}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
                      <div
                        className="h-full bg-[var(--accent)]"
                        style={{ width: `${(p?.percent ?? 0) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="clamp-2 text-[13px] font-medium leading-snug">{v.title}</p>
                    <p className="mt-1 text-[11.5px] text-[var(--text-mute)]">{v.channelName}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--accent)]">
                      {Math.round((p?.percent ?? 0) * 100)}% dekha · {formatTime(p?.positionSec ?? 0)} se
                      resume
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* main grid */}
      <VideoGrid
        videos={isContinueTab ? continueList : filtered}
        empty={
          <EmptyState
            icon={<Filter className="h-6 w-6" />}
            title="Is tab me kuch nahi hai"
            description="Filters ya folders adjust karo. Focus mode me app sirf aapke subscriptions dikhata hai."
            action={
              <Button variant="primary" onClick={() => setActiveTab("t_new")}>
                Aaj ke naye dekho
              </Button>
            }
          />
        }
      />

      {/* footer rail */}
      {!focusMode && (
        <div className="mt-12 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: <TrendingUp className="h-4 w-4" />,
              title: "Trending (skip algorithm)",
              body: "Region ke most popular videos, bina personalization ke.",
            },
            {
              icon: <Flame className="h-4 w-4" />,
              title: "Watch time today",
              body: "Aaj 42 min dekha · budget 60 min. Control Settings → Focus me.",
            },
            {
              icon: <Sparkles className="h-4 w-4" />,
              title: "Time saved by SponsorBlock",
              body: "Is hafte 2 ghante 14 min bacha (14 segments skipped).",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-4"
            >
              <span className="text-[var(--accent)]">{c.icon}</span>
              <h3 className="mt-2 text-[13px] font-semibold">{c.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-mute)]">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
