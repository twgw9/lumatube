# LocalTube — Research & Feature Blueprint
### Ek Local-First, Cross-Platform YouTube Client (Tauri v2 + Rust + React/TS)

> **Document ka maksad:** popular open-source YouTube clients, frontends aur browser extensions ka deep research karke aapke app ke liye best features, workflows aur power-user ideas nikalna — aur unhe saaf categories me + feasibility tags ke saath rakhna.
>
> **Aapka core requirement (jo aapne baad me bataya):** *"sab kuch user ke computer me rahe"* — yaani **local-first**, koi hamara server nahi, user ka data user ka. Saath me **video download + SponsorBlock + downloads gallery/album me** jaise features.
>
> **Legend (Feasibility):**
> `Easy` = hafte ke andar ban jayega · `Medium` = 1–3 hafte · `Hard` = 3+ hafte ya deep platform work
> `[Unofficial / Risky]` = YouTube Terms of Service ke against ja sakta hai, ya official API me support nahi hai — app store rejection / account risk / breakage ka chance hai.
> Har risky feature ke saath **safe alternative** diya gaya hai.

---

## 0. TL;DR — 60 second summary

1. **Local-first bilkul possible hai** aur ye aapka sabse bada USP hai. SQLite (Rust side) + user ke apne cloud (WebDAV / Google Drive / iCloud) = zero server cost, full privacy. FreeTube, NewPipe, Grayjay sab yahi model chalate hain.
2. **Playback ke liye official IFrame Player API hi lein** — ye legal + stable hai, par iske 3 hard limits hain: (a) **ads hatana possible nahi**, (b) kuch videos embed-disabled hote hain, (c) Tauri me **Error 153 (referer)** ka production issue aata hai — usko pehle din solve karna hai (§1.3).
3. **Ad-free + background audio + full download** sirf tab possible hai jab aap unofficial extraction (NewPipe Extractor / yt-dlp / InnerTube) use karein — ye `[Unofficial / Risky]` hai. Desktop + side-loaded builds me theek, **Play Store / App Store me reject hoga**.
4. **SponsorBlock, DeArrow, Return YouTube Dislike — teeno ka public API free hai** aur official IFrame player ke saath *perfectly legal* kaam karta hai (kyunki ye video ke andar ke segments skip karta hai, ads nahi). Ye teen aapke app ke "wow" ka core hain.
5. **Data API v3 quota** = 10,000 units/day, `search.list` = 100 units per call. Isliye **RSS feed (15 latest per channel, no key, no quota) + aggressive SQLite caching** hi aapki feed strategy honi chahiye.
6. **MVP 10 features** §9 me hain. **5 killer features** §10 me hain — jo FreeTube/NewPipe/Grayjay me bhi nahi hain (jaise *Watch-Time Budget OS*, *per-channel rules/SLA*, *Recall Cards*, *Local "Why am I seeing this?"*).

---

## 1. Reality Check — pehle ye samajh lo (bahut important)

### 1.1 Official embed ke saath kya possible hai, kya nahi

| Cheez | Official IFrame Player API | Note |
|---|---|---|
| Custom UI overlay (apne buttons, gesture layer) | ✅ Haan | `controls=0` + apna React overlay; par YouTube branding/attribution remove nahi kar sakte |
| Playback speed | ✅ Haan | `setPlaybackRate()` — safe range 0.25x–2x |
| A-B loop | ✅ Haan | `seekTo()` + `getCurrentTime()` polling |
| Chapters, PiP, fullscreen | ✅ Haan | Browser PiP = `requestPictureInPicture` / Tauri window |
| **Pre-roll / mid-roll ads hatana** | ❌ **Nahi** | Player khud ads serve karta hai. Hiding them = ToS violation + quota/API ban risk |
| Background audio (screen off) | ⚠️ Limited | Mobile OS webview pause kar deta hai. Sirf unofficial audio-stream extraction se |
| Offline download | ❌ Nahi | Embed API offline storage support nahi karta |
| Age-restricted / members-only / embed-disabled videos | ❌ Nahi | Player error dega — graceful UI chahiye |
| Custom subtitles/transcript | ⚠️ Partial | `getOption('captions')` + `player.getOptions()`; full transcript ke liye Data API captions ya transcript fetch |

> **Seedha point:** agar aapka product promise "ad-free YouTube" hai, to officially wo *nahi* ban sakta. Aapka promise hona chahiye: **"Distraction-free, algorithmic-feed-free, data-owning YouTube"** — ye 100% legit hai aur log isi ke liye FreeTube use karte hain.

### 1.2 Download ka sach (aapne specifically poocha)

- YouTube ToS: videos download karna (except via YouTube app's own offline feature) **allowed nahi** hai. Publicly bolna padega: *personal/offline archival use, user ki responsibility*.
- **Play Store / App Store pe general-purpose downloader = guaranteed reject.** Desktop builds (GitHub Releases, .dmg, .AppImage, .msi) me ye chalta hai — **free + side-loaded** distribution ke liye theek hai.
- Store-safe alternative: download feature ko **"import your own content only"** (apne channel ke videos, ya CC-licensed videos — `videoLicense=creativeCommon` filter) tak restrict karna, ya **feature flag** karke store build me off rakhna (`#[cfg(feature = "vault")]`).
- Technical path: `yt-dlp` + `ffmpeg` **sidecar binaries** Tauri ke saath bundle karna (ye 2026 me standard pattern hai — Keepsake, video-plucker, youtube-playlist-downloader sab yahi karte hain). Android pe `youtubei.js` + `ffmpeg.wasm` fallback.

### 1.3 ⚠️ Pehla blocker jo aapko day-1 solve karna hai — **Tauri Error 153**

Tauri production build me app `tauri://localhost` protocol pe chalta hai. YouTube IFrame API ko valid **HTTP(S) Referer** chahiye. Dev me `http://localhost:1420` kaam karta hai, **production me video "Error 153 — Video player configuration error" deta hai.** Ye ek known upstream limitation hai (tauri#14422).

**3 options (recommended order):**
1. **Wrapper page on your own HTTPS domain** (best): ek chhoti `yt-embed.html` aapke domain pe host karo (`https://embed.yourdomain.com/yt.html?v=ID`). App usko `<iframe>` kare; wo page andar se `youtube-nocookie.com/embed/...` load karta hai. Commands (`play/pause/seek/time`) `postMessage` bridge se aate hain. YouTube ko valid real referer milta hai, IPC intact rehta hai.
2. `tauri-plugin-localhost` (app `http://localhost:PORT` pe serve ho) — YouTube chalta hai par IPC/capabilities ko explicitly trusted likhna padta hai; maintenance heavy.
3. Custom protocol handler jo `Referer` header inject kare — WebView2/WebKit me inconsistent. Avoid unless desperate.

> Isko MVP se pehle spike karo (1 din). Agar ye fix na ho to poora player plan hi badalna padega.

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
- **Feasibility:** `Medium` + `[Unofficial / Risky]` (cross-origin audio) — **safe alternative:** sirf apne downloaded/offline files pe apply karo (Rust me `ffmpeg` loudnorm).
- **Why users love it:** Quiet interview audio, purani recordings.

### 2.11 Resume Intelligence ("Continue Watching")
- **Kya:** Har video ka progress locally save (per device + synced), "Resume from 12:40" chip, auto-skip to last position. "Rewind 10s" jab wapas aao (context reload).
- **Inspiration:** Netflix-style; NewPipe position history
- **Feasibility:** `Easy` (SQLite `progress` table, `getCurrentTime` 5s throttle)
- **Why users love it:** YouTube ka resume cross-device hi karta hai, par app-bahar / anonymous mode me nahi. Yahan sab local.

### 2.12 Screenshot & Clip Export
- **Kya:** `s` se frame capture → PNG in gallery folder with video title+timestamp in filename; "clip 15s" (loop + screen-record via Rust/ffmpeg for vault files).
- **Inspiration:** FreeTube screenshots
- **Feasibility:** `Medium` (iframe canvas taint → **safe path:** capture WebView screen region natively, ya official thumbnail + timestamp card)
- **Why users love it:** Notes/thumbnails/slides ke liye frames chahiye.

### 2.13 Audio-Only Mode / "Radio mode"
- **Kya:** Video hide karke artwork + waveform + controls (podcast feel), data saving. Official embed me video still loads, **par local vault files pe true audio-only**.
- **Inspiration:** NewPipe "load only audio", YouTube Music
- **Feasibility:** `Easy` (UI) / `[Unofficial / Risky]` real audio-only streaming
- **Why users love it:** Data bachao, lecture sunna kaafi hai.

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

Ye poora section aapke "sab kuch mere computer me, download bhi ho aur gallery me bhi aaye" requirement ke liye hai. **Isko alag module** rakho (`vault` crate), taaki store builds me off ho sake.

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

**`[Unofficial / Risky]` flag:** Ye ToS-restricted hai. UI me one-time consent + "personal offline copy only" note. Store builds me feature **compile-out**.

**Safe alternatives (store builds):**
1. **Own-channel downloads** (OAuth + `videos.list?mine=true`) — apne content ka backup.
2. **Creative Commons filter** (`videoLicense=creativeCommon`).
3. **"Save to Watch Later" offline-queue** (sirf metadata + thumbnail cached, video streamed).
4. **External downloader handoff** — app sirf URL + timestamp external `yt-dlp` pe bhej de (user ka apna tool). Ye legally zyada safe framing hai.

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

## 10. Top 10 MVP Feature Set (v1.0 — 8–10 hafte realistic)

Criteria: **highest impact × lowest risk × legal** — store-release safe bhi.

| # | Feature | Kyun pehle | Effort |
|---|---|---|---|
| 1 | **Error-153-proof embed host + custom player shell** | Iske bina app hi nahi chalta | 1–2 d (spike) |
| 2 | **Local subscriptions via RSS + channel resolve** | Product ka dil; zero quota | 4–5 d |
| 3 | **Unified chronological feed + folders/profiles** | Anti-algorithm USP | 4 d |
| 4 | **Local SQLite history + Continue Watching + resume** | Data ownership promise ka proof | 3 d |
| 5 | **Custom player overlay** (speed memory, A-B loop, keyboard, PiP) | "Better than YouTube" feel | 6 d |
| 6 | **SponsorBlock skip + category toggles** | Sabse zyada retention-driving feature | 3 d |
| 7 | **DeArrow + RYD** (batch + cache) | Feed instantly premium dikhta hai | 2 d |
| 8 | **Import (Takeout subs + watch-history.json) & Export backup** | Onboarding + trust | 4 d |
| 9 | **Search (Data API + SQLite 24h cache + autocomplete)** | Completeness; quota-safe | 4 d |
| 10 | **Themes (OLED) + distraction-free mode + queue/playlists** | Polish + daily usability | 5 d |

**MVP me jaan-boojh kar NA rakhein:** Watch Party, AI summary, multi-source plugins, download (vault) — ye sab v1.1–v2.0. Download ko v1.1 me "desktop-only beta" ke roop me laao, store builds me off.

**MVP scope creep se bachne ka rule:** pehle 10 features pe `Easy` label wale hi lein. Har feature ka "done" definition likho (schema + UI + test).

---

## 11. 5 Unique "Killer Features" (jo FreeTube/NewPipe/Grayjay me bhi nahi hain)

### ⭐ 1. Attention OS (Watch-Time Budget + Per-Channel Rules/SLA)
Sirf timer nahi — **rules engine**. Har channel/folder pe contract: `"Tech folder: sirf weekend, max 3 videos/week"`, `"Shorts: 10 min/day"`, `"Music: unlimited"`. App enforce karta hai: Monday ko Tech feed *locked* dikhta hai ("Saturday ko khulega"). Budget khatam = player pause + "aaj ka quota done" screen.
**Kyun unique:** YouTube/Digital Wellbeing sirf total time count karte hain; *rule-level governance* koi nahi deta. Ye app ko "YouTube ka strict parent mode for adults" bana deta hai.
**Feasibility:** `Medium` (rules JSON + enforcement middleware + local scheduler). **Store-safe 100%.**

### ⭐ 2. "Why am I seeing this?" — Transparent Local Recommender
Home feed ka har card pe chhota chip: *"Kyunki tumne 3 Tech videos dekhe"*, *"Tech folder ka sabse purana unwatched"*, *"Tumhare notes me `rust` 5 baar aaya"*. Saath me ek **weight sliders panel** (Recency / Depth / Novelty / Same-channel-saturation) — slider ghumao, feed turant badal jaye. Sab local, koi ML API nahi.
**Kyun unique:** Transparency = trust. Koi OSS client recommender nahi deta, aur jo deta hai (Grayjay) explain nahi karta. Ye research/demo me bhi sexy lagta hai.
**Feasibility:** `Medium` (SQL scoring function + explain tags). **Store-safe.**

### ⭐ 3. Recall Cards — "Video → Retention" loop (spaced repetition built in)
Transcript + aapke notes se quiz/flashcard banao, SM-2 scheduler, daily 10-card review streak, aur har card pe "source timestamp" jump. "Aapne 40 ghante dekhe, 320 cards banaye, 74% retention."
**Kyun unique:** Koi bhi YouTube client *learning outcome* measure nahi karta. Students/aspirants (upsc/jee/devs) ka bada market. Offline AI se auto-generate = no server cost.
**Feasibility:** `Medium`–`Hard` (AI optional; manual cards with Easy). **Store-safe.**

### ⭐ 4. Bring-Your-Own-Cloud Encrypted Sync (zero backend, multi-device)
Progress/notes/subs ka **E2E-encrypted single blob** user ke apne Google Drive / Dropbox / WebDAV / iCloud / Syncthing folder me. App ko koi server nahi chahiye, aapko bhi nahi. QR se device pairing, conflict resolution UI (per-row merge), "sync now" + background.
**Kyun unique:** FreeTube/NewPipe me sync nahi (sabse bada complaint), LibreTube Piped account maangta hai (third-party trust). Aap **bina kisi cloud account** ke sync dete ho — privacy purists + normal users dono khush.
**Feasibility:** `Medium` (age/XChaCha20 encryption + Drive/WebDAV API + merge logic). **Store-safe.**

### ⭐ 5. Research Bundle Export (video → self-contained knowledge artifact)
Ek click me: video ke **downloaded clip + transcript + aapke timestamped notes + chapters + AI summary + screenshots** → ek `.zip` ya single **HTML file** jo kisi ko bhi bhejo, offline khulti hai, YouTube links bhi kaam karte hain. "Course bundle" bhi (playlist ka poora bundle).
**Kyun unique:** Koi client notes ko *portable artifact* nahi banata. Ye teachers, students, researchers ke liye instant value + organic sharing (marketing loop).
**Feasibility:** `Medium` (HTML templating + zip; clip export vault-dependent). Desktop-focused, **store-safe** agar clip optional.

*Bonus ideation (v2+):* **Global Time-Warp Search** ("us video me kya bola tha jo maine pichle mahine dekha" — transcript FTS across archive), **Audio-Only Podcast Mode with chapters + sleep timer**, **"Regret Index"** (post-watch 1-tap rating jo recommender ko train kare), **Focus Flight** (pomodoro + auto-pause at break).

---

## 12. Feasibility legend recap + risk table

| Risky feature | Risk | Safe alternative |
|---|---|---|
| Ad blocking / stream extraction | ToS violation, API/account ban, frequent breakage | Official embed + SponsorBlock (in-video segments) |
| Video/audio download | ToS violation; store rejection | Own-channel/CC-only mode, external downloader handoff, desktop-only beta |
| Background audio (mobile) | OS/webview pause; unofficial audio extraction | Vault-downloaded audio + native audio player (local files pe) |
| Transcript scraping | Unofficial timedtext endpoint breakage | Official captions when available; graceful "no transcript" state |
| Watch Party over internet | Needs TURN server (cost) | LAN-only rooms v1, WebRTC P2P v2 |
| Local AI model bundle | App size 1–2 GB | Download-on-first-use (OGG/GGUF), or Ollama/BYOK |
| WebView screenshot of iframe | Cross-origin canvas taint | Native window capture + thumbnail fallback |

---

## 13. Aage kya (next step options)

1. **Aapke liye scaffold bana doon?** Tauri v2 + React/TS + Rust SQLite (rusqlite/sqlx) + RSS ingestion + IFrame bridge + SponsorBlock module — chalu ho jaye, phir feature-by-feature.
2. **Error-153 spike pehle** — 1 din ka prototype (wrapper page + postMessage bridge) taaki player risk khatam ho.
3. **Schema + API contracts freeze** — `docs/implementation-playbook.md` me detail hai.
4. **Design system** — OLED theme + 3 densities + bottom nav spec.

> File `docs/implementation-playbook.md` me: Tauri module structure, SQLite schema (ready to paste), quota-safe request strategy, downloader job pipeline, SponsorBlock/DeArrow client code, sync API design, aur 12-hafte ka roadmap hai.
