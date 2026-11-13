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
import { useSettings, ACCENTS, SPEEDS, defaultSettings } from "@/store/settings";
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
      <SettingsSection title="Theme" description="OLED true-black default hai — battery aur eyes dono ke liye." icon={<Palette className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2 py-3.5 sm:grid-cols-4">
          {(
            [
              { id: "oled", name: "OLED Black", bg: "#000000", fg: "#f6f6f8" },
              { id: "graphite", name: "Graphite", bg: "#121214", fg: "#f6f6f8" },
              { id: "sepia", name: "Sepia", bg: "#f6f0e4", fg: "#2a2118" },
              { id: "light", name: "Light", bg: "#fbfbfd", fg: "#16161b" },
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

        <Row label="Accent colour" description="Buttons, progress bars aur highlights.">
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

        <Row label="Card density" description="Kitne videos ek screen pe dikhein.">
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
          description="Animations kam karo (accessibility)."
        />
        <Switch
          checked={s.showOriginalTitles}
          onChange={(v) => s.set("showOriginalTitles", v)}
          label="Original clickbait titles dikhao"
          description="DeArrow clean titles ke bajaye YouTube ka original title."
        />
      </SettingsSection>

      <SettingsSection title="Home tabs" description="Apne hisaab se home screen banao.">
        <div className="space-y-1.5 py-3">
          {s.homeTabs.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg bg-[var(--bg-elev-2)] px-2.5 py-1.5">
              <span className="flex-1 text-[12.5px]">{t.label}</span>
              <Badge>{t.kind}</Badge>
              <button
                onClick={() => s.set("homeTabs", s.homeTabs.filter((x) => x.id !== t.id))}
                className="text-[11px] text-[var(--text-mute)] hover:text-rose-400"
              >
                remove
              </button>
            </div>
          ))}
          <AddTabForm />
        </div>
      </SettingsSection>
    </>
  );
}

function AddTabForm() {
  const tabs = useSettings((s) => s.homeTabs);
  const set = useSettings((s) => s.set);
  const [name, setName] = useState("");
  return (
    <div className="flex gap-2 pt-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New tab name"
        className="h-8 text-[12.5px]"
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (!name.trim()) return;
          set("homeTabs", [
            ...tabs,
            { id: `t_${Date.now()}`, label: name.trim(), kind: "feed" },
          ]);
          setName("");
        }}
      >
        Add
      </Button>
    </div>
  );
}

/* ── Playback ──────────────────────────────────────────────── */
function PlaybackSettings() {
  const s = useSettings();
  return (
    <>
      <SettingsSection
        title="Engine"
        description="Auto best hai — extract fail ho to agla engine khud try hota hai."
        icon={<MonitorPlay className="h-4 w-4" />}
      >
        <Row label="Playback engine" description="Means everything: ads, background audio, download.">
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
        <Row label="Default quality">
          <Select
            value={s.defaultQuality}
            onChange={(v) => s.set("defaultQuality", v)}
            options={[
              { value: "auto", label: "Auto (adaptive)" },
              { value: "1080p", label: "1080p" },
              { value: "720p", label: "720p" },
              { value: "480p", label: "480p (data saver)" },
            ]}
            className="w-44"
          />
        </Row>
        <Row label="Default speed" description="Per-channel speed yaad rakhne ke liye bhi on karo.">
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
          label="Per-channel speed yaad rakho"
          description="Tech channels 1.5×, music 1× — automatic."
        />
        <Switch checked={s.resumePlayback} onChange={(v) => s.set("resumePlayback", v)} label="Resume from where I left" />
        <Switch checked={s.autoplayNext} onChange={(v) => s.set("autoplayNext", v)} label="Autoplay next" description="Focus mode me ye hamesha off rehta hai." />
        <Row label="Seek step" description="Arrow keys se kitna sekand aage-peeche.">
          <Select
            value={String(s.seekStepSec)}
            onChange={(v) => s.set("seekStepSec", Number(v))}
            options={[5, 10, 15, 30].map((n) => ({ value: String(n), label: `${n}s` }))}
            className="w-24"
          />
        </Row>
      </SettingsSection>

      <SettingsSection title="SponsorBlock" description="Community segments — intro, sponsor, outro sab skip." icon={<Sparkles className="h-4 w-4" />}>
        <Switch checked={s.sponsorBlock} onChange={(v) => s.set("sponsorBlock", v)} label="SponsorBlock on" />
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
          label="Skip ke bajaye mute"
          description="Music videos ke liye better — gaana cut nahi hota."
        />
      </SettingsSection>

      <SettingsSection title="Community metadata" icon={<ThumbsDown className="h-4 w-4" />}>
        <Switch
          checked={s.dearrow}
          onChange={(v) => s.set("dearrow", v)}
          label="DeArrow titles & thumbnails"
          description="Clickbait badal ke clean title + representative thumbnail."
        />
        <Switch
          checked={s.returnYoutubeDislike}
          onChange={(v) => s.set("returnYoutubeDislike", v)}
          label="Return YouTube Dislike"
          description="Community API se dislike count (attribution shown)."
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
        description="Ek switch: recommendations off, comments off, autoplay off, sirf aapke subscriptions."
        icon={<Focus className="h-4 w-4" />}
      >
        <Switch
          checked={s.focusMode}
          onChange={(v) => s.set("focusMode", v)}
          label="Focus mode (⌘/)"
          description="Home sirf aapke subscriptions dikhata hai. Up-next band."
        />
        <Switch checked={s.hideRecommendations} onChange={(v) => s.set("hideRecommendations", v)} label="Recommendations hide karo" description="Home + watch page ke recommended videos." />
        <Switch checked={s.hideComments} onChange={(v) => s.set("hideComments", v)} label="Comments hide karo" />
        <Switch checked={s.hideShorts} onChange={(v) => s.set("hideShorts", v)} label="Shorts hide karo" description="Koi vertical Shorts feed nahi." />
        <Switch checked={s.hideEndScreen} onChange={(v) => s.set("hideEndScreen", v)} label="End screen / cards hide karo" />
        <Switch checked={s.hideLiveChat} onChange={(v) => s.set("hideLiveChat", v)} label="Live chat hide karo" />
        <Switch
          checked={s.autoPlayDisabledInFocus}
          onChange={(v) => s.set("autoPlayDisabledInFocus", v)}
          label="Focus mode me autoplay off"
        />
      </SettingsSection>

      <SettingsSection title="Daily watch limit" description="Local only budget — app khud pause kar dega.">
        <Row label="Daily limit" description="0 = koi limit nahi.">
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

      <SettingsSection title="Blocklist" description="Feed se permanently hatao.">
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
        description="Path, folder structure aur gallery visibility."
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
          label="Channel ke hisaab se folders"
          description="~/Videos/LocalTube/CodeWithHarry/video.mp4"
        />
        <Switch
          checked={s.showDownloadsInGallery}
          onChange={(v) => s.set("showDownloadsInGallery", v)}
          label="Gallery me dikhao"
          description="ON = phone gallery / Photos me file dikhegi. OFF = sirf app ke andar private."
        />
        <Switch
          checked={s.embedThumbnail}
          onChange={(v) => s.set("embedThumbnail", v)}
          label="Thumbnail embed karo"
          description="Gallery/Plex me poster dikhega, black box nahi."
        />
        <Switch checked={s.embedChapters} onChange={(v) => s.set("embedChapters", v)} label="Chapters embed karo" />
        <Switch checked={s.embedSubs} onChange={(v) => s.set("embedSubs", v)} label="Subtitles download karo" />
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
        <Switch checked={s.sponsorCutOnDownload} onChange={(v) => s.set("sponsorCutOnDownload", v)} label="Sponsor segments file se kaat do" description="ffmpeg se physically cut — file hi clean aayegi." />
        <Switch checked={s.wifiOnlyDownloads} onChange={(v) => s.set("wifiOnlyDownloads", v)} label="Sirf Wi-Fi pe download" />
      </SettingsSection>

      <SettingsSection title="Auto & storage" icon={<ImageIcon className="h-4 w-4" />}>
        <Switch
          checked={s.autoDownloadNewVideos}
          onChange={(v) => s.set("autoDownloadNewVideos", v)}
          label="Naye videos auto-download"
          description="Subscriptions ke naye videos offline ke liye (travel mode)."
        />
        <Row label="Auto-download preset">
          <Select value={s.autoDownloadPreset} onChange={(v) => s.set("autoDownloadPreset", v as DownloadPreset)} options={PRESETS} className="w-52" />
        </Row>
        <Row label="Storage cap" description={`Abhi ${formatBytes(used)} use hua hai.`}>
          <Select
            value={String(s.maxStorageGb)}
            onChange={(v) => s.set("maxStorageGb", Number(v))}
            options={[5, 10, 25, 50, 100, 250].map((n) => ({ value: String(n), label: `${n} GB` }))}
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
    <SettingsSection title="Extractor health" description="YouTube todta hai — yahan se yt-dlp update karo.">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
        <div className="text-[12.5px] text-[var(--text-dim)]">
          {status ? (
            <>
              yt-dlp {status.version} ·{" "}
              {status.updatedAt ? new Date(status.updatedAt).toLocaleDateString() : "never updated"}
              {!status.available && <span className="ml-2 text-amber-400">(desktop build me active)</span>}
            </>
          ) : (
            "Status check karo"
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
      <SettingsSection title="Google account" description="Optional — subscriptions, playlists aur likes sync ke liye." icon={<User className="h-4 w-4" />}>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div>
            <p className="text-[13px] font-medium">
              {s.googleConnected ? s.googleEmail : "Not connected"}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--text-mute)]">
              {s.googleConnected
                ? "Subscriptions + playlists + likes sync active."
                : "Guest mode chal raha hai — sab kuch local hai. Login optional hai."}
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
                s.patch({
                  googleConnected: true,
                  googleEmail: r?.email ?? "you@gmail.com",
                });
                setBusy(false);
              }}
            >
              Sign in with Google
            </Button>
          )}
        </div>
        <Switch
          checked={s.syncEnabled}
          onChange={(v) => s.set("syncEnabled", v)}
          label="Encrypted cross-device sync"
          description="Progress, notes, subscriptions — apne hi cloud folder me (zero backend)."
        />
        <Row label="Sync folder" description="Google Drive / Dropbox / OneDrive ka local folder bhi chalega.">
          <Input
            value={s.syncFolder}
            onChange={(e) => s.set("syncFolder", e.target.value)}
            className="w-64 font-mono text-[12px]"
          />
        </Row>
      </SettingsSection>

      <SettingsSection
        title="API keys (optional)"
        description="Khali chhod do to app phir bhi chalta hai — bas YouTube search quota-limited rahega."
      >
        <Row label="YouTube Data API key" description="Search + duration metadata. Google Cloud se free milta hai.">
          <Input
            value={s.dataApiKey}
            onChange={(e) => s.set("dataApiKey", e.target.value)}
            placeholder="AIza…"
            className="w-64 font-mono text-[12px]"
          />
        </Row>
        <Row label="OAuth client ID" description="Google login ke liye (subscriptions/likes sync).">
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
            "Koi telemetry nahi. Koi analytics nahi.",
            "History, notes, downloads — sab aapki machine pe SQLite me.",
            "Google login sirf tab use hota hai jab aap connect karo.",
            "SponsorBlock requests hash-prefix se jati hain (poora video ID nahi).",
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
      <SettingsSection title="Backup" description="Sab kuch ek file me — portable, plain JSON." icon={<HardDrive className="h-4 w-4" />}>
        <Row label="Export everything" description="Settings + subscriptions + notes + history + playlists.">
          <Button size="sm" variant="primary" onClick={exportAll}>
            Export .json
          </Button>
        </Row>
        <Row label="Import from Google Takeout" description="watch-history.json — purani history wapas.">
          <Button size="sm" variant="secondary">
            Choose file
          </Button>
        </Row>
        <Row label="Import subscriptions (CSV/OPML)">
          <Button size="sm" variant="secondary">
            Choose file
          </Button>
        </Row>
        <Switch checked={s.backupOnQuit} onChange={(v) => s.set("backupOnQuit", v)} label="Quit pe auto-backup" />
      </SettingsSection>

      <SettingsSection title="Reset" description="Soch samajh ke — local data chala jayega.">
        <Row label="Reset all settings">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm("Sab settings default ho jayengi. Continue?")) s.reset();
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
  return (
    <SettingsSection title="LocalTube" description="Personal, local-first YouTube client." icon={<Info className="h-4 w-4" />}>
      <div className="space-y-2 py-3.5 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
        <p>
          <span className="font-medium text-[var(--text)]">v0.1.0</span> · Tauri v2 + Rust + React 19
        </p>
        <p>
          Playback engine: yt-dlp / InnerTube (auto-fallback). Metadata: RSS + YouTube Data API.
          Enrichment: SponsorBlock, DeArrow, Return YouTube Dislike.
        </p>
        <p className="text-[var(--text-mute)]">
          Ye app personal use ke liye hai. Downloaded content sirf aapke offline dekhne ke liye —
          YouTube ke Terms of Service ka respect karna aapki zimmedari hai.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["SponsorBlock", "DeArrow", "Return YouTube Dislike", "yt-dlp", "Tauri", "React"].map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
