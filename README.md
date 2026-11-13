## Latest verified Windows preview

[Download artifact ZIP](https://github.com/twgw9/lumatube/actions/runs/43472982948/artifacts/14063100916) · build commit `c27642d`.
Windows compile, NSIS packaging, native final-path/progress parser tests and frontend regression tests passed.
Includes explicit bundled ffmpeg discovery, finalized-file verification, SponsorBlock removal wiring and focus autoplay fix.
Unsigned preview. Actual installation/live playback/download output still require device testing.

## Windows installer build verified

Windows native compilation and NSIS packaging **passed** on GitHub Actions for commit `f6087e9`.
[Build run and installer artifact](https://github.com/twgw9/lumatube/actions/runs/43466613113).
Artifact: `LumaTube-Windows-preview-unsigned` (ZIP, includes installer and notices).
This is an unsigned preview, not a runtime-tested release. Live extraction, playback,
downloaded files, Windows install/uninstall and Android still need device testing.
Earlier notes below saying Rust was never compiled describe the previous state;
the sandbox still has no local Rust toolchain, but remote Windows compilation now passed.

## Real-feed wiring update

Home and Subscriptions no longer substitute demo videos. Browser feeds require a user-provided YouTube Data API v3 key (Settings → Account); choose Subscriptions or Popular in India. Subscribe via a channel URL, @handle or channel ID. Search, popular pages and uploads playlists have token-based Load more with deduplication, request cancellation and visible quota/network errors. API keys are stored locally (not encrypted); restrict the key in Google Cloud. Google sign-in remains unimplemented; these are public feeds, not personalised YouTube Home.

Browser watch pages use the actual selected video's official YouTube embed; embeds may show ads or reject playback. Native extraction errors are visible, never replaced by sample media. Native playback is restricted to combined audio/video formats until adaptive A/V support exists. Downloads may still merge separate streams. No live YouTube/network or Rust end-to-end verification has occurred in this sandbox.

Tests: `npm run test:regression` includes mocked Data API and jsdom feed-hook tests. Build: `npm run build`. Passing mocks are not a substitute for live API/native/device tests.

> **Build status:** Browser preview and TypeScript build verified. Rust has not been compiled in this sandbox. Android APK, foreground download service, MediaStore integration, Google OAuth and encrypted sync are not implemented or device-tested. See [Android readiness](docs/android-port.md). GitHub release discovery is a manual sideload flow, not a signed automatic updater. Source is available in this repository; no open-source license has been chosen yet.

# LumaTube

**A local-first YouTube client for desktop.** Ad-free native player, RSS subscription
feed with zero API quota, downloads straight into your Videos folder (and system
gallery), SponsorBlock auto-skip, timestamped notes, focus mode, and every knob in
Settings.

> Personal-use app. No store, no selling, no telemetry. Everything you own lives in
> a single SQLite file on your machine.

---

## What's inside

| Layer | Tech | Where |
|---|---|---|
| UI | React 19 + TypeScript + Tailwind v4 | `src/` |
| Shell | Tauri v2 (Rust) | `src-tauri/` |
| Storage | SQLite (WAL) | `src-tauri/src/db.rs` |
| Extraction | yt-dlp sidecar → InnerTube → Invidious/Piped | `src-tauri/src/resolve.rs` |
| Feed | YouTube RSS (free) + Data API enrichment (batched) | `src-tauri/src/feed.rs` |
| Community data | SponsorBlock, DeArrow, Return YouTube Dislike | `src-tauri/src/enrich.rs` |
| Downloads | yt-dlp + ffmpeg, progress events, gallery export | `src-tauri/src/vault.rs` |
| Commands | 21 typed Tauri commands | `src-tauri/src/commands.rs` |

### Feature map

- **Player** — custom controls, **quality picker up to 8K** (4320p/4K/1440p/1080p60),
  **0.06×–4× speed** with per-channel memory, A-B loop, loop-video, chapters with
  thumbnail strip, PiP, theater/cinema, **sleep timer** (15/30/45/60 min with live
  countdown), **stats-for-nerds panel** (engine, buffer, frames, dropped, bitrate),
  **ambient glow**, double-tap seek, keyboard shortcuts (`space k j l ← → [ ] a b m 0-9`).
- **Premium-quality streaming** — the extractor picks the best video + best audio
  separately (like Premium), 60 fps/HDR variants preferred, audio-only mode, and
  adaptive quality switching that preserves your position.
- **SponsorBlock** — category toggles, privacy hash-prefix endpoint, auto-skip with
  undo toast, "mute instead of skip" for music, physical segment cut at download time.
- **Feed** — RSS-based subscriptions (15 latest per channel, no API key, no quota),
  folders, custom home tabs, keyword + channel blocklists, Shorts filter.
- **Focus mode** — one switch: recommendations, comments, autoplay, end screens off.
- **Downloads** — 8 presets (1080p/4K/720p/480p/audio-M4A/MP3/sponsor-free/subs),
  parallel queue, resume, storage cap, gallery toggle per item, embed thumbnail +
  chapters, files under `~/Videos/LumaTube/<Channel>/`.
- **Notes** — timestamped markdown notes, jump-to-time, markdown export, clip bookmarks.
- **Library** — playlists, liked, history, clips, continue-watching sync via SQLite.
- **Settings** — theme (OLED/graphite/sepia/light), 8 accents, density, engines,
  community APIs, API keys, sync folder, extractor health + one-click yt-dlp update.

---

## Run it

### 1. UI only (fast iteration, browser)

```bash
npm install
npm run dev          # http://localhost:5173
```

The browser build runs on demo data with a browser fallback layer (`src/lib/bridge.ts`) —
every Rust call silently no-ops, so you can build UI without Rust installed.

### 2. Full desktop app (real extraction + downloads)

Prereqs: **Rust** (https://rustup.rs), Node 20+, and the Tauri system deps for your OS
(https://tauri.app/start/prerequisites/).

```bash
# fetch the two sidecar binaries (not committed — they're large + platform specific)
mkdir -p src-tauri/binaries

# yt-dlp  → name it for your host triple
#   Windows: yt-dlp-x86_64-pc-windows-msvc.exe
#   macOS:   yt-dlp-aarch64-apple-darwin   (or x86_64-apple-darwin)
#   Linux:   yt-dlp-x86_64-unknown-linux-gnu
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o src-tauri/binaries/yt-dlp-<triple>
chmod +x src-tauri/binaries/yt-dlp-*

# ffmpeg (BtbN builds, LGPL) → same triple naming
#   src-tauri/binaries/ffmpeg-<triple>

npm run tauri dev      # desktop window with the real backend
npm run tauri build    # produces .msi / .dmg / .AppImage + .deb
```

Host triple: `rustc -vV | grep host`.

> **Note:** `src-tauri/binaries/` is git-ignored on purpose. The app shows an
> "extractor missing" state with a one-click **Update extractor** button until you drop
> the binary in place — or use the button, which downloads the latest release at runtime.

### 3. Optional: better search

Settings → Account → API keys:

- **YouTube Data API key** — enables `search.list` and duration enrichment.
  Free, 10 000 units/day. Without it, search is local-only (still instant).
- **OAuth client ID** — for real Google sign-in (subscriptions/likes sync). The app
  works fully in guest mode without it.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl/⌘ + K` | Command palette |
| `Ctrl/⌘ + B` | Collapse sidebar |
| `Ctrl/⌘ + /` | Toggle focus mode |
| `space` / `k` | Play / pause |
| `j` `l` / `←` `→` | Seek |
| `[` `]` | Speed down / up |
| `a` `b` | Set A-B loop points (`Esc` clears) |
| `m` | Mute |
| `0`–`9` | Jump to 0–90% |

---

## Project layout

```
src/
  components/   ui.tsx, Shell, VideoCard, CommandPalette, DownloadSheet, Player/PlayerSurface
  pages/        Home, Subscriptions, Watch, Downloads, Library, Notes, Search, Channel, Settings
  hooks/        usePlayer (all playback intelligence), useDownloadEvents
  lib/          bridge (Rust <-> TS), types, mock data, utils
  store/        settings, library (zustand + persist)
src-tauri/
  src/          lib.rs, commands.rs, db.rs, resolve.rs, feed.rs, enrich.rs, vault.rs, error.rs
  binaries/     yt-dlp + ffmpeg sidecars (not committed)
docs/           research blueprint, implementation playbook, UI spec, mockups
```

---

## How the risky bits are handled

- **Ads** — the player never requests them: streams come from the extractor, not the
  YouTube embed. Not an ad-blocker, just not asking for ads.
- **Breakage** — four engines in a chain (`yt-dlp → InnerTube → Invidious → official
  embed`). Settings → Downloads → **Update extractor** swaps the yt-dlp binary from
  GitHub releases without an app update.
- **Age-restricted / bot check** — drop a `cookies.txt` (from a burner Google account)
  into the sidecar folder and yt-dlp will use it. Guest mode stays anonymous by default.
- **Privacy** — no telemetry, no server. SponsorBlock requests use the hash-prefix
  endpoint, so the exact video id never leaves the machine.

---

## Status

v0.1.0 — the full UI is implemented and building; the Rust backend compiles against
Tauri v2 and needs the sidecars to fetch real streams. Next up: Android build with
MediaStore gallery save, and the optional encrypted sync bridge.

## Latest desktop work

Guest profile menu, history search/pause and Notes OFF by default. Run `npm run test:regression` and `npm run build`. See [desktop preview and Windows installer instructions](docs/desktop-preview.md). Windows CI is manual and has not been run/verified yet; no installer is attached to this change.
