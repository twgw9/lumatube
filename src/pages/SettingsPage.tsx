import { isAndroidNative } from "@/lib/android";
import { FeedPreferences } from "@/components/FeedPreferences";
import { ProjectInfo } from "@/components/ProjectInfo";
import { enableDownloadNotifications } from "@/lib/notifications";
import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  Bell,
  Check,
  Download,
  Focus,
  Gauge,
  HardDrive,
  Image as ImageIcon,
  Info,
  LogOut,
  MonitorPlay,
  Palette,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsDown,
  User,
  Wifi,
} from "lucide-react";
import { useSettings, ACCENTS, SPEEDS, QUALITY_OPTIONS } from "@/store/settings";
import { useLibrary } from "@/store/library";
import {
  Badge,
  Button,
  Input,
  Row,
  Segmented,
  Select,
  SettingsSection,
  Switch,
} from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";
import { googleSignIn, googleSignOut, getExtractorStatus, updateExtractor } from "@/lib/bridge";
import type { DownloadPreset } from "@/lib/types";

const SECTIONS = [
  { to: "/settings", label: "Appearance", icon: Palette, end: true },
  { to: "/settings/feed", label: "Feed & interests", icon: Sparkles },
  { to: "/settings/playback", label: "Playback", icon: MonitorPlay },
  { to: "/settings/focus", label: "Focus & anti-algorithm", icon: Focus },
  { to: "/settings/downloads", label: "Downloads", icon: Download },
  { to: "/settings/account", label: "Account", icon: User },
  { to: "/settings/data", label: "Data & backup", icon: HardDrive },
  { to: "/settings/about", label: "About", icon: Info },
];

export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 pb-20 pt-4 sm:px-6">
      <nav className="sticky top-[68px] hidden h-fit w-52 shrink-0 lg:block">
        <h1 className="mb-3 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-mute)]">
          Settings
        </h1>
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s.to}>
              <NavLink
                to={s.to}
                end={s.end}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-[var(--bg-elev-2)] text-[var(--text)]"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-elev)] hover:text-[var(--text)]",
                  )
                }
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        <MobileSettingsNav />
        <Routes>
          <Route index element={<AppearanceSettings />} />
          <Route path="feed" element={<FeedPreferences />} />
          <Route path="playback" element={<PlaybackSettings />} />
          <Route path="focus" element={<FocusSettings />} />
          <Route path="downloads" element={<DownloadSettings />} />
          <Route path="account" element={<AccountSettings />} />
          <Route path="data" element={<DataSettings />} />
          <Route path="about" element={<AboutSettings />} />
        </Routes>
      </div>
    </div>
  );
}

function MobileSettingsNav() {
  return (
    <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden [&::-webkit-scrollbar]:hidden">
      {SECTIONS.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end={s.end}
          className={({ isActive }) =>
            cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium",
              isActive
                ? "border-transparent bg-[var(--text)] text-[var(--bg)]"
                : "border-[var(--border)] text-[var(--text-dim)]",
            )
          }
        >
          <s.icon className="h-3.5 w-3.5" />
          {s.label}
        </NavLink>
      ))}
    </div>
  );
}

/* ── Appearance ────────────────────────────────────────────── */
function AppearanceSettings() {
  const s = useSettings();
  return (
    <>
      <SettingsSection title="Theme" description="OLED true-black is the default — kinder on battery and eyes." icon={<Palette className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2 py-3.5 sm:grid-cols-4">
          {(
            [
              { id: "oled", name: "OLED Black", bg: "#000000", fg: "#f6f6f8" },
              { id: "graphite", name: "Graphite", bg: "#121214", fg: "#f6f6f8" },
              { id: "sepia", name: "Sepia", bg: "#f6f0e4", fg: "#2a2118" },
              { id: "light", name: "Light", bg: "#fbfbfd", fg: "#16161b" },
              { id: "midnight", name: "Midnight", bg: "#0a1020", fg: "#c7d2fe" },
              { id: "forest", name: "Forest", bg: "#081812", fg: "#bbf7d0" },
              { id: "plum", name: "Plum", bg: "#180d20", fg: "#f5d0fe" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => s.set("theme", t.id)}
              className={cn(
                "relative overflow-hidden rounded-xl border-2 p-2 text-left transition",
                s.theme === t.id ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--text-mute)]",
              )}
            >
              <div className="h-12 rounded-lg" style={{ background: t.bg }}>
                <div className="p-1.5">
                  <div className="h-1.5 w-8 rounded" style={{ background: t.fg, opacity: 0.85 }} />
                  <div className="mt-1 h-1 w-12 rounded" style={{ background: t.fg, opacity: 0.35 }} />
                </div>
              </div>
              <span className="mt-1.5 block text-[11.5px] font-medium">{t.name}</span>
              {s.theme === t.id && (
                <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full bg-[var(--accent)] p-0.5 text-black" />
              )}
            </button>
          ))}
        </div>

        <Row label="Accent colour" description="Buttons, progress bars and highlights.">
          <div className="flex gap-1.5">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => s.set("accent", a.value)}
                className={cn(
                  "h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-[var(--bg-elev)] transition",
                  s.accent === a.value ? "ring-[var(--text)]" : "ring-transparent hover:ring-[var(--border)]",
                )}
                style={{ background: a.value }}
                title={a.name}
                aria-label={a.name}
              />
            ))}
          </div>
        </Row>

        <Row label="Card density" description="How many videos fit on screen.">
          <Segmented
            value={s.density}
            onChange={(v) => s.set("density", v)}
            options={[
              { value: "comfortable", label: "Comfort" },
              { value: "compact", label: "Compact" },
              { value: "grid", label: "Grid" },
            ]}
            size="sm"
          />
        </Row>

        <Switch
          checked={s.motion === "reduced"}
          onChange={(v) => s.set("motion", v ? "reduced" : "full")}
          label="Reduce motion"
          description="Reduce animations (accessibility)."
        />
        <Switch
          checked={s.showOriginalTitles}
          onChange={(v) => s.set("showOriginalTitles", v)}
          label="Show original clickbait titles"
          description="Use the original YouTube title instead of DeArrow's cleaned version."
        />
      </SettingsSection>

      <SettingsSection title="Workspace" description="Keep only the tools you use.">
        <Switch checked={s.recordHistory} onChange={(v) => s.set("recordHistory", v)} label="Save watch history" description="Pause history without deleting existing entries." />
        <Switch checked={s.showContinueWatching} onChange={(v) => s.set("showContinueWatching", v)} label="Continue watching on Home" />
        <Row label="Welcome tour"><Button size="sm" onClick={() => s.set("onboardingDone", false)}>Replay tutorial</Button></Row>
        <Switch checked={s.showNotes} onChange={(v) => s.set("showNotes", v)} label="Show notes section" description="Hide notes from navigation and the video panel without deleting any saved notes." />
      </SettingsSection>

    </>
  );
}

/* ── Playback ──────────────────────────────────────────────── */
function PlaybackSettings() {
  const s = useSettings();
  return (
    <>
      <SettingsSection
        title="Engine"
        description="Auto is best — if one extractor fails the next is tried automatically."
        icon={<MonitorPlay className="h-4 w-4" />}
      >
        <Row label="Playback engine" description="Controls ads, background audio and downloads.">
          <Select
            value={s.engine}
            onChange={(v) => s.set("engine", v)}
            options={[
              { value: "auto", label: "Auto (recommended)" },
              { value: "ytdlp", label: "yt-dlp (most reliable)" },
              { value: "innertube", label: "InnerTube / youtubei.js (fast)" },
              { value: "official", label: "Official embed (no ads block)" },
            ]}
            className="w-56"
          />
        </Row>
        <Row label="Preferred quality" description="Up to 8K — depends on what the uploader provides.">
          <Select
            value={s.defaultQuality}
            onChange={(v) => s.set("defaultQuality", v)}
            options={QUALITY_OPTIONS.map((q) => ({ value: q.value, label: q.label }))}
            className="w-52"
          />
        </Row>
        <Switch
          checked={s.premiumStreaming}
          onChange={(v) => s.set("premiumStreaming", v)}
          label="Premium streaming (highest available)"
          description="Requests the highest playable combined audio/video format. Separate adaptive 4K/8K video + audio playback is not implemented yet. Downloads can merge them with ffmpeg."
        />
        <Switch
          checked={s.preferHighestFps}
          onChange={(v) => s.set("preferHighestFps", v)}
          label="Prefer highest frame rate"
          description="60 fps / HDR variants win over lower-fps streams at the same resolution."
        />
        <Switch
          checked={s.preloadNext}
          onChange={(v) => s.set("preloadNext", v)}
          label="Preload the next video"
          description="Resolves the queued video ahead of time so playback starts instantly."
        />
        <Switch
          checked={s.ambientMode}
          onChange={(v) => s.set("ambientMode", v)}
          label="Ambient glow"
          description="A blurred halo of the thumbnail behind the player (like YouTube's ambient mode)."
        />
        <Switch
          checked={s.showStats}
          onChange={(v) => s.set("showStats", v)}
          label="Show stats panel by default"
          description="Engine, quality, buffer, dropped frames, bitrate."
        />
        <Row label="Default speed" description="Turn on to also remember speed per channel.">
          <Select
            value={String(s.defaultSpeed)}
            onChange={(v) => s.set("defaultSpeed", Number(v))}
            options={SPEEDS.map((v) => ({ value: String(v), label: `${v}×` }))}
            className="w-28"
          />
        </Row>
        <Switch
          checked={s.rememberSpeedPerChannel}
          onChange={(v) => s.set("rememberSpeedPerChannel", v)}
          label="Remember speed per channel"
          description="Tech channels 1.5×, music 1× — automatic."
        />
        <Switch checked={s.resumePlayback} onChange={(v) => s.set("resumePlayback", v)} label="Resume from where I left" />
        <Switch checked={s.autoplayNext} onChange={(v) => s.set("autoplayNext", v)} label="Autoplay next" description="Always off in focus mode." />
        <Row label="Seek step" description="How far arrow keys jump.">
          <Select
            value={String(s.seekStepSec)}
            onChange={(v) => s.set("seekStepSec", Number(v))}
            options={[5, 10, 15, 30].map((n) => ({ value: String(n), label: `${n}s` }))}
            className="w-24"
          />
        </Row>
      </SettingsSection>

      <SettingsSection title="SponsorBlock" description="Community segments — intro, sponsor and outro all skipped." icon={<Sparkles className="h-4 w-4" />}>
        <Switch checked={s.sponsorBlock} onChange={(v) => s.set("sponsorBlock", v)} label="SponsorBlock" />
        <div className="grid grid-cols-2 gap-1.5 py-3">
          {["sponsor", "selfpromo", "interaction", "intro", "outro", "preview", "filler", "music_offtopic"].map((cat) => {
            const on = s.sponsorCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() =>
                  s.set(
                    "sponsorCategories",
                    on ? s.sponsorCategories.filter((c) => c !== cat) : [...s.sponsorCategories, cat],
                  )
                }
                className={cn(
                  "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors",
                  on
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-mute)] hover:bg-[var(--bg-elev-2)]",
                )}
              >
                {cat}
                {on && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
        <Switch
          checked={s.sponsorMuteInsteadOfSkip}
          onChange={(v) => s.set("sponsorMuteInsteadOfSkip", v)}
          label="Mute instead of skip"
          description="Better for music videos — the song never gets cut."
        />
      </SettingsSection>

      <SettingsSection title="Community metadata" icon={<ThumbsDown className="h-4 w-4" />}>
        <Switch
          checked={s.dearrow}
          onChange={(v) => s.set("dearrow", v)}
          label="DeArrow titles & thumbnails"
          description="Swaps clickbait for a clean title + representative thumbnail."
        />
        <Switch
          checked={s.returnYoutubeDislike}
          onChange={(v) => s.set("returnYoutubeDislike", v)}
          label="Return YouTube Dislike"
          description="Dislike counts from the community API (attribution shown)."
        />
      </SettingsSection>
    </>
  );
}

/* ── Focus ─────────────────────────────────────────────────── */
function FocusSettings() {
  const s = useSettings();
  const [kw, setKw] = useState("");
  const [ch, setCh] = useState("");

  return (
    <>
      <SettingsSection
        title="Focus mode"
        description="One switch: recommendations off, comments off, autoplay off, subscriptions only."
        icon={<Focus className="h-4 w-4" />}
      >
        <Switch
          checked={s.focusMode}
          onChange={(v) => s.set("focusMode", v)}
          label="Focus mode (⌘/)"
          description="Home shows only your subscriptions. Up-next disabled."
        />
        <Switch checked={s.hideRecommendations} onChange={(v) => s.set("hideRecommendations", v)} label="Hide recommendations" description="Recommended videos on Home and the watch page." />
        <Switch checked={s.hideComments} onChange={(v) => s.set("hideComments", v)} label="Hide comments" />
        <Switch checked={s.hideShorts} onChange={(v) => s.set("hideShorts", v)} label="Hide Shorts" description="No vertical Shorts feed at all." />
        <Switch checked={s.hideEndScreen} onChange={(v) => s.set("hideEndScreen", v)} label="Hide end screens / cards" />
        <Switch checked={s.hideLiveChat} onChange={(v) => s.set("hideLiveChat", v)} label="Hide live chat" />
        <Switch
          checked={s.autoPlayDisabledInFocus}
          onChange={(v) => s.set("autoPlayDisabledInFocus", v)}
          label="Disable autoplay in focus mode"
        />
      </SettingsSection>

      <SettingsSection title="Daily watch limit" description="Local-only budget — the app pauses itself.">
        <Row label="Daily limit" description="0 = no limit.">
          <Select
            value={String(s.dailyWatchLimitMin)}
            onChange={(v) => s.set("dailyWatchLimitMin", Number(v))}
            options={[0, 15, 30, 45, 60, 90, 120].map((n) => ({
              value: String(n),
              label: n === 0 ? "Off" : `${n} min`,
            }))}
            className="w-28"
          />
        </Row>
      </SettingsSection>

      <SettingsSection title="Blocklist" description="Remove things from your feed permanently.">
        <div className="py-3">
          <p className="mb-1.5 text-[12px] font-medium text-[var(--text-dim)]">Keywords</p>
          <div className="flex gap-2">
            <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="reaction, spoiler, #shorts" className="h-8 text-[12.5px]" />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!kw.trim()) return;
                s.set("keywordBlocklist", [...s.keywordBlocklist, kw.trim()]);
                setKw("");
              }}
            >
              Add
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.keywordBlocklist.map((k) => (
              <button
                key={k}
                onClick={() => s.set("keywordBlocklist", s.keywordBlocklist.filter((x) => x !== k))}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11.5px] text-[var(--text-dim)] hover:border-rose-400/40 hover:text-rose-300"
              >
                {k} ×
              </button>
            ))}
          </div>

          <p className="mb-1.5 mt-4 text-[12px] font-medium text-[var(--text-dim)]">Channel IDs</p>
          <div className="flex gap-2">
            <Input value={ch} onChange={(e) => setCh(e.target.value)} placeholder="UCxxxx" className="h-8 text-[12.5px]" />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!ch.trim()) return;
                s.set("channelBlocklist", [...s.channelBlocklist, ch.trim()]);
                setCh("");
              }}
            >
              Add
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.channelBlocklist.map((c) => (
              <button
                key={c}
                onClick={() => s.set("channelBlocklist", s.channelBlocklist.filter((x) => x !== c))}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-dim)] hover:text-rose-300"
              >
                {c} ×
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>
    </>
  );
}

/* ── Downloads ─────────────────────────────────────────────── */
const PRESETS: { value: DownloadPreset; label: string }[] = [
  { value: "best", label: "Best available · up to 8K" },
  { value: "8k", label: "8K (4320p) · MKV" },
  { value: "1440p", label: "1440p · QHD" },
  { value: "360p", label: "360p · smallest video" },
  { value: "1080p", label: "1080p MP4" },
  { value: "4k", label: "4K (2160p)" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p (data saver)" },
  { value: "audio-m4a", label: "Audio · M4A" },
  { value: "audio-mp3", label: "Audio · MP3 320" },
  { value: "sponsor-free", label: "Sponsor-free copy" },
  { value: "subs-only", label: "Subtitles only" },
];

function DownloadSettings() {
  const s = useSettings();
  const downloads = useLibrary((st) => st.downloads);
  const used = downloads.reduce((a, d) => a + (d.bytesTotal ?? 0), 0);

  return (
    <>
      <SettingsSection
        title="Where files go"
        description="Path, folder structure and gallery visibility."
        icon={<HardDrive className="h-4 w-4" />}
      >
        <Row label="Download folder">
          <Input
            value={s.downloadFolder}
            onChange={(e) => s.set("downloadFolder", e.target.value)}
            className="w-64 font-mono text-[12px]"
          />
        </Row>
        <Switch
          checked={s.downloadSubfoldersByChannel}
          onChange={(v) => s.set("downloadSubfoldersByChannel", v)}
          label="Subfolder per channel"
          description="~/Videos/LumaTube/CodeWithHarry/video.mp4"
        />
        <Switch
          checked={s.showDownloadsInGallery}
          onChange={(v) => s.set("showDownloadsInGallery", v)}
          label="Show in gallery"
          description="ON = the file appears in your phone gallery / Photos. OFF = private to the app."
        />
        <Switch
          checked={s.embedThumbnail}
          onChange={(v) => s.set("embedThumbnail", v)}
          label="Embed thumbnail"
          description="Shows a poster in your gallery/Plex instead of a black box."
        />
        <Switch checked={s.embedChapters} onChange={(v) => s.set("embedChapters", v)} label="Embed chapters" />
        <Switch checked={s.embedSubs} onChange={(v) => s.set("embedSubs", v)} label="Download subtitles" />
      </SettingsSection>

      <SettingsSection title="Quality & queue" icon={<Download className="h-4 w-4" />}>
        <Row label="Default preset">
          <Select value={s.downloadPreset} onChange={(v) => s.set("downloadPreset", v as DownloadPreset)} options={PRESETS} className="w-52" />
        </Row>
        <Row label="Parallel downloads">
          <Select
            value={String(s.downloadConcurrency)}
            onChange={(v) => s.set("downloadConcurrency", Number(v))}
            options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
            className="w-20"
          />
        </Row>
        <Switch checked={s.sponsorCutOnDownload} onChange={(v) => s.set("sponsorCutOnDownload", v)} label="Cut sponsor segments from the file" description="Physically cut with ffmpeg — the file itself is clean." />
        <Switch checked={s.wifiOnlyDownloads} onChange={(v) => s.set("wifiOnlyDownloads", v)} label="Download on Wi-Fi only" />
      </SettingsSection>

      <SettingsSection title="Download notifications">
        <Switch checked={s.downloadNotifications} onChange={async (v) => { s.set("downloadNotifications", v && await enableDownloadNotifications()); }} label={isAndroidNative() ? "Notify when system download completes" : "Show download progress in notifications"} description={isAndroidNative() ? "Android DownloadManager always handles ongoing download notifications. This controls the completion notification for new downloads." : "Permission required. Shows progress and estimated time while the desktop app is running."} />
      </SettingsSection>
      <SettingsSection title="Auto & storage" icon={<ImageIcon className="h-4 w-4" />}>
        <Switch
          checked={s.autoDownloadNewVideos}
          onChange={(v) => s.set("autoDownloadNewVideos", v)}
          label="Auto-download new videos"
          description="Off by default. Enable only when you want new uploads downloaded automatically."
        />
        {s.autoDownloadNewVideos && <Row label="Auto-download preset">
          <Select value={s.autoDownloadPreset} onChange={(v) => s.set("autoDownloadPreset", v as DownloadPreset)} options={PRESETS} className="w-52" />
        </Row>}
        <Row label="Storage cap" description={`Currently ${formatBytes(used)} used.`}>
          <Select
            value={String(s.maxStorageGb)}
            onChange={(v) => s.set("maxStorageGb", Number(v))}
            options={[1, 2, 5, 10, 25, 50, 100, 250].map((n) => ({ value: String(n), label: `${n} GB` }))}
            className="w-24"
          />
        </Row>
      </SettingsSection>

      <ExtractorCard />
    </>
  );
}

function ExtractorCard() {
  const [status, setStatus] = useState<{ version: string; updatedAt: number; available: boolean } | null>(null);
  const [updating, setUpdating] = useState(false);

  const check = async () => setStatus(await getExtractorStatus());

  return (
    <SettingsSection title="Extractor health" description="YouTube breaks things — update yt-dlp from here.">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
        <div className="text-[12.5px] text-[var(--text-dim)]">
          {status ? (
            <>
              yt-dlp {status.version} ·{" "}
              {status.updatedAt ? new Date(status.updatedAt).toLocaleDateString() : "never updated"}
              {!status.available && <span className="ml-2 text-amber-400">(active in the desktop build)</span>}
            </>
          ) : (
            "Check status"
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={check}>
            Check
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={updating}
            onClick={async () => {
              setUpdating(true);
              const r = await updateExtractor();
              if (r) setStatus({ ...r, available: true });
              setUpdating(false);
            }}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", updating && "animate-spin")} /> Update
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}

/* ── Account ───────────────────────────────────────────────── */
function AccountSettings() {
  const s = useSettings();
  const [busy, setBusy] = useState(false);

  return (
    <>
      <SettingsSection title="Google account" description="Not implemented yet. Guest mode works without an account." icon={<User className="h-4 w-4" />}>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div>
            <p className="text-[13px] font-medium">
              {s.googleConnected ? s.googleEmail : "Not connected"}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--text-mute)]">
              {s.googleConnected
                ? "Subscriptions + playlists + likes are syncing."
                : "Guest mode — everything stays local. Sign-in is optional."}
            </p>
          </div>
          {s.googleConnected ? (
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                await googleSignOut();
                s.patch({ googleConnected: false, googleEmail: null });
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await googleSignIn();
                if (r?.email) s.patch({ googleConnected: true, googleEmail: r.email });
                else window.alert("Google sign-in is not implemented in this build. Guest mode remains available; no account has been connected.");
                setBusy(false);
              }}
            >
              Sign in with Google
            </Button>
          )}
        </div>
        <Switch
          checked={false}
          disabled
          onChange={() => undefined}
          label="Encrypted cross-device sync (not available yet)"
          description="Not implemented in this build. Export a local JSON backup instead."
        />
        <Row label="Sync folder" description="A local Google Drive / Dropbox / OneDrive folder works too.">
          <Input
            value={s.syncFolder}
            onChange={(e) => s.set("syncFolder", e.target.value)}
            className="w-64 font-mono text-[12px]"
          />
        </Row>
      </SettingsSection>

      <SettingsSection
        title="API keys (optional)"
        description="Browser popular/search/subscription feeds require a valid Data API key. Native RSS subscriptions need no key. This is not your personalised YouTube Home feed."
      >
        <Row label="YouTube Data API key" description="Enable YouTube Data API v3 in Google Cloud. Needed for browser public feeds/search; quota and key restrictions apply. Stored locally, not a Google login.">
          <Input
            type="password"
            autoComplete="off"
            value={s.dataApiKey}
            onChange={(e) => s.set("dataApiKey", e.target.value)}
            placeholder="AIza…"
            className="w-64 font-mono text-[12px]"
          />
        </Row>
        <Row label="OAuth client ID" description="For Google sign-in (subscriptions/likes sync).">
          <Input
            value={s.oauthClientId}
            onChange={(e) => s.set("oauthClientId", e.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
            className="w-72 font-mono text-[12px]"
          />
        </Row>
      </SettingsSection>

      <SettingsSection title="Privacy" icon={<Shield className="h-4 w-4" />}>
        <div className="space-y-1.5 py-3.5 text-[12.5px] text-[var(--text-dim)]">
          {[
            "No telemetry. No analytics.",
            "History, notes and downloads live in SQLite on your machine.",
            "Google login is only used when you connect it.",
            "SponsorBlock requests use a hash prefix (never the full video ID).",
          ].map((t) => (
            <p key={t} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {t}
            </p>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}

/* ── Data ──────────────────────────────────────────────────── */
function DataSettings() {
  const s = useSettings();
  const lib = useLibrary();

  const exportAll = () => {
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      settings: useSettings.getState(),
      library: {
        channels: lib.channels,
        folders: lib.folders,
        notes: lib.notes,
        clips: lib.clips,
        playlists: lib.playlists,
        progress: lib.progress,
        history: lib.history,
        liked: lib.liked,
        watchLater: lib.watchLater,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `localtube-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <SettingsSection title="Backup" description="Everything in one portable, plain-JSON file." icon={<HardDrive className="h-4 w-4" />}>
        <Row label="Export everything" description="Settings + subscriptions + notes + history + playlists.">
          <Button size="sm" variant="primary" onClick={exportAll}>
            Export .json
          </Button>
        </Row>
        <Row label="Import from Google Takeout" description="watch-history.json — bring your old history back.">
          <Button size="sm" variant="secondary">
            Choose file
          </Button>
        </Row>
        <Row label="Import subscriptions (CSV/OPML)">
          <Button size="sm" variant="secondary">
            Choose file
          </Button>
        </Row>
        <Switch checked={s.backupOnQuit} onChange={(v) => s.set("backupOnQuit", v)} label="Auto-backup on quit" />
      </SettingsSection>

      <SettingsSection title="Reset" description="Careful — local data will be wiped.">
        <Row label="Reset all settings">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm("All settings will return to defaults. Continue?")) s.reset();
            }}
          >
            Reset
          </Button>
        </Row>
        <Row label="Clear history">
          <Button size="sm" variant="danger" onClick={() => lib.clearHistory()}>
            Clear
          </Button>
        </Row>
      </SettingsSection>
    </>
  );
}

/* ── About ─────────────────────────────────────────────────── */
function AboutSettings() {
  return <ProjectInfo />;
}
