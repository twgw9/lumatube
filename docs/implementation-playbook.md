# LocalTube — Implementation Playbook
### Tauri v2 + Rust + React/TS · Local-first · SQLite · Native Player (yt-dlp/InnerTube)

> Ye document blueprint ka **technical companion** hai. Yahan wahi cheezein hain jo code likhte waqt chahiye: folder structure, SQLite schema (copy-paste ready), **MediaResolver (extraction layer)**, native player, quota-safe fetch strategy, SponsorBlock/DeArrow/RYD client design, download vault pipeline, sync API, aur revised roadmap.
> Sab kuch **local-first**: koi server nahi, data aapki machine me.
>
> **Scope:** personal-use app, no store distribution → **koi feature gate nahi**, sab full-power. Code modules sirf maintenance ke liye alag rakhe gaye hain.

---

## 1. Project structure

```
localtube/
├─ src-tauri/
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  ├─ binaries/                     # sidecars (gitignored)
│  │  ├─ yt-dlp-x86_64-pc-windows-msvc.exe
│  │  ├─ ffmpeg-x86_64-pc-windows-msvc.exe
│  │  └─ ... (per target triple)
│  ├─ capabilities/default.json     # permissions, allowlist HTTP hosts
│  └─ src/
│     ├─ main.rs / lib.rs
│     ├─ state.rs                   # AppState { db pool, http client, jobs }
│     ├─ db/
│     │  ├─ mod.rs                  # pool init + migrations
│     │  ├─ schema.sql              # (Section 3)
│     │  └─ queries/                # videos.rs, channels.rs, history.rs ...
│     ├─ ingest/
│     │  ├─ rss.rs                  # feeds/videos.xml → upsert
│     │  ├─ yt_api.rs               # Data API v3 client (quota-aware)
│     │  ├─ quota.rs                # per-day unit meter in SQLite
│     │  └─ scheduler.rs            # background refresh (tokio interval)
│     ├─ enrich/
│     │  ├─ sponsorblock.rs
│     │  ├─ dearrow.rs
│     │  └─ ryd.rs
│     ├─ player/                    # commands for progress, chapters
│     ├─ resolve/                   # ← SABSE IMPORTANT: extraction layer
│     │  ├─ mod.rs                  # MediaResolver trait + fallback chain
│     │  ├─ ytdlp.rs                # yt-dlp -J → stream URL (primary)
│     │  ├─ innertube.rs            # youtubei.js / InnerTube (mobile, fast)
│     │  ├─ instance.rs             # Invidious / Piped public instance fallback
│     │  ├─ official.rs             # official IFrame embed (last resort)
│     │  ├─ cookies.rs              # cookies.txt import + keychain
│     │  └─ cache.rs                # stream URL cache (expires ~6h)
│     ├─ audio/                     # background audio service
│     ├─ vault/                     # downloads
│     │  ├─ ytdlp.rs                # process spawn + progress parse
│     │  ├─ job.rs                  # queue, retry, resume
│     │  └─ gallery.rs              # MediaStore/Photos/desktop folder
│     ├─ import/
│     │  ├─ takeout.rs              # watch-history.json streaming parse
│     │  └─ subs.rs                 # subscriptions.csv / OPML
│     ├─ sync/                      # E2E blob sync (BYO cloud)
│     │  ├─ crypto.rs
│     │  ├─ drive.rs / webdav.rs
│     │  └─ merge.rs
│     └─ commands.rs                # #[tauri::command] surface
└─ src/                             # React + TS
   ├─ lib/
   │  ├─ ipc.ts                     # typed invoke wrappers
   │  ├─ player/
   │  │  ├─ YouTubeBridge.ts        # iframe/postMessage bridge
   │  │  ├─ PlayerOverlay.tsx
   │  │  └─ usePlayerState.ts
   │  └─ theme/
   ├─ routes/  (tanstack-router)
   │  ├─ home/ (tabs, folders)
   │  ├─ watch/[id]/  (player + notes + transcript)
   │  ├─ library/  vault | notes | clips | playlists
   │  ├─ search/
   │  └─ settings/
   └─ store/ (zustand per-domain)
```

**Bundling note:** heavy chatty data Rust se aaye; React sirf view + local UI state. Har `invoke` ka response small rakho (paged).

---

## 2. Tauri config — 3 cheezein jo pehle din set karni hain

### 2.1 CSP (warna production me iframe blank)
```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://embed.yourdomain.com; connect-src 'self' ipc: http://ipc.localhost https://sponsor.ajay.app https://dearrow.ajay.app https://returnyoutubedislikeapi.com https://www.googleapis.com https://www.youtube.com"
    }
  }
}
```

### 2.2 Error-153 fix (recommended: wrapper page)
```html
<!-- deploy on your HTTPS domain: https://embed.yourdomain.com/yt.html -->
<!doctype html><meta charset="utf-8"><div id="p"></div>
<script>
const q = new URLSearchParams(location.search);
const origin = '*';                       // tighten to your app origin in prod
new YT.Player('p', {
  videoId: q.get('v'),
  host: 'https://www.youtube-nocookie.com',
  playerVars: { enablejsapi: 1, controls: 0, rel: 0, playsinline: 1,
                origin: location.origin, start: +(q.get('t')||0) },
  events: {
    onReady: e => { parent.postMessage({t:'ready', d:e.target.getDuration()}, origin);
                    e.target.playVideo(); },
    onStateChange: e => parent.postMessage({t:'state', d:e.data}, origin)
  }
});
// load https://www.youtube.com/iframe_api first (or via s.src)
addEventListener('message', ({data,source}) => { /* play/pause/seek/rate ← parent */ });
</script>
```
App side: `<iframe src="https://embed.yourdomain.com/yt.html?v=ID">` + `postMessage` command bus + 250ms time tick. Isse: real referer ✅, IPC intact ✅.

### 2.3 HTTP allowlist (mitm-safety)
`capabilities/default.json` me sirf wahi hosts do jo chahiye: `www.youtube.com`, `i.ytimg.com`, `www.googleapis.com`, `sponsor.ajay.app`, `dearrow.ajay.app`, `returnyoutubedislikeapi.com`, `feeds.*`. Baaki sab block — user privacy + smaller attack surface.

---

## 3. SQLite schema (copy-paste)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, avatar TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channel (
  id TEXT PRIMARY KEY,                -- UC...
  handle TEXT, name TEXT NOT NULL, avatar_url TEXT,
  tags TEXT,                          -- JSON array
  note TEXT, custom_name TEXT,
  subscribed INTEGER DEFAULT 1, subscribed_at TEXT,
  last_feed_check TEXT, uploads_playlist TEXT
);

CREATE TABLE IF NOT EXISTS folder (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, icon TEXT, ord INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS folder_channel (
  folder_id INTEGER REFERENCES folder(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES channel(id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, channel_id)
);

CREATE TABLE IF NOT EXISTS video (
  id TEXT PRIMARY KEY,                -- videoId
  channel_id TEXT REFERENCES channel(id),
  title TEXT NOT NULL, description TEXT,
  published_at TEXT, duration_s INTEGER,
  thumb_url TEXT, is_short INTEGER DEFAULT 0, is_live INTEGER DEFAULT 0,
  dearrow_title TEXT, dearrow_thumb TEXT, dearrow_checked_at TEXT,
  views INTEGER, likes INTEGER, dislikes INTEGER,
  tags TEXT, category TEXT,
  fetched_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_video_channel_pub ON video(channel_id, published_at DESC);

CREATE TABLE IF NOT EXISTS video_progress (      -- Continue Watching
  video_id TEXT PRIMARY KEY REFERENCES video(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  position_s INTEGER DEFAULT 0, duration_s INTEGER,
  percent REAL, completed INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watch_event (         -- history (append-only)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT, channel_id TEXT,
  title TEXT, watched_at TEXT NOT NULL,
  seconds_watched INTEGER, source TEXT            -- 'app' | 'takeout'
);
CREATE INDEX IF NOT EXISTS idx_we_time ON watch_event(watched_at DESC);

CREATE TABLE IF NOT EXISTS note (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL, ts_s INTEGER NOT NULL,
  body_md TEXT NOT NULL, tags TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL, ts_s INTEGER, end_s INTEGER,
  label TEXT, thumb_path TEXT
);

CREATE TABLE IF NOT EXISTS playlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, kind TEXT DEFAULT 'manual',  -- manual|smart
  rules_json TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS playlist_item (
  playlist_id INTEGER REFERENCES playlist(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL, ord INTEGER, added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, video_id)
);

CREATE TABLE IF NOT EXISTS config_kv (k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS sb_segment (          -- SponsorBlock cache
  video_id TEXT NOT NULL, category TEXT NOT NULL,
  start_s REAL, end_s REAL, action TEXT, uuid TEXT,
  locked INTEGER DEFAULT 0, votes INTEGER DEFAULT 0,
  fetched_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (video_id, uuid)
);

CREATE TABLE IF NOT EXISTS quota_ledger (        -- Data API unit meter
  day TEXT PRIMARY KEY,                -- YYYY-MM-DD (Pacific)
  units_used INTEGER DEFAULT 0, searches_used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS download_job (
  id TEXT PRIMARY KEY, video_id TEXT, preset TEXT,
  status TEXT,                        -- queued|running|paused|done|error
  progress REAL, speed TEXT, eta TEXT,
  file_path TEXT, error TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_state ( key TEXT PRIMARY KEY, last_hash TEXT, synced_at TEXT );

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS video_fts USING fts5(
  video_id UNINDEXED, title, channel_name, description, transcript
);
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  note_id UNINDEXED, body
);
```

**Migration rule:** `schema.sql` idempotent rakho + `user_version` pragma se increments. Kabhi destructive ALTER nahi — naya column with default.

---

## 4. Quota-safe ingest strategy (yahi app ko sasta banata hai)

```
refresh_all():
  1) DB se saare channels lo (last_feed_check > 20 min wale skip)
  2) RSS: GET https://www.youtube.com/feeds/videos.xml?channel_id=UC...
     concurrency 6, timeout 8s, etag/last-modified respect
     → parse: entry{yt:videoId, title, published, media:group.thumbnail, yt:stats}
     → INSERT OR IGNORE into video  (no API call!)
  3) Sirf missing metadata (duration/views) ke liye batch videos.list
     ids=50 per call → 1 unit per 50 videos  ← yeh key optimization hai
  4) 24h+ purane DeArrow/RYD caches hi refresh
  5) quota_ledger check: agar units_used > 8500 → sirf RSS chalao, API pause
```

**Search flow:**
```
user types → 300ms debounce → local FTS5 search (0 units, instant)
           → "YouTube pe search" button / Enter → search.list (100 units)
             → results 24h SQLite cache me
           → suggest queries (free, no key) for autocomplete
```
Isse aapka worst-case bhi 100 searches/day ke andar rehta hai.

---

## 5. SponsorBlock client (Rust)

```rust
// enrich/sponsorblock.rs
const BASE: &str = "https://sponsor.ajay.app";

#[derive(serde::Deserialize)]
pub struct Seg { pub category: String, pub actionType: String,
                 pub segment: (f64, f64), #[serde(rename="UUID")] pub uuid: String,
                 pub locked: u8, pub votes: i32 }

/// Privacy mode: hash prefix — server ko poora videoId nahi pata
pub async fn fetch(client: &reqwest::Client, video_id: &str,
                   cats: &[&str]) -> anyhow::Result<Vec<Seg>> {
    use sha2::{Sha256, Digest};
    let h = format!("{:x}", Sha256::digest(video_id.as_bytes()));
    let prefix = &h[..4];
    let url = format!("{BASE}/api/skipSegments/{prefix}");
    let mut req = client.get(url);
    for c in cats { req = req.query(&[("category", c)]); }
    let res = req.send().await?;
    // 404 = no segments for any video with that prefix → empty
    if res.status() == 404 { return Ok(vec![]); }
    let groups: Vec<SegGroup> = res.json().await?;
    Ok(groups.into_iter()
        .filter(|g| g.video_id == video_id)
        .flat_map(|g| g.segments).collect())
}
```
**Skip loop (frontend):** `timeupdate` pe check → agar `t` kisi segment ke andar hai → `seekTo(end + 0.05)`, ek toast dikhao "Skipped sponsor (23s)". **Highlight** category → "Jump to best part" button. **music_offtopic** → default `mute` action (gaana preserve).
**Per-category toggles + per-channel whitelist** config_kv me.

---

## 6. DeArrow + RYD (batch + cache)

```ts
// DeArrow: ek request me 20-30 ids
const branding = await fetch(
  `https://dearrow.ajay.app/api/v1/branding?videoIDs=${ids.join('&videoIDs=')}`
).then(r => r.json());
// per video: branding.titles[best].title, branding.thumbnails[best].timestamp
// thumbnail image: https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=ID&time=SEC
```
- Fallback: random timestamp **jo SB segment ke bahar ho** (blueprint §7.2 ka logic).
- UI me "Original dikhao" toggle mandatory rakho (DeArrow guidelines).

```ts
// RYD: attribution required + rate limit 100/min, 10k/day
const { dislikes, likes, viewCount } = await fetch(
  `https://returnyoutubedislikeapi.com/votes?videoId=${id}`
).then(r => r.json());
```
Rust me cache 7 din + global token bucket (1 rps) lagao; 429 pe exponential backoff.

---

## 7. Player contract — native engine (recommended) + iframe bridge (fallback)

### 7.1 `MediaResolver` — extraction layer (sabse important module)

```rust
// resolve/mod.rs
pub struct StreamInfo {
    pub video_url: Option<String>,   // video-only ya muxed
    pub audio_url: Option<String>,   // audio-only (background/audio-mode ke liye)
    pub muxed_url: Option<String>,   // progressive (720p tak usually)
    pub duration_s: f64,
    pub formats: Vec<Format>,        // quality picker ke liye
    pub expires_at: i64,
    pub source: Engine,              // YtDlp | InnerTube | Instance | Official
}

#[async_trait]
pub trait MediaResolver: Send + Sync {
    async fn resolve(&self, video_id: &str, pref: QualityPref) -> Result<StreamInfo>;
}

/// Auto chain — ek fail ho to agla. App kabhi dead nahi.
pub async fn resolve_auto(id: &str, pref: QualityPref, db: &Db) -> Result<StreamInfo> {
    if let Some(hit) = db.cache.get_fresh(id)? { return Ok(hit); }
    for engine in [Engine::YtDlp, Engine::InnerTube, Engine::Instance] {
        match engine.resolve(id, pref).await {
            Ok(info) => { db.cache.put(id, &info)?; return Ok(info); }
            Err(e)    => { tracing::warn!(?engine, %e, "resolver failed, next"); }
        }
    }
    Err(anyhow!("all engines failed — official embed fallback"))
}
```

**Design rules:**
1. Sirf `resolve_auto` call karo UI se — engine kabhi hardcode nahi.
2. Stream URL **6 ghante** cache karo (`expires_at` ke andar). Dobara resolve = extra YouTube request.
3. `Engine` ko settings me override kar sakte ho (debug ke liye).
4. Audio-only mode me `audio_url` lo (video stream download hi na karo → 90% data saved).
5. Cookies sirf tab attach karo jab anonymous resolve fail ho (default anonymous).
6. `Playback engine` setting: `Auto (recommended)` / `yt-dlp` / `InnerTube` / `Official embed`.

### 7.2 Native player (Engine B)

```tsx
// Player.tsx (v1: <video> element, blob/local proxy URL)
<video
  src={stream.muxed_url}
  playsInline
  preload="metadata"
  onTimeUpdate={e => bridge.tick(e.currentTarget.currentTime)}
/>
```
- **Quality picker** → `formats` se alag URL (`<video>` reload, position preserve karke).
- **Background audio** → Rust `audio` module (rodio/symphonia) audio-only stream chalaye; UI me "playing in background" strip. Mobile pe OS notification/media session (`tauri-plugin-*` ya native bridge).
- **Speed** → `<video>.playbackRate` (0.0625–16x supported); ya mpv `speed`.
- **A-B loop** → `timeupdate` pe check, `currentTime = a`.
- **Screenshots** → canvas (blob URL same-origin, taint nahi) ya Rust ffmpeg exact frame.
- **Volume boost** → `AudioContext` + `GainNode` (same-origin stream hona chahiye; warna Rust side decode) — ya mpv `volume-max=400`.
- **v1.5 upgrade:** libmpv embed (`tauri-plugin-mpv` ya IPC) → hardware decode, 8K, seamless seeking, perfect audio sync. Ye upgrade player API badle bina ho jata hai agar aapne upar wala `<PlayerBridge>` abstraction rakha.

### 7.3 Engine A fallback (official iframe) — sirf jab sab kuch fail ho

```ts
// YouTubeBridge.ts — sirf fallback path
type Cmd = {c:'play'}|{c:'pause'}|{c:'seek',t:number}|{c:'rate',r:number}
         | {c:'load',v:string,t?:number}|{c:'volume',v:number};
// wrapper page (your HTTPS domain) se postMessage; see blueprint §1.3
```
**Note:** Engine A me `rate` 0.25–2x tak hi, ads aayenge, screenshot nahi hoga — isliye isko sirf "video na chale to" wala last resort rakho.

---

## 8. Vault (download) pipeline

> Personal build: **full-power**, koi gate nahi. Module alag sirf isliye ki extractor breakage se download code player ko na tode.

```rust
// vault/ytdlp.rs (skeleton)
let out = format!("{}/%(title)s [%(id)s].%(ext)s", dir);
let mut cmd = tauri_plugin_shell::ShellExt::shell(&app).sidecar("yt-dlp")?;
cmd.args(["-f","bv*+ba/b","-o",&out,
          "--embed-thumbnail","--embed-metadata","--embed-chapters",
          "--embed-subs","--sub-langs","en,hi","--write-info-json",
          "--newline","--progress-template","download:%(progress._percent_str)s"]);
let (mut rx, _child) = cmd.spawn()?;
while let Some(ev) = rx.recv().await {
   // parse percent/speed/eta → db update → emit("vault://progress", ...)
}
```

**Presets (UI sheet):**
| Preset | yt-dlp flags |
|---|---|
| 1080p MP4 | `-f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]" --merge-output-format mp4` |
| 4K | `-f "bv*[height<=2160]+ba/b"` |
| Data saver 480p | `-f "bv*[height<=480]+ba/b"` |
| Audio M4A | `-f ba[ext=m4a] -x --audio-format m4a` |
| Audio MP3 320 | `-x --audio-format mp3 --audio-quality 320K` |
| Sponsor-free copy | upar + post-pass ffmpeg `-vf` + segment cuts from `sb_segment` table |
| Subtitles only | `--skip-download --write-subs --write-auto-subs` |

**Post-processing:** ffmpeg `loudnorm=I=-14:TP=-1.5:LRA=11` (audio normalize), `-c:v copy` cut for sponsor removal (keyframe-safe: cut at segment ±0.5s).

**Gallery fan-out:**
- Android: MediaStore `Video` insert → `Movies/LocalTube/<Channel>/` (no broad storage permission)
- iOS: `Documents/LocalTube/` + optional Photos export
- Desktop: `~/Videos/LocalTube/<Channel>/` + `.json/.jpg/.vtt` sidecars

**Reliability UX:** download fail ho → job `error` + `Retry` button + "Update extractor" shortcut (yt-dlp GitHub release se binary swap). Settings me `yt-dlp --version` aur last-update date dikhao.
**Cookies:** settings me `cookies.txt` drop zone; tell user **burner account** use karein. Cookies keychain me store karo (plaintext nahi).

---

## 9. Takeout import (streaming)

```rust
// import/takeout.rs — GB-size JSON, isliye streaming
// { title: "Watched X", titleUrl: "https://www.youtube.com/watch?v=ID",
//   subtitles: [{ name: "Channel", url: ".../channel/UC..." }], time: "2024-.." }
```
- `simd-json` ya `serde_json::Deserializer::from_reader` se array elements stream karo.
- Dedupe: `(video_id, watched_at)` unique index; repeat views count banao.
- Missing `titleUrl` (deleted videos) → "unavailable" flag, history me rakho.
- Channel stub banao (`id` se) — subscribe **nahi** karo, sirf history attribution.
- Progress: `emit("import://progress", {done, total})`.
- Takeout me **watch duration nahi hota** → UI me saaf likho "imported history: dekha tha, kitna der nahi pata".

---

## 10. Sync design (BYO cloud, E2E)

```
local db ──(delta rows with updated_at + device_id)──> JSON blob
   → compress (zstd) → encrypt (XChaCha20-Poly1305, user passphrase → Argon2id)
   → upload: user's WebDAV / Google Drive appdata / iCloud / Syncthing folder
merge: per-table last-write-wins on updated_at (ties → device_id lexicographic),
       watch_event = append-only union by (video_id, watched_at),
       notes = union by id, conflict → keep both with "(conflict)" suffix
```
- **Sync scope:** subscriptions, folders/tags, progress, notes, clips, playlists, settings (not vault media files).
- **Security:** passphrase kabhi disk pe plain nahi (OS keychain: `keyring` crate). "Forget passphrase" = data loss warning.
- **Cadence:** on-change debounce 60s + manual "Sync now" + app-close flush.
- **v1 simpler option:** LAN sync only (QR pair + mDNS, `local-ip-address` + tiny axum server) — 2 din ka kaam, cloud se pehle ship karo.

---

## 11. Revised roadmap — personal build (extraction-first)

| Week | Milestone | Deliverable |
|---|---|---|
| 0 (2–3 din) | **Extraction spike** | Rust command: yt-dlp `-J` → stream URL → `<video>` plays. **Go/no-go decision point.** |
| 1 | Skeleton | Tauri v2 + React + TanStack Router + SQLite migrations + typed IPC + OLED theme base |
| 2 | **MediaResolver + Player v1** | 3-engine chain, quality picker, speed 0.05–16x, A-B loop, keyboard, resume, PiP |
| 3 | Background audio | Rust audio service + audio-only mode + media session controls |
| 4 | Ingest | RSS subscribe/resolve + folders + chronological feed + FTS |
| 5 | Library | history + Continue Watching + queue + playlists + progress sync hooks |
| 6 | **Vault** | yt-dlp job queue + presets + gallery export (desktop + Android MediaStore) |
| 7 | Enrich | SponsorBlock (skip + physical cut), DeArrow, RYD, cached/batched |
| 8 | Import/Export | Takeout subs + watch-history + `.tubebak` backup |
| 9 | Search + Polish | local FTS + InnerTube search + autocomplete + nav customization + distraction-free |
| 10 | **v1 usable** | Desktop builds + auto-update + yt-dlp updater + crash log (local) |
| 11 | Mobile | Android/iOS shell, bottom nav, gestures, gallery integration |
| 12 | Sync + extras | LAN sync → optional encrypted cloud sync; notes/AI summary/recall cards |

---

## 12. Testing & quality gates

- **Unit:** Rust — RSS parser (fixture XMLs), Takeout parser, merge logic, quota ledger.
- **Integration:** mock HTTP (`wiremock`) for SB/DeArrow/RYD failure modes (404, 429, timeout) — **fail silent** hona chahiye.
- **E2E:** Playwright on web build (player mocked), `tauri-driver` for desktop smoke.
- **Perf budget:** cold start < 800ms, feed scroll 60fps with 500 items (virtualized list), DB query < 15ms.
- **Offline test:** network off → subscribers feed, history, notes, vault sab kaam karein.

---

## 13. Housekeeping checklist (personal build)

- [ ] **yt-dlp auto-updater** kaam kar raha ho (weekly check + manual button).
- [ ] `MediaResolver` fallback chain test: yt-dlp ko jaan-boojh kar todo → InnerTube pe switch ho.
- [ ] Cookies **keychain** me, plaintext nahi. Burner account recommended (UI hint).
- [ ] DeArrow/RYD **attribution** settings/about me (unka guideline hai, aur free API ka shukriya).
- [ ] Data API: agar use karo to caching respect karo; bulk metadata API se hi, scrape se nahi.
- [ ] Download UI me "personal offline copy" ka chhota note — kabhi kisi ko app share karo to confusion na ho.
- [ ] Zero telemetry (default off ho hi na), crash logs local file me, user manually bheje.
- [ ] Vault folder ka **backup/export** easy ho (files + `.json` sidecars portable).
