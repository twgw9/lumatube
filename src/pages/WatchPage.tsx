import { useCatalog } from "@/store/catalog";
import { videoDetails } from "@/lib/youtube";
import { isTauri } from "@/lib/utils";
import { SubscribeButton } from "@/components/SubscribeButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Flag,
  Heart,
  ListVideo,
  MessageSquare,
  NotebookPen,
  Play,
  Search,
  Share2,
  Sparkles,
  SplitSquareHorizontal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { demoVideos, demoSegments } from "@/lib/mock";
import { useLibrary } from "@/store/library";
import { useSettings } from "@/store/settings";
import { PlayerSurface } from "@/components/Player/PlayerSurface";
import { Badge, Button, EmptyState, IconButton, Segmented } from "@/components/ui";
import { cn, formatCount, formatTime, timeAgo } from "@/lib/utils";
import {
  fetchDislikes,
  fetchSkipSegments,
  fetchTranscript,
  persistProgress,
  resolveStream,
  type StreamInfo,
} from "@/lib/bridge";
import { DownloadSheet } from "@/components/DownloadSheet";
import type { Segment } from "@/lib/types";
import { VideoCard } from "@/components/VideoCard";

type SideTab = "notes" | "transcript" | "chapters" | "queue";

export function WatchPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const startAt = Number(params.get("t") ?? 0);

  const catalog = useCatalog(s => s.videos);
  const video = catalog[id] ?? { id, title: `YouTube video · ${id}`, channelId: "", channelName: "Metadata unavailable", thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, publishedAt: "", durationSec: 0 };
  const related = Object.values(catalog).filter(v => v.id !== id).slice(0, 8);
  const native = isTauri();
  const [streamError, setStreamError] = useState("");
  const [retry, setRetry] = useState(0);


  const settings = useSettings();
  const lib = useLibrary();
  const progress = lib.progress[video.id];
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [transcript, setTranscript] = useState<{ t: number; text: string }[]>([]);
  const [votes, setVotes] = useState<{ likes: number; dislikes: number } | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>(settings.showNotes ? "notes" : "chapters");
  const [theater, setTheater] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteAt, setNoteAt] = useState(startAt);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(startAt);
  const [showDesc, setShowDesc] = useState(false);

  useEffect(() => {
    if (!settings.showNotes && sideTab === "notes") setSideTab("chapters");
  }, [settings.showNotes, sideTab]);
  const lastPos = useRef(startAt);

  /* ── data loading ─────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    setStream(null); setStreamError(""); setSegments([]); setTranscript([]); setVotes(null);
    if (native) resolveStream(
      video.id,
      settings.premiumStreaming ? "auto" : settings.defaultQuality,
      settings.engine,
    ).then((s) => alive && setStream(s)).catch(err => { if (alive) setStreamError(err instanceof Error ? err.message : String(err)); });
    fetchSkipSegments(video.id, settings.sponsorCategories).then(
      (s) => alive && s.length && setSegments(s),
    );
    fetchTranscript(video.id).then((t) => alive && setTranscript(t));
    if (settings.returnYoutubeDislike) {
      fetchDislikes(video.id).then((v) => alive && v && setVotes(v));
    }
    if (settings.dataApiKey && !catalog[video.id]) void videoDetails([video.id], settings.dataApiKey).then(rows => { if (alive) useCatalog.getState().remember(rows); }).catch(() => {});
    if (useSettings.getState().recordHistory && catalog[video.id]) lib.pushHistory({
      videoId: video.id,
      title: video.title,
      channelName: video.channelName,
      thumb: video.thumb,
      secondsWatched: 0,
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, retry, settings.engine, settings.defaultQuality, settings.premiumStreaming]);

  const onProgress = useCallback(
    (pos: number, dur: number) => {
      lastPos.current = pos;
      setCurrentTime(pos);
      if (!useSettings.getState().recordHistory) return;
      const percent = dur ? pos / dur : 0;
      const completed = dur > 0 && percent > 0.97;
      lib.setProgress({
        videoId: video.id,
        positionSec: pos,
        durationSec: dur,
        percent,
        updatedAt: Date.now(),
        completed,
      });
      // persistent (SQLite) mirror — no-op in the browser demo
      void persistProgress({
        videoId: video.id,
        positionSec: pos,
        durationSec: dur,
        percent,
        completed,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [video.id],
  );

  const onEnded = useCallback(() => {
    const next = related[0];
    if (next && settings.autoplayNext && !settings.hideRecommendations && !(settings.focusMode && settings.autoPlayDisabledInFocus)) {
      window.location.hash = `#/watch/${next.id}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [related, settings.autoplayNext, settings.hideRecommendations, settings.focusMode, settings.autoPlayDisabledInFocus]);

  const resumeAt = progress && !progress.completed && progress.percent < 0.95 ? progress.positionSec : startAt;

  const addNote = () => {
    if (!noteDraft.trim()) return;
    lib.addNote({
      videoId: video.id,
      videoTitle: video.title,
      channelName: video.channelName,
      tsSec: Math.floor(noteAt),
      body: noteDraft.trim(),
      tags: [],
    });
    setNoteDraft("");
    setSideTab("notes");
  };

  const notes = lib.notes.filter((n) => n.videoId === video.id);
  const transcriptFiltered = transcriptQuery
    ? transcript.filter((l) => l.text.toLowerCase().includes(transcriptQuery.toLowerCase()))
    : transcript;
  const activeTranscript = transcript.reduce<number>((acc, l, i) => (currentTime >= l.t ? i : acc), -1);

  return (
    <div className="mx-auto w-full max-w-[1760px] px-3 pb-24 pt-3 sm:px-5">
      <div
        className={cn(
          "grid gap-6",
          cinema && "fixed inset-0 z-50 bg-black p-0",
          theater ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_400px]",
        )}
      >
        {/* ── LEFT: player + meta ──────────────────────────── */}
        <div className={cn("min-w-0", cinema && "grid place-items-center")}>
          {cinema && (
            <button
              onClick={() => setCinema(false)}
              className="fixed right-4 top-4 z-50 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white backdrop-blur hover:bg-white/20"
            >
              Exit cinema
            </button>
          )}

          <div className="relative">
            {settings.ambientMode && (
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 opacity-45 blur-3xl"
                style={{
                  background: `url(${video.thumb}) center/cover`,
                  filter: "saturate(1.6) blur(48px)",
                }}
              />
            )}
          {!native ? <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe key={id} title={video.title} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" /></div> : streamError ? <div role="alert" className="grid aspect-video place-items-center rounded-xl bg-[var(--bg-elev)] p-6 text-center"><div><p className="mb-4 text-sm text-amber-400">{streamError}</p><Button onClick={() => setRetry(r => r + 1)}>Retry extraction</Button><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer" className="ml-3 text-sm underline">Watch on YouTube</a></div></div> : <PlayerSurface
            video={video}
            stream={stream}
            segments={segments}
            enabledCategories={settings.sponsorCategories}
            muteInsteadOfSkip={settings.sponsorMuteInsteadOfSkip}
            startAt={resumeAt}
            autoplay={settings.autoplayNext}
            onProgress={onProgress}
            onEnded={onEnded}
            onDownload={() => setDownloadOpen(true)}
            onBookmark={(sec) => {
              lib.setBookmark(video.id, sec);
              setNoteAt(sec);
              setSideTab("notes");
            }}
            onSpeedPersist={(s) => settings.set("defaultSpeed", s)}
            theater={theater}
            onToggleTheater={() => setTheater((v) => !v)}
            onPrev={related.length ? () => (window.location.hash = `#/watch/${related[related.length - 1].id}`) : undefined}
            onNext={related.length ? () => (window.location.hash = `#/watch/${related[0].id}`) : undefined}
          />}
          </div>

          {/* title block */}
          <div className="mt-3.5">
            <h1 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] sm:text-[19px]">
              {video.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--text-mute)]">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatCount(video.views)} views
              </span>
              <span>{timeAgo(video.publishedAt)}</span>
              {video.dearrow && <Badge tone="accent">DeArrow title</Badge>}
              {stream?.source && <Badge>engine: {stream.source}</Badge>}
            </div>

            {!native && <p className="mt-3 rounded-xl border border-[var(--border)] p-3 text-xs text-[var(--text-dim)]">Browser playback uses the official YouTube embed (ads/restrictions may apply). Native speed, SponsorBlock, progress tracking and downloads do not control this embed. If embedding is blocked, <a className="underline" href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">watch on YouTube</a>.</p>}
            {/* channel + actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4">
              <Link
                to={`/channel/${video.channelId}`}
                className="flex items-center gap-2.5 rounded-full pr-2 transition hover:opacity-85"
              >
                <img
                  src={video.channelAvatar}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--border)]"
                />
                <span>
                  <span className="block text-[13.5px] font-semibold leading-tight">
                    {video.channelName}
                  </span>
                  <span className="block text-[11.5px] text-[var(--text-mute)]">
                    {formatCount(useLibrary.getState().channels.find((c) => c.id === video.channelId)?.subscribers)}{" "}
                    subscribers
                  </span>
                </span>
              </Link>

              {video.channelId && <SubscribeButton channel={{ id: video.channelId, name: video.channelName, avatar: video.channelAvatar }} />}
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <div className="flex h-9 items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-elev)]">
                  <button
                    onClick={() => lib.toggleLike(video.id)}
                    className={cn(
                      "flex h-full items-center gap-1.5 px-3 text-[12.5px] font-medium transition-colors",
                      lib.liked.includes(video.id)
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)]",
                    )}
                  >
                    <ThumbsUp
                      className={cn("h-4 w-4", lib.liked.includes(video.id) && "fill-current")}
                    />
                    {formatCount(
                      (video.likes ?? 0) + (lib.liked.includes(video.id) ? 1 : 0) || votes?.likes,
                    )}
                  </button>
                  <div className="h-5 w-px bg-[var(--border)]" />
                  <button
                    onClick={() => settings.set("returnYoutubeDislike", !settings.returnYoutubeDislike)}
                    className="flex h-full items-center gap-1.5 px-3 text-[12.5px] font-medium text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)]"
                    title="Dislikes via Return YouTube Dislike API (community data)"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    {settings.returnYoutubeDislike ? formatCount(votes?.dislikes ?? video.dislikes) : "—"}
                  </button>
                </div>

                <Button size="sm" onClick={() => setDownloadOpen(true)} className="h-9 rounded-full">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                {settings.showNotes && <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-full px-3 text-[12.5px]"
                  onClick={() => {
                    setNoteAt(currentTime);
                    setSideTab("notes");
                  }}
                >
                  <NotebookPen className="h-4 w-4" /> Note
                </Button>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-full px-3 text-[12.5px]"
                  onClick={() => lib.addClip({
                    videoId: video.id,
                    videoTitle: video.title,
                    thumb: video.thumb,
                    startSec: Math.floor(currentTime),
                    label: `${formatTime(currentTime)} moment`,
                  })}
                >
                  <BookmarkPlus className="h-4 w-4" /> Clip
                </Button>
                <IconButton label="Share" className="h-9 w-9">
                  <Share2 className="h-4 w-4" />
                </IconButton>
                <div className="flex h-9 overflow-hidden rounded-full border border-[var(--border)]">
                  <IconButton
                    label="Theater"
                    className={cn("h-9 w-9 rounded-none", theater && "bg-[var(--bg-elev-2)] text-[var(--accent)]")}
                    onClick={() => setTheater((v) => !v)}
                  >
                    <SplitSquareHorizontal className="h-4 w-4" />
                  </IconButton>
                  <div className="w-px bg-[var(--border)]" />
                  <IconButton
                    label="Cinema (dim everything)"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setCinema(true)}
                  >
                    <Sparkles className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>

            {/* description */}
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3.5">
              <div className="mb-1.5 flex items-center gap-3 text-[12px] font-medium text-[var(--text-dim)]">
                <span>{formatCount(video.views)} views</span>
                <span>{timeAgo(video.publishedAt)}</span>
                <span className="text-[var(--accent)]">
                  {segments.filter((s) => s.action === "skip").length} sponsor segments
                </span>
              </div>
              <p
                className={cn(
                  "whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-dim)]",
                  !showDesc && "clamp-3",
                )}
              >
                {video.description}
              </p>
              <button
                onClick={() => setShowDesc((v) => !v)}
                className="mt-2 text-[12px] font-medium text-[var(--text-mute)] hover:text-[var(--text)]"
              >
                {showDesc ? "Show less" : "Show more"}
              </button>
            </div>

            {/* chapters strip */}
            {!!video.chapters?.length && (
              <section className="mt-6">
                <h2 className="mb-2.5 text-[13.5px] font-semibold text-[var(--text-dim)]">Chapters</h2>
                <div className="flex gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                  {video.chapters.map((c) => (
                    <button
                      key={c.startSec}
                      onClick={() => (window.location.hash = `#/watch/${video.id}?t=${c.startSec}`)}
                      className="group w-40 shrink-0 text-left"
                    >
                      <div className="relative overflow-hidden rounded-lg ring-1 ring-[var(--border)]">
                        <img src={video.thumb} alt="" className="aspect-video w-full object-cover" />
                        <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1 text-[10.5px] tabular-nums text-white">
                          {formatTime(c.startSec)}
                        </span>
                      </div>
                      <p className="clamp-2 mt-1.5 text-[12px] font-medium leading-snug group-hover:text-[var(--accent)]">
                        {c.title}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* related (hidden in focus mode) */}
            {!settings.hideRecommendations && !settings.focusMode && (
              <section className="mt-8">
                <h2 className="mb-3 text-[13.5px] font-semibold text-[var(--text-dim)]">Up next</h2>
                <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
                  {related.slice(0, 6).map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ── RIGHT: tabs panel ────────────────────────────── */}
        {!cinema && (
          <aside
            className={cn(
              "min-w-0",
              theater ? "order-first xl:order-none" : "",
            )}
          >
            <div className="sticky top-[68px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]">
              <div className="flex items-center gap-0.5 border-b border-[var(--border)] p-1.5">
                {(
                  [
                    { id: "notes", label: "Notes", icon: NotebookPen, count: notes.length },
                    { id: "transcript", label: "Transcript", icon: MessageSquare },
                    { id: "chapters", label: "Chapters", icon: ListVideo },
                    { id: "queue", label: "Queue", icon: Play },
                  ] as const
                ).filter((t) => settings.showNotes || t.id !== "notes").map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSideTab(t.id)}
                    className={cn(
                      "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors",
                      sideTab === t.id
                        ? "bg-[var(--bg-elev-2)] text-[var(--text)]"
                        : "text-[var(--text-mute)] hover:text-[var(--text)]",
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                    {"count" in t && t.count ? (
                      <span className="rounded bg-[var(--bg-elev)] px-1 text-[10px]">{t.count}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* notes */}
              {settings.showNotes && sideTab === "notes" && (
                <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-3">
                  <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elev-2)] p-2.5">
                    <div className="mb-2 flex items-center justify-between text-[11.5px] text-[var(--text-mute)]">
                      <span className="flex items-center gap-1.5">
                        <span className="rounded bg-[var(--accent)]/15 px-1.5 py-0.5 font-mono tabular-nums text-[var(--accent)]">
                          {formatTime(noteAt)}
                        </span>
                       
                      </span>
                      <button
                        onClick={() => setNoteAt(currentTime)}
                        className="text-[11px] hover:text-[var(--text)]"
                      >
                        current time
                      </button>
                    </div>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
                      }}
                      placeholder="What stood out? (⌘+Enter to save)"
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[12.5px] leading-relaxed outline-none focus:border-[color-mix(in_oklab,var(--accent)_45%,var(--border))]"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="primary" onClick={addNote}>
                        Save note
                      </Button>
                    </div>
                  </div>

                  {notes.length ? (
                    <ul className="space-y-1">
                      {notes
                        .slice()
                        .sort((a, b) => a.tsSec - b.tsSec)
                        .map((n) => (
                          <li key={n.id} className="group rounded-lg p-2 transition-colors hover:bg-[var(--bg-elev-2)]">
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => (window.location.hash = `#/watch/${video.id}?t=${n.tsSec}`)}
                                className="mt-0.5 shrink-0 rounded bg-[var(--bg-elev-2)] px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-[var(--accent)] hover:bg-[var(--accent)]/20"
                              >
                                {formatTime(n.tsSec)}
                              </button>
                              <p className="flex-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--text-dim)]">
                                {n.body}
                              </p>
                              <button
                                onClick={() => lib.deleteNote(n.id)}
                                className="shrink-0 text-[var(--text-mute)] opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                                aria-label="Delete note"
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="px-2 py-8 text-center text-[12.5px] text-[var(--text-mute)]">
                      No notes on this video yet. Write the first one — the timestamp attaches itself.
                    </p>
                  )}
                </div>
              )}

              {/* transcript */}
              {sideTab === "transcript" && (
                <div className="flex max-h-[calc(100vh-14rem)] flex-col">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-2">
                    <Search className="h-3.5 w-3.5 text-[var(--text-mute)]" />
                    <input
                      value={transcriptQuery}
                      onChange={(e) => setTranscriptQuery(e.target.value)}
                      placeholder="Search transcript…"
                      className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--text-mute)]"
                    />
                    <span className="text-[10.5px] text-[var(--text-mute)]">
                      {transcriptFiltered.length} lines
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-1.5">
                    {transcriptFiltered.length ? (
                      transcriptFiltered.map((l, i) => (
                        <button
                          key={i}
                          onClick={() => (window.location.hash = `#/watch/${video.id}?t=${l.t}`)}
                          className={cn(
                            "flex w-full gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--bg-elev-2)]",
                            activeTranscript === i && "bg-[var(--accent)]/10",
                          )}
                        >
                          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--text-mute)]">
                            {formatTime(l.t)}
                          </span>
                          <span
                            className={cn(
                              "text-[12.5px] leading-relaxed",
                              activeTranscript === i ? "text-[var(--text)]" : "text-[var(--text-dim)]",
                            )}
                          >
                            {l.text}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-8 text-center text-[12.5px] text-[var(--text-mute)]">
                        No transcript available. Enable subtitles when downloading to keep one offline.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* chapters */}
              {sideTab === "chapters" && (
                <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-1.5">
                  {(video.chapters ?? []).length ? (
                    video.chapters!.map((c) => (
                      <button
                        key={c.startSec}
                        onClick={() => (window.location.hash = `#/watch/${video.id}?t=${c.startSec}`)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--bg-elev-2)]"
                      >
                        <span className="font-mono text-[10.5px] tabular-nums text-[var(--accent)]">
                          {formatTime(c.startSec)}
                        </span>
                        <span className="flex-1 text-[12.5px] text-[var(--text-dim)]">{c.title}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--text-mute)]" />
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-8 text-center text-[12.5px] text-[var(--text-mute)]">
                      This video has no chapters. Add your own as timestamped notes.
                    </p>
                  )}
                </div>
              )}

              {/* queue */}
              {sideTab === "queue" && (
                <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-1.5">
                  {lib.playlists[0]?.videoIds.length ? (
                    lib.playlists[0].videoIds.map((vid, i) => {
                      const v = demoVideos.find((x) => x.id === vid);
                      if (!v) return null;
                      return (
                        <Link
                          key={vid}
                          to={`/watch/${vid}`}
                          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--bg-elev-2)]"
                        >
                          <span className="w-4 text-center text-[11px] text-[var(--text-mute)]">{i + 1}</span>
                          <img src={v.thumb} alt="" className="h-9 w-16 rounded object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="clamp-1 block text-[12px] font-medium">{v.title}</span>
                            <span className="block text-[10.5px] text-[var(--text-mute)]">{v.channelName}</span>
                          </span>
                        </Link>
                      );
                    })
                  ) : (
                    <EmptyState title="Queue is empty" description="Use 'Play next' on any video." />
                  )}
                </div>
              )}
            </div>

            {/* sponsor + engine info */}
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 text-[11.5px] text-[var(--text-mute)]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Heart className="h-3 w-3 text-[var(--accent)]" /> SponsorBlock
                </span>
                <span>{settings.sponsorBlock ? "on" : "off"}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Flag className="h-3 w-3" /> DeArrow titles
                </span>
                <span>{settings.dearrow ? "on" : "off"}</span>
              </div>
            </div>
          </aside>
        )}
      </div>

      <DownloadSheet
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        video={video}
      />
    </div>
  );
}
