# LocalTube — Research & Feature Blueprint
### Ek Local-First, Cross-Platform YouTube Client (Tauri v2 + Rust + React/TS)

> **Document ka maksad:** popular open-source YouTube clients, frontends aur browser extensions ka deep research karke aapke app ke liye best features, workflows aur power-user ideas nikalna — aur unhe saaf categories me + feasibility tags ke saath rakhna.
>
> **Aapka core requirement:** *"sab kuch user ke computer me rahe"* — yaani **local-first**, koi hamara server nahi, user ka data user ka. Saath me **video download + SponsorBlock + downloads gallery/album me** jaise features.
>
> **⚠️ Distribution decision (confirmed):** ye **sirf aapke personal use ka app** hai. **Na bechna hai, na Play Store / App Store pe daalna hai.** Iska matlab: *"store rejection"* wala darr khatam. Jo bhi feature aapke kaam ka hai, wo **full-power** me banana hai — koi feature jaan-boojh kar kata hua nahi rakhenge. §0.5 poora plan isi hisaab se revise kiya gaya hai.
>
> **Legend (Feasibility):**
> `Easy` = hafte ke andar ban jayega · `Medium` = 1–3 hafte · `Hard` = 3+ hafte ya deep platform work
> `[Unofficial / Risky]` = YouTube Terms of Service ke against ja sakta hai ya official API me support nahi hai. **Personal use me ye "ban" nahi hai — ye "kaam karega par YouTube future me tod sakta hai" matlab hai.** Risk ab sirf 2 hain: (a) feature kabhi-kabhi break ho sakta hai (yt-dlp update se fix), (b) aapke Google account pe rate-limit/strike ka theoretical risk. Har risky feature ke saath **stable fallback** diya gaya hai.

---

## 0. TL;DR — 60 second summary

1. **Local-first** bilkul possible hai: SQLite (Rust side) + aapke apne cloud (WebDAV / Google Drive) = zero server, full privacy. FreeTube, NewPipe, Grayjay sab yahi model chalate hain.
2. **Do playback engines banao, dono ko switch-able rakho** (ye personal-use ka sabse bada upgrade hai):
   - **Engine A — Official IFrame Player:** legal, stable, comments/likes/embed branding intact. Ads rahenge, par baaki sab (SponsorBlock, custom overlay, notes) chalega.
   - **Engine B — Full extract (InnerTube / youtubei.js / yt-dlp):** **no ads, background audio, audio-only mode, 4K, offline download, live chat**. Ye personal use ke liye perfect hai. Isme Tauri me Error-153 ka issue bhi khud khatam ho jata hai (kyunki aap YouTube ka player use hi nahi karte — apna `<video>` element use karte ho).
3. **Ad-free possible hai** — bas Engine B se. Side-effect: YouTube Premium features (background play, PiP, downloads) free me mil jayenge, aur **hamara custom player un features se bhi zyada dega**.
4. **SponsorBlock / DeArrow / Return YouTube Dislike** — teeno free public API, dono engines pe kaam karte hain. Ye hi aapki app ko "premium" feel denge.
5. **Data API v3 quota** = 10,000 units/day, `search.list` = 100 units. Isliye feed ke liye **RSS (15 latest/channel, no key, no quota)** + aggressive SQLite caching; search ke liye local FTS + optional InnerTube search (quota-free).
6. **MVP 10 features** §10 me. **5 killer features** §11 me. Naya **§0.5 "Full-Power Plan"** hai jo batata hai personal use me kaunse 8 features unlock ho jate hain jo pehle "risky" the.

---

## 0.5 Full-Power Plan — personal use me kya-kya unlock ho gaya

Pehle jo maine "risky / store-safe alternative" bola tha, ab wo **must-have** hai. Ye table literally aapka build order hai.

| Feature | Public-store build me | **Aapke personal build me** | Technical engine |
|---|---|---|---|
| **Ad-free playback** | ❌ reject | ✅ **full** | Engine B (InnerTube/yt-dlp) — ad segments player hi nahi maangta |
| **Background audio** (screen off, app minimized) | ❌ | ✅ **full** | Native audio track + Rust audio service |
| **Audio-only mode** (data save) | ❌ | ✅ **full** | Sirf `audio` stream (m4a/opus) fetch |
| **Offline download + Gallery** | ⚠️ desktop only | ✅ **full, PC + Phone** | yt-dlp/ffmpeg sidecar + MediaStore |
| **Play Store / App Store** | requirement | **zarurat nahi** → sideload / `adb install` / local APK | — |
| **Custom player (no YouTube chrome)** | limited | ✅ **100% apna** — koi branding strip, koi end-screen, koi "watch on YouTube" | Engine B |
| **4K / highest quality** | embed decided | ✅ **format picker** — like NewPipe | yt-dlp format list |
| **Live chat** | comments only | ✅ **live chat replay** | InnerTube live chat endpoint (free) |
| **Age-restricted / region-locked** | ❌ error | ✅ **cookies/PO token** ke saath | yt-dlp `--cookies` + PO token provider |
| **Google account (subs/likes/playlists)** | allowed but limited | ✅ **OAuth + cookies dono** — 2-way sync | Data API OAuth + cookies import |
| **Transcript** | limited | ✅ **har video ka, offline cache** | yt-dlp `--write-auto-subs` / timedtext |
| **Ad-blocking pattern** | — | ✅ **SponsorBlock + ad-skip + "intro/outro auto-cut"** download time pe | ffmpeg post-process |

> **Ek line me:** ab aap **"YouTube ka apna Netflix"** bana rahe ho — apna player, apna feed, apna data, apni quality choice. Store ki koi limit nahi.

### Iske 4 naye technical requirements (bina inke "full-power" adhoora hai)

1. **Extraction layer** — `yt-dlp` sidecar (mature, roz update hota hai) **+** `youtubei.js`/InnerTube fallback (fast, no binary, mobile pe kaam karta hai). Dono ka common interface `MediaResolver` banao.
2. **Cookie / PO Token jar** — user apne browser se `cookies.txt` import kare (age-restricted, member-only, "bot check" bypass ke liye). App ke andar "Sign in with Google" webview se cookies capture karna bhi possible — **par ye ToS ke terms me "automated access" ban sakta hai**; optional rakho, default off.
3. **Native playback engine** — `<video>` element (webview) + Tauri side `symphonia`/`rodio`, ya better: **libmpv / GStreamer embed** (NewPipe-style). MPV se 8K, hardware decode, perfect seeking, speed 0.05–16x, audio normalize — sab free milta hai. `tauri-plugin-mpv`/IPC bridge se `vid=...` handle kar sakte ho.
   - *Practical path:* v1 `<video>` + yt-dlp URL (fast), v1.5 libmpv (rock-solid).
4. **Ad-free kaise** — Engine B me aap stream URL seedha lete ho, ad segments sirf YouTube ke player ke decision se aate hain. Aapke player me ad request hi nahi jata. **Ye "ad-blocking" nahi, "ad-request nahi karna" hai** — technically simpler aur zyada reliable.

**⚠️ Personal use ka honest risk bhi:** Google ke terms "automated access" ko allow nahi karte. Practically ghar pe chalane se kuch nahi hota (FreeTube/NewPipe/Grayjay lakhon log chalate hain), par **account se cookies use karein to wo account hi risk me hai** — isliye cookies ek **"burner" Google account** se lo, apne main account se nahi. Ye advice aur nahi doonga ki ghar pe kya chalana chahiye — bas technical reality ye hai.

---

---

## 1. Reality Check — pehle ye samajh lo (bahut important)

### 1.1 Do engines ka comparison (ye hi aapki architecture ka core decision hai)

| Cheez | **Engine A: Official IFrame** | **Engine B: Full extract** (yt-dlp / InnerTube) |
|---|---|---|
| Ads | ❌ aate hain | ✅ **zero** (ad request hi nahi jata) |
| Custom UI (apna player chrome) | ⚠️ partial overlay, YouTube branding rehti hai | ✅ **100% apna**, koi logo/endscreen nahi |
| Playback speed | 0.25–2x | ✅ **0.05–16x** (mpv) |
| Background audio / audio-only | ❌ | ✅ **full** (native audio service) |
| Quality picker (360p → 4K/8K) | ❌ embed decide karta hai | ✅ **format picker** |
| Offline download | ❌ | ✅ **full** (file + gallery) |
| Age-restricted / members-only | ❌ error | ✅ cookies ke saath |
| Live chat / comments | ✅ official | ⚠️ comments InnerTube se, live chat replay possible |
| Stability / breakage | ✅ **bahut stable** | ⚠️ **har 1–3 mahine todta hai** → yt-dlp update |
| Views/likes officially counted | ✅ | ❌ (view YouTube pe count nahi hota — aapke liye bekaar farak) |
| Build effort | 2 din | **1–2 hafte** |
| Tauri Error-153 issue | ⚠️ hai (fix chahiye) | ✅ **nahi hai** (aap YouTube player use hi nahi karte) |

**Decision (personal build ke liye):** Engine B **primary** banao, Engine A **fallback** rakho.
- Engine B me extraction fail ho (YouTube todta hai, yt-dlp purana hai, live stream edge case) → us video ke liye **automatic Engine A** pe switch karo, aur user ko chhota toast: *"Fallback player me chal raha hai"*.
- Isse aapko ad-free + background + download milta hai, **aur** jab kabhi break ho to app dead nahi hota.

### 1.2 Download ka plan (aapne specifically poocha — ab bina kisi rok-tok ke)

Store nahi hai, to **koi restriction nahi**. Poora pipeline:
- `yt-dlp` + `ffmpeg` **sidecar** binaries (Windows/macOS/Linux ke liye), Android pe `youtubei.js` + `ffmpeg.wasm` fallback.
- **Presets:** 1080p MP4 · 4K · 720p data-saver · Audio M4A/MP3 320 · **Sponsor-free copy** (ffmpeg se segment physically cut) · Subtitles only · Playlist bulk.
- **Gallery:** Android → MediaStore insert (`Movies/LocalTube/<Channel>/`) = phone gallery me dikhega. iOS → Documents + Photos export. Desktop → `~/Videos/LocalTube/`.
- **Maturity note:** ye pattern 2026 me standard hai — Keepsake, video-plucker, youtube-playlist-downloader sab Tauri v2 + yt-dlp sidecar pe chal rahe hain, so aapko wheel invent nahi karna.
- **Sirf ek practical dhyan:** yt-dlp ko **auto-update** karo (GitHub releases se binary swap) — warna 2–3 mahine me YouTube tod dega aur download band ho jayega.

### 1.3 ⚠️ Engine A chahiye to — **Tauri Error 153** ka fix (fallback ke liye zaroori)

Tauri production build `tauri://localhost` pe chalta hai; YouTube IFrame API ko valid **HTTP(S) Referer** chahiye. Dev me `http://localhost:1420` chalta hai, **production me "Error 153 — Video player configuration error".** Known upstream limitation (tauri#14422).

**Fix (jab Engine A implement karo — 1 din ka kaam):**
1. **Wrapper page apni HTTPS domain pe** (best): `https://embed.yourdomain.com/yt.html?v=ID` — andar se `youtube-nocookie.com/embed/...` load kare, parent ke saath `postMessage` bridge. Real referer ✅, IPC intact ✅.
2. `tauri-plugin-localhost` — app `http://localhost:PORT` pe serve ho; IPC capabilities explicitly trust karni padti hain.
3. Custom protocol + `Referer` header inject — WebView2/WebKit me inconsistent, avoid.

> **Priority:** Engine B pehle banao (Error 153 se hi nahi guzarna padega). Engine A fallback **baad me** — kyunki jab Engine B kaam karega tab aapko Engine A ki zarurat sirf rare cases me hogi.

### 1.4 Data sources ka realistic budget

| Source | Cost | Limit | Aapke app me role |
|---|---|---|---|
| **RSS** `youtube.com/feeds/videos.xml?channel_id=` | Free, no key | 15 latest videos per channel | **Primary feed source** — subscriptions matlab 50–200 RSS calls (parallel, cached) |
| **Data API v3** `videos.list`, `channels.list`, `playlistItems.list` | 1 unit | 10,000/day | Metadata enrich, channel resolve (@handle → UC…), playlists, likes |
| **Data API v3** `search.list` | **100 units** | 100 searches/day | **Sirf tab** jab user explicitly search kare + 24h SQLite cache |
| **Autocomplete** `suggestqueries.google.com` | Free, no key | — | Search-as-you-type (1 request per keystroke debounce) |
| **oEmbed** `youtube.com/oembed` | Free, no key | — | Title/thumbnail/author lookup for any URL |
| **SponsorBlock API** `sponsor.ajay.app` | Free | reasonable use | Skip segments |
| **DeArrow API** `dearrow.ajay.app` | Free | fetch 1 request for many IDs (batch) | Clickbait title/thumbnail fix |
| **RYD API** `returnyoutubedislikeapi.com` | Free | 100/min, 10k/day, **attribution required** | Dislike counts |
| **yt-dlp sidecar** | Free | — | `[Unofficial / Risky]` downloads, stream extraction |

**Quota math:** 10,000 units/day. Agar aap 1 unit calls ko 5,000 tak rakhein aur search 30/day (~3,000 units), to poora din comfortable. Search ke bina app bhi "complete" feel hota hai — kyunki user ke paas subscriptions feed + history + playlists hoti hai.

---

## 2. Reference apps — kisse kya seekhna hai

| Project | Sabse achhi cheez jo copy karni hai | Aapke app me kahan jayega |
|---|---|---|
| **FreeTube** (AGPL, desktop) | **Profiles** — ek hi machine pe multiple "personas" (Work / Kids / Hindi), har ek ke apne subs+history+theme. Distraction-free toggles, multiple windows, screenshots, external player routing | Category 1 + 6 |
| **NewPipe** (Android) | **Channel groups**, popup player, background audio, download queue, database export/import, video/audio-only streams | Category 1, 4, Local Vault |
| **LibreTube** (Android) | **Subscription groups** + **playlist bookmarks** + player gestures (volume/brightness) + "Resume all" downloads + courses/podcasts tabs | Category 2, 4 |
| **Grayjay** (FUTO) | **Universal feed** (YouTube + Twitch + PeerTube + Rumble ek hi list me), source plugins, **local history stored on device**, download to files | Category 1, 4, future multi-source |
| **Yattee** (Apple) | Native-feeling player, multi-instance backend switching, Invidious/Piped instance picker | Category 6 (fallback instance logic) |
| **Piped / Invidious** | **Instance fallback architecture** — ek down ho to doosra. Public JSON API. Libretube isko trust-layer ki tarah use karta hai | Reliability layer |
| **Materialious** | Cross-platform (web/desktop/Android TV) Material 3 polish + "local video fallback when instance fails" | Category 6 |
| **SponsorBlock** | Category-wise skip + **highlight jump** + per-channel whitelist + "mute instead of skip" for music | Category 2 |
| **DeArrow** | Crowd-sourced title/thumbnail + **"show original" button** + fallback random-frame thumbnail (outside sponsor segments!) | Category 1 |
| **Return YouTube Dislike** | Crowd dislike count + ratio bar restarting the classic UI | Category 5 |
| **Enhancer for YouTube** | Granular speed (0.07x–16x), mouse-wheel volume, auto-theater, loop, volume boost up to 10x, frame-by-frame | Category 2 |
| **Unhook** | **Element-level kill list** (home feed, sidebar, comments, shorts shelf, endscreen, mixes, merch...), "redirect home → subscriptions" | Category 1 + 3 |
| **Google Takeout** | `history/watch-history.json` — poora watch history structured me | Category 4 (import) |

---

## 3. Category 1 — Feed, Discovery & Anti-Algorithm Control

Aapka sabse bada emotional selling point. YouTube ka home feed "slot machine" hai; yahan user **apna** feed banata hai.

### 1.1 Unified Local Subscriptions Feed (RSS-first)
- **Kya:** User jitne channels subscribe kare, unke latest videos ek **reverse-chronological** timeline me. Koi recommendation injection nahi.
- **Inspiration:** FreeTube / NewPipe / Grayjay (universal feed)
- **Feasibility:** `Easy` — Rust me `reqwest` + `quick-xml` se `feeds/videos.xml` parse, SQLite me upsert, frontend infinite list.
- **Why users love it:** "Main sirf wo dekhna chahta hoon jo maine chuna tha." Refresh pe naya kuch *chhupaya* nahi jata, aur purana *daba* nahi jata.

### 1.2 Channel Folders / Groups / Profiles
- **Kya:** Channels ko folders me daalo (`Tech`, `Finance`, `Bihar News`, `Music`). Har folder ka apna tab + apna "new videos" counter + badge. Profiles = alag-alag user-persona (ek machine, multiple logins-free identities).
- **Inspiration:** FreeTube Profiles, NewPipe Channel Groups, LibreTube Subscription Groups
- **Feasibility:** `Easy` (join table + filter)
- **Why users love it:** "Work mode" aur "Entertainment mode" alag ho jata hai; ek hi app se office aur personal feed alag.

### 1.3 Custom Home Tabs (build-your-own home screen)
- **Kya:** User apne home tabs banaye: `Aaj ke naye` (RSS), `Continue Watching`, `Watch Later`, `Tech Folder`, `Music`, `Saved by tags`, `Random from vault`. Drag-reorder, hide/show, icons.
- **Inspiration:** Piped/Invidious "trending/feed" tabs, NetNewsWire-style smart feeds
- **Feasibility:** `Medium` (UI + query builder)
- **Why users love it:** Home screen "unke" control me hai, YouTube ke nahi. Ek glance me sab kuch.

### 1.4 Shorts Blocker + Clickbait Filter
- **Kya:** Shorts (duration < 60s ya `/shorts/` URL) ko feed se hide/blur karo — optionally "Shorts sirf 5 min/day" mode. Clickbait filter: ALL-CAPS ratio, excessive emoji, `!!!/😱` density, thumbnail-face-detection score → blur/dim/warn.
- **Inspiration:** Unhook (hide shorts shelf), DeArrow (clickbait scoring philosophy)
- **Feasibility:** `Easy` (heuristics on metadata) + `Medium` (thumbnail face detection — optional Rust `ort`/ONNX)
- **Why users love it:** Shorts = addictive dhoop. Log literally isko block karne ke liye extension lagate hain.

### 1.5 Keyword & Channel Muting (feed hygiene)
- **Kya:** Global + per-folder blocklist: keywords (`"reaction"`, `"#shorts"`, `"spoiler"`), channels, video IDs. Blocked item dikhega hi nahi (ya "hidden: 12 items" ke andar collapse hoga).
- **Inspiration:** Unhook "irrelevant search results", Twitter-style mute lists, NewPipe "hide"
- **Feasibility:** `Easy`
- **Why users love it:** Mobile game / movie spoiler / political rant se bachne ka permanent tarika.

### 1.6 Import Subscriptions from YouTube (OPML / Takeout / CSV)
- **Kya:** Google Takeout ke `subscriptions.csv` ya NewPipe/FreeTube export ko drag-drop karo → 200 channels 5 second me import. Handle (`@name`) → `UC...` resolution RSS/oEmbed se (quota-free).
- **Inspiration:** FreeTube/NewPipe import/export
- **Feasibility:** `Easy`
- **Why users love it:** Onboarding friction zero. Warna koi 100 channels manually subscribe nahi karega.

### 1.7 Local Recommendation Engine (fully offline, transparent)
- **Kya:** "For You" tab jo **aapke** data se bane: watch history durations, tags/keywords, channel affinity, "similar to this" via shared tags + co-watch matrix. Sirf aapke subscribed/unwatched pool se, aur **no autoplay-thriller loop**.
- **Inspiration:** Grayjay "personalized recommendations" (local), YouTube ki absence
- **Feasibility:** `Medium` — SQLite me co-watch counting + keyword TF-IDF; ML ki zarurat nahi. Tags `videos.list?part=topicDetails` (free-ish) se.
- **Why users love it:** Recommendation *ownership*. Aur "Why am I seeing this?" explain kar sakte ho: "kyunki tune X ke 3 videos dekhe".

### 1.8 Explore / Trending without the algorithm
- **Kya:** `videos.list?chart=mostPopular` (region + category), plus aapke folder ke "most watched in last 30 days" (aapke history se, locally).
- **Inspiration:** FreeTube "Trending" / "Most popular" (Invidious instance based)
- **Feasibility:** `Easy` (1 unit per call)
- **Why users love it:** Global discovery chahiye par personalization nahi — "Bihar trending" globally dekhna.

### 1.9 Saved Searches & Watchlist Alerts
- **Kya:** Keyword searches ko "saved search" banao; naya video match kare to local notification. (RSS-based, loop: har 30 min background refresh.)
- **Inspiration:** RSS readers, NewPipe new-video notifications
- **Feasibility:** `Medium` (background task + notification plugin)
- **Why users love it:** "Jab bhi koi `#Tauri` tutorial aaye, mujhe bata do."

### 1.10 Multi-Source Feed (future moat)
- **Kya:** Same UI me PeerTube, Odysee, Rumble, Twitch, podcast RSS. (Grayjay ka model.)
- **Inspiration:** Grayjay plugins
- **Feasibility:** `Hard` (plugin runtime) — v2.0 me
- **Why users love it:** Ek app, poora content diet. Ye long-term retention feature hai.

---

## 4. Category 2 — Custom Player & Playback Enhancements

Sab kuch **official IFrame API ke upar overlay** se — no ad-blocking, no stream ripping.

### 2.1 Custom Control Overlay (skin + layout)
- **Kya:** `controls=0` karke apna React overlay: play/pause, timeline with **chapter heatmap**, volume slider, quality selector, fullscreen, PiP, settings gear. 3 layouts: YouTube-classic / Minimal / Media-player.
- **Inspiration:** Enhancer for YouTube, Materialious, Yattee
- **Feasibility:** `Easy`–`Medium` (timeline drag → `seekTo`, ±2s keyframe tolerance consider karo)
- **Why users love it:** YouTube ka player 10 saal se wahi hai; apna clean player "premium" feel deta hai.

### 2.2 A-B Loop + "Loop chapter" + Loop count
- **Kya:** Do markers set karo (A, B) → sirf wahi part repeat. "Is chapter ko 3 baar dekho" mode (language learning / music practice).
- **Inspiration:** Enhancer for YouTube (repeat specific parts), FreeTube loop
- **Feasibility:** `Easy` — `getCurrentTime()` 250ms interval pe check → `seekTo(A)`
- **Why users love it:** Guitar riff, dance step, English pronunciation — ek hi jagah baar baar chahiye.

### 2.3 Granular Speed Control + "Speed Memory"
- **Kya:** 0.25x–2x fine steps (0.05 increments), per-channel/per-category default speed ("Tech channels 1.5x, music 1.0x"), hold-Space "speed boost 2x while held".
- **Inspiration:** Enhancer for YouTube (0.07–16x), YouTube native limits
- **Feasibility:** `Easy`
- **Why users love it:** Log 1.25x–2x pe dekhte hain; har video ke liye manually set karna painful hai.

### 2.4 SponsorBlock Integration (with categories + mute mode)
- **Kya:** `sponsor.ajay.app/api/skipSegments` se segments fetch, auto-skip: `sponsor`, `selfpromo`, `interaction`, `intro`, `outro`, `preview`, `filler`, `music_offtopic`. **Highlight** → "jump to best part" button. Music category ke liye **mute instead of skip** (gaana kaat na jaye).
- **Inspiration:** SponsorBlock extension + FreeTube/LibreTube integration
- **Feasibility:** `Easy`–`Medium` — Rust me fetch + cache (video duration se TTL), player side `timeupdate` watcher. **Privacy mode:** hash-prefix endpoint `GET /api/skipSegments/{sha256(videoID)[:4]}` use karo (server ko poora video ID na de).
- **Why users love it:** "10 minute video = sirf 6 minute content." Ye single feature hi FreeTube/Grayjay ka biggest retention driver hai.

### 2.5 Custom Chapters (community + personal)
- **Kya:** Video ki auto-chapters (description parse) + **aapke apne chapters** ("Interview 12:30 se"). Community chapters export/share karo (v2).
- **Inspiration:** YouTube chapters + SponsorBlock `chapter` category
- **Feasibility:** `Easy` (description regex: `^\d+:\d{2}` lines) / `Medium` (share server)
- **Why users love it:** Long podcasts/lectures me navigation. Official app me custom chapter nahi hota.

### 2.6 Gesture Controls (mobile-first)
- **Kya:** Double-tap left/right = ±10s, vertical slide left = brightness, right = volume, 3-finger tap = screenshot, long-press = 2x, swipe down = minimize to mini-player.
- **Inspiration:** LibreTube player gestures, MX Player, official YouTube mobile
- **Feasibility:** `Medium` (React touch handlers; brightness/volume native plugin chahiye — `tauri-plugin-*` ya custom Rust)
- **Why users love it:** One-hand usage. Official app ke gestures limited hain aur customize nahi hote.

### 2.7 Sleep Timer + "Stop at N minutes" + Fade-out
- **Kya:** 15/30/45/60 min, "end of this video", "2 videos more", gradual volume fade last 30s.
- **Inspiration:** Podcast apps, NewPipe sleep timer
- **Feasibility:** `Easy`
- **Why users love it:** Raat ko sone se pehle — YouTube ka sleep timer 2026 tak bhi unreliable/limited hai.

### 2.8 Keyboard Shortcuts (fully remappable)
- **Kya:** `j/k/l` seek, `,/.` frame-step (±1/30s via pause+seek), `[`/`]` speed, `a`/`b` markers, `s` screenshot, `t` theater, `f` fullscreen, `n` notes, `Shift+P` PiP. Custom bindings + cheat-sheet overlay (`?`).
- **Inspiration:** Enhancer for YouTube, FreeTube shortcuts, mpv
- **Feasibility:** `Easy` (global hotkeys: `tauri-plugin-global-shortcut`)
- **Why users love it:** Desktop power users keyboard se 3x fast hote hain. YouTube ke shortcuts fix hain, remap nahi ho sakte.

### 2.9 Mini-Player / PiP / Multi-Window
- **Kya:** "Always on top" chhota player window (Tauri `alwaysOnTop`, `skipTaskbar`), draggable + resizable, video continue. Plus native PiP, plus multiple watch windows side-by-side.
- **Inspiration:** FreeTube multi-window + mini player, NewPipe popup
- **Feasibility:** `Medium` (auxiliary Tauri window + IPC state sync)
- **Why users love it:** Kaam karte waqt corner me lecture chalna. Official YouTube PiP platform-locked hai (mobile pe Premium only).

### 2.10 Volume Boost + Normalizer + Mono downmix
- **Kya:** 200%–400% volume boost (Web Audio `GainNode` — note: cross-origin iframe ka audio capture nahi ho sakta, to ye **sirf local/Download Vault files pe** kaam karega), dialog normalize (-14 LUFS), mono for single earbud.
- **Inspiration:** Enhancer for YouTube (10x boost)
- **Feasibility:** `Medium` — **Engine B me 100% possible** (aapke paas raw audio stream/file hai → `GainNode` freely kaam karega; ya mpv me `volume-max=400`). Engine A (iframe) me cross-origin audio capture nahi hota, wahan sirf player volume 100% tak.
- **Why users love it:** Quiet interview audio, purani recordings, phone speaker pe lecture sunna.

### 2.11 Resume Intelligence ("Continue Watching")
- **Kya:** Har video ka progress locally save (per device + synced), "Resume from 12:40" chip, auto-skip to last position. "Rewind 10s" jab wapas aao (context reload).
- **Inspiration:** Netflix-style; NewPipe position history
- **Feasibility:** `Easy` (SQLite `progress` table, `getCurrentTime` 5s throttle)
- **Why users love it:** YouTube ka resume cross-device hi karta hai, par app-bahar / anonymous mode me nahi. Yahan sab local.

### 2.12 Screenshot & Clip Export
- **Kya:** `s` se frame capture → PNG in gallery folder with video title+timestamp in filename; "clip 15s" (loop + screen-record via Rust/ffmpeg for vault files).
- **Inspiration:** FreeTube screenshots
- **Feasibility:** `Easy`–`Medium` — **Engine B me trivial**: mpv/ffmpeg se exact frame (`ffmpeg -ss <t> -i input -frames:v 1`), ya `<video>` + canvas (same-origin blob hone se taint nahi hota). Engine A me canvas taint issue hai → wahan native screen capture.
- **Why users love it:** Notes/thumbnails/slides ke liye frames chahiye. Ab **exact 4K frame** mil sakta hai.

### 2.13 Audio-Only Mode / "Radio mode"
- **Kya:** Video hide karke artwork + waveform + controls (podcast feel). Sirf **audio stream** fetch hota hai (m4a/opus ~50 kbps) → **data 90% bachta hai**, battery bhi.
- **Inspiration:** NewPipe "load only audio", YouTube Music
- **Feasibility:** `Easy` — Engine B me stream picker se sirf audio track lo. Background playback ke saath ye combo **YouTube Premium ka #1 feature free me** hai.
- **Why users love it:** Lecture/podcast/music — screen dekhe bina, data bachake, phone lock karke.

---

## 5. Category 3 — Productivity, Learning & Study Mode

### 3.1 Timestamped Markdown Notes ("Smart Notes")
- **Kya:** Note likho → current timestamp auto-attach. Note pe click = video us second pe jump. Notes per-video + per-playlist (course) level, markdown preview, export `.md`.
- **Inspiration:** Coursera/Udemy notes, Obsidian users, "video-note" tools
- **Feasibility:** `Easy`–`Medium`
- **Why users love it:** "12:40 pe jo bola" — YouTube comments me timestamp spam isi liye hota hai. Yahan private aur organized.

### 3.2 Clip Bookmarks / "Saved Moments"
- **Kya:** Ek click me moment save (thumbnail + 10s context + tag). "Clips" gallery, filter by tag/channel, export as GIF/short clip (vault files se).
- **Inspiration:** FreeTube bookmarks, LibreTube playlist bookmarks
- **Feasibility:** `Easy`
- **Why users love it:** Cooking step, funny line, code snippet — "video dhoondhna" band.

### 3.3 Transcript Viewer + In-Video Search
- **Kya:** Full transcript panel (auto-scroll, click-to-seek), `Ctrl+F` inside transcript, "is word ko 5 baar bola" markers, copy-with-timestamp.
- **Inspiration:** YouTube transcript panel, Piped, `youtube-transcript` libs
- **Feasibility:** `Medium` — captions official API se limited hain; `timedtext` endpoint ya `[Unofficial / Risky]` InnerTube captions. **Safe fallback:** `captions.list` (OAuth, owner-only) nahi chalega — to timedtext scrape with graceful degradation.
- **Why users love it:** "kitne minutes pe bola tha..." — 3 ghante ka podcast 10 second me search.

### 3.4 Local AI Summarizer & Q&A (on-device)
- **Kya:** Transcript → "TL;DR 5 bullets" → "is video se 10 questions" → chat with video ("iska conclusion kya hai?"). Model: `llama.cpp` / `candle` (Rust) + GGUF (Phi-3 / Qwen2.5-1.5B / Gemma-3n) → **100% offline**, ya optional Ollama / bring-your-own OpenAI key.
- **Inspiration:** YouTube's AI summaries (Premium only), Glasp/8ify, various extensions
- **Feasibility:** `Medium`–`Hard` (bundling model = 1–2 GB; download-on-first-use better)
- **Why users love it:** YouTube ka AI summary sirf Premium + US/limited languages. Yahan offline + Hindi/Hinglish transcripts pe bhi.

### 3.5 Recall Cards / Flashcards from video
- **Kya:** Notes se ya transcript se auto flashcard (Q/A), spaced repetition (SM-2) schedule, daily "review 10 cards" streak. Card pe "jump to source timestamp".
- **Inspiration:** Anki + learners; *koi OSS YouTube client ye nahi karta*
- **Feasibility:** `Medium`
- **Why users love it:** Video dekhna = passive; card = retention. Students ke liye killer.

### 3.6 Focus / Distraction-Free Mode ("Zen Watch")
- **Kya:** Sirf video + notes, koi sidebar/next-up/comments nahi. Optional fullscreen dim, "study playlist" ke saath auto-advance, pomodoro overlay (25 min watch + 5 min break).
- **Inspiration:** Unhook (element kill list), FreeTube distraction-free settings
- **Feasibility:** `Easy`
- **Why users love it:** YouTube ki poori UI hi distraction machine hai; ek toggle se "library" ban jata hai.

### 3.7 Watch-Time Budget & Limits ("Attention OS")
- **Kya:** Daily budget (e.g. 45 min), per-category budget (Shorts 10 min, Entertainment 20 min), family/PIN lock, "aaj 5 min bache hain" toast, weekly report. Local-only, no cloud.
- **Inspiration:** Digital Wellbeing (Android), iOS Screen Time, Unhook's philosophy
- **Feasibility:** `Easy`–`Medium` (timer service + enforcement layer)
- **Why users love it:** Official app me reminder ignore kar sakte ho; yahan app khud pause ho jata hai.

### 3.8 Course Mode (playlist → syllabus)
- **Kya:** Playlist ko "course" banao: ordered lessons, completion ticks, per-lesson notes, progress %, certificate-style export (Markdown/PDF), "playback speed 1.25x recommended".
- **Inspiration:** Udemy/Coursera UX, FreeTube playlists
- **Feasibility:** `Medium`
- **Why users love it:** Free YouTube playlists se apna course banao, bina ads/distraction.

### 3.9 Study Sessions + Pomodoro + Stats
- **Kya:** "Study session start" → time tracked per video/channel, daily streak, "is hafte 4h 20m learning".
- **Feasibility:** `Easy`
- **Why users love it:** Motivation + proof of progress.

### 3.10 Read-It-Later Queue with time budget
- **Kya:** "Baad me dekhunga" queue jo *video duration* ke hisaab se sort ho ("5 min se kam wale pehle"), "aaj 20 min me kya cover kar sakta hoon" suggestion.
- **Feasibility:** `Easy`
- **Why users love it:** Watch Later 500 videos ka qabristan ban jata hai; ye usko actionable banata hai.

---

## 6. Category 4 — Organization, History & Cross-Device Sync

### 4.1 Google Takeout History Import
- **Kya:** Takeout ZIP/`watch-history.json` drop karo → parse `title` ("Watched X"), `titleUrl` (video ID), `subtitles[0].name` (channel), `time` (ISO) → dedupe → local history. Repeat-view counts, "2019 me kya dekha tha" time machine.
- **Inspiration:** Google Takeout + users' "my YouTube history" nostalgia; FreeTube/NewPipe imports
- **Feasibility:** `Easy`–`Medium` — Rust `serde_json` streaming parse (files GB me ho sakti hain → `simd-json`/streaming, background task with progress)
- **Why users love it:** Takeout **ke paas watch duration nahi hota** — to aap "kitna dekha" nahi bata sakte; par aap *aapke app ke* data se "minutes watched" bana sakte ho. Import ke baad YouTube-independent history ka malik user.

### 4.2 Continue Watching Sync (PC ⇄ Phone)
- **Kya:** Progress, history, notes, subs — device ke beech sync. Do options: (a) **LAN sync** (same Wi-Fi, QR pairing, Rust mDNS + local HTTP), (b) **Bring-your-own-cloud**: encrypted file in user's Google Drive / Dropbox / WebDAV / Syncthing folder. **Zero backend.**
- **Inspiration:** NewPipe has no sync (pain point!), LibreTube uses Piped account, Grayjay has no multi-device sync
- **Feasibility:** `Medium` (E2E-encrypted JSON blob, last-write-wins per row + CRDT-ish merge)
- **Why users love it:** "Phone pe aadha dekha, laptop pe wahin se" — bina Google login. **Ye aapka killer feature ban sakta hai.**

### 4.3 Smart Playlists (rule-based)
- **Kya:** "Sab recent < 7 days ke Tech folder ke videos jise maine nahi dekha", "Sab 10–20 min ke Hindi videos", "Sab videos jisme `#rust` tag hai", "Repeat-watched 3+". Rules: channel, folder, duration, tags, watched state, date, speed used.
- **Inspiration:** iTunes Smart Playlists, Jellyfin, smart feeds
- **Feasibility:** `Medium` (query DSL → SQL)
- **Why users love it:** Static playlists purani ho jati hain. Ye khud update hoti hain.

### 4.4 Queue / "Up Next" with manual control
- **Kya:** Queue me add, reorder, "play next", "add to top", duration total, auto-advance toggle, "shuffle within folder".
- **Inspiration:** NewPipe enqueue, FreeTube queue
- **Feasibility:** `Easy`
- **Why users love it:** Official app ka autoplay algorithm decides; yahan aap decide karte ho.

### 4.5 Local Watch Later / Favourites / Archive (3-tier)
- **Kya:** `Later` (queue), `Favourite` (evergreen), `Archive` (ho gaya, still searchable). Tags, colour labels, private rating + "regret" flag (post-watch "worth it / waste").
- **Inspiration:** FreeTube favourites/history, personal knowledge mgmt spirit
- **Feasibility:** `Easy`
- **Why users love it:** YouTube ke Watch Later/Playlists me structure nahi hota; ye aapki personal library hai.

### 4.6 Full Backup / Restore (portable `.tubebak`)
- **Kya:** Zip with `data.db` + `notes/` + `subscriptions.opml` + `settings.json`, optional encrypted (age/PGP). One-click restore. Also plain `OPML`/CSV export for portability.
- **Inspiration:** NewPipe Export Database, FreeTube export/import
- **Feasibility:** `Easy`
- **Why users love it:** Data lock-in se azaadi. PC badla → 1 file → sab wapas.

### 4.7 Channel Tags + Notes + Custom Names
- **Kya:** Har channel pe tags (`#bihar`, `#dev`), personal note ("is bande ka audio slow hai"), custom display name/emoji, "subscribe since 2019" metadata.
- **Inspiration:** FreeTube channel tags, Grayjay creator labels
- **Feasibility:** `Easy`
- **Why users love it:** 150 subscriptions ko brain me yaad rakhna impossible hai.

### 4.8 History Search + "Time Machine"
- **Kya:** Full-text search aapki history pe (title, channel, notes, transcript), calendar heatmap, "is din 2023 me kya dekha", "is video ko kitni baar dekha".
- **Inspiration:** Takeout stats viewers, browser history UIs
- **Feasibility:** `Easy` (SQLite FTS5)
- **Why users love it:** YouTube history search nahi deta aur 30 din me purge ho jata hai. Yahan permanent.

### 4.9 Duplicate & Dead-Link Cleanup
- **Kya:** Same video multiple playlists me, deleted/private videos ka auto-flag, "unavailable" vault me mark, bulk cleanup.
- **Feasibility:** `Easy`
- **Why users love it:** 5 saal baad playlists me 30% dead links hote hain.

### 4.10 Personal Stats Dashboard
- **Kya:** Total hours, top channels, top categories, "time reclaimed via SponsorBlock" (oh ye alag se!), streak, heatmap, monthly report card. Local only.
- **Inspiration:** Takeout stats tools, Last.fm-style scrobbling dashboards
- **Feasibility:** `Easy`–`Medium`
- **Why users love it:** "SponsorBlock ne aapke 14 ghante bachaaye" — sharable aur satisfying (screenshot export).

---

## 7. Category 5 — Social, Community & Fun Features

> Aapki app local-first hai, to "social" ka matlab mostly **community data as a service jo bina aapke server chale**, ya **user-controlled local sharing**.

### 5.1 Return YouTube Dislike Integration
- **Kya:** `returnyoutubedislikeapi.com/votes?videoId=X` → dislike count + ratio bar (classic look). **Attribution link required**, rate limit 100/min & 10k/day → Rust me cache 7 days.
- **Inspiration:** RYD extension, LibreTube
- **Feasibility:** `Easy` (public API, no key)
- **Why users love it:** Quality signal without watching. Log isko extension ke through bar bar maangte hain.

### 5.2 DeArrow (clickbait title/thumbnail fix)
- **Kya:** `dearrow.ajay.app/api/v1/branding?videoIDs=[...]` (batch) → clean titles + representative thumbnails; plus **"show original"** toggle; fallback = random frame timestamp **jo SponsorBlock segment ke bahar ho**.
- **Inspiration:** DeArrow
- **Feasibility:** `Easy`–`Medium` (batch fetch + cache, image CDN `dearrow-thumb.ajay.app`)
- **Why users love it:** Feed turant "BBC nature documentary" jaisa lagne lagta hai. Ek hi feature se app ka *look* premium ho jata hai.

### 5.3 Watch Party / Synced Rooms (LAN + optional relay)
- **Kya:** Room code/QR → do log same video sync pe dekhein (play/pause/seek broadcast), local chat + emoji reactions, "host controls" toggle. Transport: **LAN WebSocket** (zero server) ya optional WebRTC (public signalling free tier). YouTube IFrame sync drift ±300ms.
- **Inspiration:** Teleparty/Watch2Gether (proprietary), Jellyfin SyncPlay (OSS, LAN pattern)
- **Feasibility:** `Medium`–`Hard` (LAN easy, internet me STUN/TURN chahiye)
- **Why users love it:** Long-distance dost/family ke saath movie; official YouTube Watch Together (US only, limited) se behtar control.

### 5.4 Local Comments & Timestamp Notes ("my thoughts at 12:40")
- **Kya:** Video pe apne comments (private), ya shared-vault peers ke saath (agar same sync folder). Spoiler tags, "saw this 3 times" context.
- **Inspiration:** Hypothesis (web annotation), SoundCloud comments (visualize at timestamp)
- **Feasibility:** `Easy`–`Medium`
- **Why users love it:** YouTube comments 90% noise; yahan aapke apne insights timeline pe.

### 5.5 Creator Collections / "Curated Shelves"
- **Kya:** Khud ke "curator" bano: kisi topic pe 8 best videos ki shelf (`Rust in 2026`, `Bihar history`), share as `.json`/link, import from friends.
- **Inspiration:** Spotify playlists, YouTube "creator collections" nahi hota
- **Feasibility:** `Medium` (export/import easy, discovery ke liye hosting chahiye)
- **Why users love it:** Friends se recommendation, algorithm se nahi.

### 5.6 Public API Community Metadata (read-only extensions)
- **Kya:** SponsorBlock submissions (aap khud contributor ban sakte ho: "mark chapter"), RYD votes — read-only + opt-in contribution.
- **Feasibility:** `Medium` (submit flows)
- **Why users love it:** Community ka hissa banne ka feel; aapka app "alive" lagta hai.

### 5.7 Share Cards / "Now Watching" snippets
- **Kya:** Video ka screenshot + timestamp + note ka PNG card banao (Discord/WhatsApp pe share).
- **Feasibility:** `Easy` (canvas / Rust image crate)
- **Why users love it:** Notes/funny moments share karne ka easy tarika.

### 5.8 Achievements / Streaks (fun, local)
- **Kya:** "50 ghante bachaye SponsorBlock se", "100 lessons complete", "10 din streak", "0 Shorts week".
- **Feasibility:** `Easy`
- **Why users love it:** Gamification = retention, aur *positive* gamification (junk nahi).

---

## 8. Category 6 — UI/UX, Mobile + Desktop Ergonomics

### 6.1 OLED / AMOLED True-Black Themes + Dynamic Colour
- **Kya:** Theme engine: OLED black, dim-grey, sepia/reading, high-contrast; Material You dynamic colour from thumbnail; per-profile accent.
- **Inspiration:** LibreTube Material 3 Expressive, Materialious
- **Feasibility:** `Easy` (CSS variables + Tailwind tokens)
- **Why users love it:** Battery + eyes; YouTube ka dark mode "dark grey" hai, OLED nahi.

### 6.2 Responsive One-Handed Mobile UI
- **Kya:** Bottom nav (Home/Subs/Library/Search/You), floating thumb-zone action bar, bottom-sheet menus, pull-down-to-refresh, large tap targets, swipe-back custom.
- **Inspiration:** LibreTube/NewPipe mobile patterns
- **Feasibility:** `Medium` (Tauri mobile build + safe-area insets)
- **Why users love it:** 6.7" phones pe top-left menu tak pahunch na possible.

### 6.3 Desktop Split-View / Theater / Cinema modes
- **Kya:** 3 layouts: (a) **Split** — video left, notes/transcript/comments right, resizable panels + persisted widths; (b) **Theater** — wide video, no chrome; (c) **Cinema** — dim everything except video.
- **Inspiration:** Enhancer for YouTube theater, "Turn Off the Lights" cinema, IDE split panes
- **Feasibility:** `Easy`–`Medium`
- **Why users love it:** Desktop pe multitask: video + notes + docs. YouTube ka theater mode fixed hai.

### 6.4 Customizable Navigation Bar
- **Kya:** Kaunse items sidebar/bottom-nav me dikhein, order, icons, "hide Shorts tab forever", collapse-to-icons mode.
- **Inspiration:** Unhook, VS Code activity bar customization
- **Feasibility:** `Easy`
- **Why users love it:** "Mujhe Trending kabhi nahi chahiye" — permanent solution.

### 6.5 Command Palette (Ctrl+K)
- **Kya:** Ek box me: search video, channel, "go to folder", "start focus mode", "open notes", "download this". Keyboard-first.
- **Inspiration:** VS Code/Linear/Raycast pattern; **koi YouTube client ye nahi karta**
- **Feasibility:** `Easy`–`Medium`
- **Why users love it:** Power users 5x fast; app ko "pro tool" feel deta hai.

### 6.6 Accessibility & Deep Localization
- **Kya:** Hindi/Bhojpuri/Marathi UI, screen-reader labels, captions font/size/background controls, keyboard-only navigation, colour-blind safe badges, dyslexia-friendly font option.
- **Feasibility:** `Medium` (i18n + a11y audit)
- **Why users love it:** India-first audience ke liye bada differentiator; YouTube Hindi UI achha par limited control.

### 6.7 Onboarding as "Feed Contract"
- **Kya:** Pehli baar app khulne pe: "Aapka home kaisa ho?" → Circles/toggles (Sirf Subscriptions / Balanced / Explore) + "Shorts chahiye?" + "kitna time/day?" — 3 screen, phir app us contract ko respect karta hai.
- **Feasibility:** `Easy`
- **Why users love it:** Intent set karna = better retention aur "ye app mujhe samajhta hai" feeling.

### 6.8 Offline-First Shell / Instant Startup
- **Kya:** Rust SQLite + cached thumbnails, `tauri` window instant, skeleton loaders, full keyboard nav while data loads. Downloads ka local library offline browse.
- **Feasibility:** `Easy`–`Medium`
- **Why users love it:** Electron-based clients slow lagte hain; Tauri ka 8MB binary + instant feel = marketing point.

### 6.9 Thumbnail Density & "Compact Mode"
- **Kya:** 3 densities (comfortable 2-col / compact list with duration+duration-watched bar / grid). "Unwatched-only" filter, watched progress bars on thumbnails.
- **Feasibility:** `Easy`
- **Why users love it:** Info density control; 100 videos scan karne ke liye list better.

### 6.10 Multi-Window & Tray
- **Kya:** System tray: mini-player, "pause all ", quick "play next from queue", download progress. Multiple windows (notes window alag).
- **Feasibility:** `Medium` (tray plugin + window mgmt)
- **Why users love it:** Desktop-native feel; app band karne pe bhi music chale.

---

## 9. LOCAL VAULT — Download, Gallery & Offline (aapka special ask)

Ye poora section aapke "sab kuch mere computer me, download bhi ho aur gallery me bhi aaye" requirement ke liye hai. Store nahi hai, to **koi feature cut nahi** — sab full-power. Phir bhi code alag module (`vault` crate) me rakho, sirf **maintenance** ke liye (download code todta hai, player nahi todna chahiye).

### 9.1 Vault Architecture (desktop)
```
UI (React) ──invoke──> Rust command: vault_download(video_id, preset)
                            │
                            ├─ metadata: yt-dlp -J (or Data API for safe mode)
                            ├─ job row in SQLite (status, progress, attempts)
                            ├─ spawn: yt-dlp -f bv*+ba/b -o "<path>/%(title)s [%(id)s].%(ext)s"
                            │           --embed-metadata --embed-thumbnail --embed-chapters
                            │           --download-archive archive.txt
                            ├─ events: emit "vault://progress" {id, pct, speed, eta}
                            └─ post: ffmpeg (merge/convert), sidecar .json + .vtt captions
```
- **Presets:** `1080p MP4 (H.264, universal)`, `4K`, `720p data-saver`, `Audio only M4A`, `Audio MP3 320`, `Shorts mode (vertical)`, `Subtitles only`.
- **Queue:** concurrency 2, resume, retry, bandwidth cap, Wi-Fi-only flag, "queue when idle".
- **Bundling:** `yt-dlp` + `ffmpeg` sidecars `src-tauri/binaries/` me, target-triple naam (`yt-dlp-x86_64-pc-windows-msvc.exe`), SHA-256 pinned. Note: macOS codesigning/notarization me sidecars ko `externalBin` list me daalna padta hai.
- **Auto-update yt-dlp:** app khud GitHub releases se binary update kar sake (jaise youtube-playlist-downloader karta hai) — warna YouTube break karega.

**Practical notes (personal build):**
1. **yt-dlp auto-update** mandatory — Settings me "Update extractor" button + app start pe weekly silent check. Warna 2–3 mahine me YouTube tod dega.
2. **Cookies import** — age-restricted / members-only / "confirm you're not a bot" ke liye `cookies.txt` (browser extension se export) settings me drop karo. **Burner Google account** use karo, main account nahi (technical risk kam rakhne ke liye).
3. **`--download-archive`** rakho — same video dobara download na ho, aur "already in vault" instantly detect ho.
4. **Storage math** dikhao: 1080p ≈ 250–500 MB/hour, 4K ≈ 1.5–2 GB/hour, audio ≈ 60 MB/hour — phone pe preset suggest karo accordingly.
5. **Bulk playlist / channel download** — "pura folder offline kar do" (NewPipe-style), queue me concurrency 2, resume support.

### 9.2 Gallery Integration (phone + desktop)
- **Android:** MediaStore me save → `Movies/LocalTube/<Channel>/<Title>.mp4` → **Gallery app me automatically dikhega**. Rust: MediaStore insert via `jni`/`tauri-plugin-fs` + `MediaScannerConnection.scanFile`. Android 10+ ke liye `MediaStore.Video` insert (no broad storage permission needed).
- **iOS:** Downloads app folder (`Documents/LocalTube/`) + **Photos me export** (`PHPhotoLibrary` permission) → camera roll me video save.
- **Desktop:** `~/Videos/LocalTube/` default; settings me custom folder; sidecar `.json` (metadata + notes + chapters), `.jpg` (thumbnail), `.vtt` (captions) — Plex/Jellyfin/VLC ready structure.
- **"Gallery" tab in-app:** local files ka grid (thumbnail + duration + watched progress), filter by channel/tag, "Play local" (native video tag — yahan **custom overlay full control + SponsorBlock still works** kyunki aap khud file play kar rahe ho).

### 9.3 Download-Triggered Extras (ye "wow" hai)
- Download karte waqt: **SponsorBlock segments ko ffmpeg se physically cut** kar do (preset: "Sponsor-free copy") — file me sponsor segment hi na ho. Legal-safe: apne personal offline copy pe.
- **Auto chapters embed** + thumbnail embed + subtitles embed (`--embed-chapters --embed-subs`).
- **Audio-only + loudnorm** → `-14 LUFS` normalized copy (volume boost feature ka safe version).
- **Transcript sidecar** → notes/AI summary ke liye offline available.
- **"Vault Notes"**: har downloaded video ke saath `.md` file (aapke timestamped notes) → obsidian/jellyfin ke saath portable.

### 9.4 Storage Manager
- Per-channel/per-folder disk usage, "purge watched downloads older than 30 days", "keep only notes + timestamps", quota alerts, move vault to another drive.

### 9.5 Dead-Simple UX
- Player me ek button: **"Download"** → preset sheet → progress chip → completion notification with "Open in folder / Open in Gallery".
- Feed me: long-press/right-click → "Download for offline", "Download audio", "Sponsor-free copy".

---

## 10. Rebuilt MVP Plan (personal app — ad-free + download pehle din se)

Store nahi hai, to priority badal gayi: **jo features aap roz use karoge wo pehle**, "polish" baad me. Ye 10 features v1 me hone chahiye — roughly **7–9 hafte**.

| # | Feature | Kyun pehle (personal use) | Effort |
|---|---|---|---|
| 1 | **Extraction layer (Engine B)** — yt-dlp sidecar + youtubei.js fallback, `MediaResolver` interface | Iske bina na ad-free, na download. **Yahi app ka engine hai** | 6–8 d |
| 2 | **Native player + apna UI** (`<video>` v1 → libmpv v1.5) — speed 0.05–16x, quality picker, A-B loop, keyboard, PiP, resume | YouTube ka player hi nahi → koi ad, koi endscreen, koi "watch on YouTube" | 8 d |
| 3 | **RSS subscriptions + folders** (zero quota) | Feed ka dil; YouTube app se behtar control | 4 d |
| 4 | **Local SQLite: history + Continue Watching + queue** | Data apna; resume PC pe bhi, phone pe bhi | 3 d |
| 5 | **Download Vault + Gallery** (1080p/4K/audio presets, MediaStore, `~/Videos/LocalTube`) | Aapki original requirement — **v1 me hi, v1.1 me nahi** | 6 d |
| 6 | **SponsorBlock skip** (Engine B me auto-skip, download time pe physical cut) | Video ka asli content hi bache | 3 d |
| 7 | **Background audio + audio-only mode** (native service) | "YouTube Premium free" ka #1 feature | 3 d |
| 8 | **DeArrow + RYD** (batch + cache) | Feed clean + quality signal | 2 d |
| 9 | **Import: Takeout subs + watch-history.json + backup** | Purana data naye app me | 4 d |
| 10 | **Search** (local FTS + InnerTube/Data API + autocomplete) + **OLED theme** | Completeness + roz dekhne layak look | 5 d |

**v1 me ab kya NA rakhein:** Watch Party, AI summary, multi-source plugins (PeerTube/Twitch), encrypted cloud sync. Ye v1.5–v2.0 — aur ab inke liye koi limitation nahi, bas time ki baat hai.

**Order ka logic:** #1 aur #2 sab kuch decide karte hain. Agar extraction + native player chal gaya, to baaki features "add-on" hain. Agar pehle UI banao aur player baad me, to 3 hafte ka UI kaam dobara karna padega.

**Realistic breakage plan (personal app ka sach):**
- YouTube ~2–3 mahine me kuch change karta hai. Isliye **`MediaResolver` ko pluggable** rakho: (a) yt-dlp sidecar, (b) youtubei.js, (c) Invidious/Piped public instance, (d) official embed. Ek fail → next. **App kabhi dead na ho.**
- Settings me "Playback → Engine: Auto / yt-dlp / InnerTube / Official embed" — debug ke liye gold.
- Har breakage ka fix **1–2 ghante** ka hona chahiye, kyunki sirf extractor layer badalna hoga.

---

## 11. 5 Unique "Killer Features" (jo FreeTube/NewPipe/Grayjay me bhi nahi hain)

### ⭐ 1. Attention OS (Watch-Time Budget + Per-Channel Rules/SLA)
Sirf timer nahi — **rules engine**. Har channel/folder pe contract: `"Tech folder: sirf weekend, max 3 videos/week"`, `"Shorts: 10 min/day"`, `"Music: unlimited"`. App enforce karta hai: Monday ko Tech feed *locked* dikhta hai ("Saturday ko khulega"). Budget khatam = player pause + "aaj ka quota done" screen.
**Kyun unique:** YouTube/Digital Wellbeing sirf total time count karte hain; *rule-level governance* koi nahi deta. Ye app ko "YouTube ka strict parent mode for adults" bana deta hai.
**Feasibility:** `Medium` (rules JSON + enforcement middleware + local scheduler).

### ⭐ 2. "Why am I seeing this?" — Transparent Local Recommender
Home feed ka har card pe chhota chip: *"Kyunki tumne 3 Tech videos dekhe"*, *"Tech folder ka sabse purana unwatched"*, *"Tumhare notes me `rust` 5 baar aaya"*. Saath me ek **weight sliders panel** (Recency / Depth / Novelty / Same-channel-saturation) — slider ghumao, feed turant badal jaye. Sab local, koi ML API nahi.
**Kyun unique:** Transparency = trust. Koi OSS client recommender nahi deta, aur jo deta hai (Grayjay) explain nahi karta. Ye research/demo me bhi sexy lagta hai.
**Feasibility:** `Medium` (SQL scoring function + explain tags).

### ⭐ 3. Recall Cards — "Video → Retention" loop (spaced repetition built in)
Transcript + aapke notes se quiz/flashcard banao, SM-2 scheduler, daily 10-card review streak, aur har card pe "source timestamp" jump. "Aapne 40 ghante dekhe, 320 cards banaye, 74% retention."
**Kyun unique:** Koi bhi YouTube client *learning outcome* measure nahi karta. Offline AI se auto-generate = no server cost, no API key.
**Feasibility:** `Medium`–`Hard` (AI optional; manual cards = Easy).

### ⭐ 4. Bring-Your-Own-Cloud Encrypted Sync (zero backend, multi-device)
Progress/notes/subs ka **E2E-encrypted single blob** user ke apne Google Drive / Dropbox / WebDAV / iCloud / Syncthing folder me. App ko koi server nahi chahiye, aapko bhi nahi. QR se device pairing, conflict resolution UI (per-row merge), "sync now" + background.
**Kyun unique:** FreeTube/NewPipe me sync nahi (sabse bada complaint), LibreTube Piped account maangta hai (third-party trust). Aap **bina kisi cloud account** ke sync dete ho — privacy purists + normal users dono khush.
**Feasibility:** `Medium` (XChaCha20 encryption + Drive/WebDAV API + merge logic). v1 me LAN-only sync (2 din ka kaam), cloud v1.5.

### ⭐ 5. Research Bundle Export (video → self-contained knowledge artifact)
Ek click me: video ke **downloaded clip + transcript + aapke timestamped notes + chapters + AI summary + screenshots** → ek `.zip` ya single **HTML file** jo kisi ko bhi bhejo, offline khulti hai, YouTube links bhi kaam karte hain. "Course bundle" bhi (playlist ka poora bundle).
**Kyun unique:** Koi client notes ko *portable artifact* nahi banata. Ye teachers, students, researchers ke liye instant value + organic sharing (marketing loop).
**Feasibility:** `Medium` (HTML templating + zip + clip export). Ab clip bhi full-power.

*Bonus ideation (v2+):* **Global Time-Warp Search** ("us video me kya bola tha jo maine pichle mahine dekha" — transcript FTS across archive), **Audio-Only Podcast Mode with chapters + sleep timer**, **"Regret Index"** (post-watch 1-tap rating jo recommender ko train kare), **Focus Flight** (pomodoro + auto-pause at break).

---

## 12. Risk reality (personal build) — "ban" nahi, "breakage" ka plan

Store ka darr gaya. Ab sirf **teen practical risks** hain aur har ek ka concrete plan hai:

| Risk | Kitna realistic | Plan |
|---|---|---|
| **Extractor breakage** (YouTube change se yt-dlp/InnerTube band) | **100% hoga**, har 1–3 mahine | 4-layer fallback chain (yt-dlp → youtubei.js → Invidious/Piped → official embed) + yt-dlp auto-update + "Engine: Auto" setting |
| **"Sign in to confirm you're not a bot" / 403** | Kabhi-kabhi, khaas kar VPN/datacenter IP pe | Cookies import (burner account), PO Token provider (`bgutil-ytdlp-pot-provider`), ya ghar ka normal IP. `--extractor-args` se client rotate |
| **Google account flag** (agar cookies use karo) | Low, par zero nahi | **Burner Google account** se cookies lo, main account se nahi. Cookies sirf tab lagao jab video na chale (default: anonymous) |
| **Local AI model size** | 1–2 GB download | Download-on-first-use (GGUF), ya Ollama. Optional feature |
| **Watch Party internet pe** | TURN server chahiye | LAN-only v1 (muft), WebRTC P2P v2 |
| **Screenshot iframe se (Engine A)** | canvas taint | Engine B me problem hi nahi (local stream/file) |

**Golden rule:** har network/extractor call ke liye **timeout + fallback + friendly error** — app "kuch nahi chal raha" state me kabhi na jaye.

---

## 13. Aage kya (next step options)

Ab jab store ki limit nahi hai, mera **strong recommendation** ye order hai:

1. **Extraction spike (2–3 din)** — ek chhota Rust/Tauri command jo yt-dlp se stream URL laaye aur `<video>` me play kare. Agar ye chal gaya, app baki sab se pehle **ad-free** ho jayega. Sabse bada risk + sabse bada reward — pehle isko test karo.
2. **Player shell** — custom overlay + quality/speed/A-B loop + resume (2 hafte ka core kaam).
3. **RSS feed + SQLite** — subscriptions, folders, history, Continue Watching.
4. **Vault** — download + gallery + sponsor-cut. (Aapki original demand.)
5. Baaki — SponsorBlock, DeArrow/RYD, import, search, themes.

> `docs/implementation-playbook.md` me: Tauri module structure, SQLite schema (copy-paste ready), `MediaResolver` interface + yt-dlp pipeline, quota-safe ingest, SponsorBlock/DeArrow client code, sync design, aur revised roadmap hai.

**Bolo to main abhi shuru karta hoon:**
- **(a)** `MediaResolver` + yt-dlp extraction ka working prototype (Rust command + minimal player page) — isse pata chal jayega ki ad-free playback aapke machine pe chalta hai ya nahi.
- **(b)** Poora Tauri v2 + React + SQLite scaffold (feed + player + vault skeleton).
- **(c)** UI design system (OLED + player overlay + bottom nav).

Mera vote: **(a)** — 2–3 din me pura project ka bhavishya clear ho jayega.
