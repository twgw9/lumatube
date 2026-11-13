import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon, Sparkles, Youtube } from "lucide-react";
import { demoVideos } from "@/lib/mock";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { VideoCard } from "@/components/VideoCard";
import { Badge, Button, EmptyState } from "@/components/ui";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const notes = useLibrary((s) => s.notes);
  const hideShorts = useSettings((s) => s.hideShorts);

  useEffect(() => setInput(q), [q]);

  const results = useMemo(() => {
    const query = q.toLowerCase();
    if (!query) return [];
    return demoVideos.filter((v) => {
      if (hideShorts && v.isShort) return false;
      return `${v.title} ${v.channelName} ${v.description ?? ""}`.toLowerCase().includes(query);
    });
  }, [q, hideShorts]);

  const noteHits = useMemo(() => {
    const query = q.toLowerCase();
    if (!query) return [];
    return notes.filter((n) => `${n.body} ${n.videoTitle}`.toLowerCase().includes(query));
  }, [q, notes]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q: input });
        }}
        className="mb-4 flex gap-2"
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-mute)]" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search local library…"
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] pl-10 pr-3 text-[14px] outline-none focus:border-[color-mix(in_oklab,var(--accent)_45%,var(--border))]"
          />
        </div>
        <Button variant="primary" size="lg" type="submit">
          Search
        </Button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-mute)]">
        <Badge tone="accent">
          <Sparkles className="h-3 w-3" /> Local search · 0 API quota
        </Badge>
        <Badge>
          <Youtube className="h-3 w-3" /> YouTube search on demand
        </Badge>
        <span>{results.length} results</span>
      </div>

      {results.length ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title={q ? `"${q}" ke liye kuch nahi mila` : "Kuch dhoondo"}
          description="Local library (subscriptions, downloads, notes) me search hota hai — bina API quota kharch kiye."
        />
      )}

      {noteHits.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-[13.5px] font-semibold text-[var(--text-dim)]">Notes me hits</h2>
          <ul className="space-y-1.5">
            {noteHits.map((n) => (
              <li key={n.id}>
                <a
                  href={`#/watch/${n.videoId}?t=${n.tsSec}`}
                  className="block rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 transition-colors hover:bg-[var(--bg-elev-2)]"
                >
                  <p className="text-[12.5px] text-[var(--text-dim)]">{n.body}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-mute)]">
                    {n.videoTitle} · {n.tsSec}s
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
