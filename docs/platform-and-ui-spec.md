# LocalTube — Platform, Download/Gallery & UI Specification
### Personal app · PC (Windows/macOS/Linux) + Mobile (Android/iOS) · No store, no selling

> Ye document **code se pehle ka plan** hai. Isme 3 sawaalon ka seedha jawab hai:
> 1. **Download + Gallery me dikhana** — kaunse platform pe kitna possible hai? (honest, no jhooth)
> 2. **UI** — PC aur phone dono pe kaisa dikhega, kaise kaam karega?
> 3. **Features** — final list, priority ke saath.

---

# PART 1 — DOWNLOAD & GALLERY: platform by platform sach

## 1.1 Table (yehi aapka main sawaal hai)

| Platform | Download possible? | Gallery me dikhega? | Kitna mushkil | Notes |
|---|---|---|---|---|
| **Windows** | ✅ **Haan, 100%** | ✅ Folder (`Videos\LocalTube`) + Windows Photos/VLC/Plex me index | 🟢 **Easy** | yt-dlp + ffmpeg sidecar. Sabse aasan platform |
| **macOS** | ✅ **Haan, 100%** | ✅ Folder + QuickTime/Photos import + Finder preview | 🟢 **Easy** | Same sidecar. Unsigned build khud ke Mac pe chalega (store nahi chahiye) |
| **Linux** | ✅ **Haan, 100%** | ✅ Folder + Jellyfin/Plex/Shotwell | 🟢 **Easy** | Sabse smooth (AppImage/deb) |
| **Android** | ✅ **Haan, 90%** | ✅ **Phone Gallery me turant** (MediaStore insert) | 🟡 **Medium** | yt-dlp binary nahi chalta → `NewPipe Extractor` (Kotlin) ya `youtubei.js` use karo. Save = `Movies/LocalTube/` → Gallery app me dikhega |
| **iOS** | ⚠️ **Phaanso, par possible** | ✅ **Photos (Camera Roll) me save ho sakta hai** | 🔴 **Hard** | App store nahi chahiye (personal sideload), par: Mac + Xcode chahiye, free Apple ID = **7 din baad dobara sign karna padta hai**, extractor ke liye pure-Swift/JS pipeline chahiye (process spawn nahi hota) |

**Seedhi baat:** **PC + Android = 95% aapka kaam ho jayega.** iOS sabse last me karo — 2-3 hafte lagenge sirf setup me.

## 1.2 "Gallery me dikhega" ka poora sach

### Android — haan, bilkul gallery me
- File save karte hi `MediaStore` me register karo → **Google Photos / Gallery / MX Player me turant dikhega**, WhatsApp pe share bhi.
- Path: `Movies/LocalTube/<Channel Name>/<Video Title>.mp4`
- Android 10+ me **kisi storage permission ki zarurat nahi** (scoped MediaStore insert) → Play Store nahi hai to bhi clean.
- Thumbnail bhi embed ho jata hai (`ffmpeg --embed-thumbnail`) → gallery me video ka poster dikhega, black box nahi.
- **Sponsor-free copy:** download ke baad ffmpeg se sponsor segment **physically cut** → gallery me file hi clean aayegi.

### iOS — Photos me jaa sakta hai, par tedha hai
- Download → app ke `Documents/LocalTube/` folder me
- "Save to Photos" button → `PHPhotoLibrary` permission → **Camera Roll me aa jayega** (ye kaam karta hai)
- **Problem:** iOS me background download lambi chalti hai to OS maar deta hai (background session zaroori), aur 7-day resign drama.
- **Suggestion:** iOS pe pehle sirf **"watch + feed + notes"** karo, download **v2** me.

### PC — gallery ka matlab folder
- Default: `~/Videos/LocalTube/<Channel>/<Title> [videoId].mp4`
- Saath me sidecar files: `.jpg` (thumb), `.json` (metadata/chapters/notes), `.vtt` (captions)
- Ye structure directly **Plex / Jellyfin / VLC / MPC-HC** me library ki tarah add ho jata hai — matlab PC pe aapka khud ka Netflix ban jata hai 😄
- "Open in folder" button + in-app Gallery tab (grid, thumbnails, progress).

## 1.3 Storage math (realistic)

| Quality | 1 ghante ka size | 100 videos (avg 15 min) |
|---|---|---|
| 480p (data saver) | ~200–300 MB | ~5 GB |
| 720p | ~450–700 MB | ~12 GB |
| **1080p** (default recommend) | ~900 MB – 1.5 GB | ~25–35 GB |
| 4K | ~4–7 GB | ~100 GB+ |
| Audio only (M4A/Opus) | ~50–60 MB | ~1.5 GB |

**App me ye features:** storage bar, "purge watched > 30 days", "audio-only me convert karo" (video file → audio, space bachao), custom folder (external SD card / D-drive).

## 1.4 Download ke 3 tarike (jo app me honge)

1. **Single video** — player me ⬇️ button → preset sheet (1080p / 4K / Audio / Sponsor-free) → progress chip → notification → Gallery.
2. **Playlist / poora channel bulk** — "Offline kar do" → queue me 2 parallel downloads → resume support.
3. **Auto-download rule** — "Is folder ke naye videos automatically 480p pe download ho jayein" (offline-first mode, travel ke liye). Ye koi app nahi deta — **aapka killer feature**.

## 1.5 Ek honest warning (jo maine pehle bhi di thi)

Download andar se "YouTube ka data mangna" hai. Personal use me chalega, par:
- **yt-dlp ko update karte rehna padega** (app me button hoga — 1 click).
- Kabhi "Sign in to confirm you're not a bot" aa sakta hai → `cookies.txt` import (burner Google account se).

---

# PART 2 — UI PLAN (PC + Phone dono)

## 2.1 Design philosophy — 3 rules

1. **Ek design system, do layout** — colors/spacing/typography same, sirf layout badalta hai (responsive). Isse code aadha rehta hai aur app consistent lagta hai.
2. **Phone = thumb-first, PC = keyboard-first.** Phone pe har cheez neeche 1 haath me; PC pe har cheez `Ctrl+K` se.
3. **Video pehle, chrome baad me.** Player ke around koi distraction nahi — na sidebar ads, na "up next" trap, na Shorts shelf.

## 2.2 Design tokens (shared)

| Token | Value |
|---|---|
| Theme base | **True OLED black** `#000000` (battery + eyes), cards `#0B0B0D`, borders `#1A1A1F` |
| Accent | Teal/cyan `#2DD4BF` (ya user choose kare — 8 presets) |
| Text | `#F5F5F7` primary, `#9A9AA5` secondary |
| Font | **Inter** (Latin) + **Noto Sans Devanagari** (Hindi) — Hinglish titles ke liye zaroori |
| Radius | 12px cards, 999px pills |
| Grid | 8pt base |
| Densities | Comfortable (2 col phone / 4 col desktop) · Compact (list) · Grid (poster style) |
| Motion | 150–200ms ease-out, **reduce-motion respect** karo |

Themes: **OLED Black** · **Dim Graphite** · **Sepia Reading** · **High Contrast** (a11y) · **Auto (system)**.

## 2.3 PC / Desktop layout

### A) Home / Feed
```
┌────────────┬──────────────────────────────────────────────────────┐
│  LocalTube │  🔍 Search (Ctrl+K)              ⬇ 2  ⚙  ⤢          │
│            ├──────────────────────────────────────────────────────┤
│ ⌂ Home     │  [ Aaj ke naye ] [ Continue ] [ Tech ] [ Music ] [+]  │ ← custom tabs
│ ⊞ Subscr.  │                                                       │
│ ⬇ Downloads│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│ ♪ Music    │  │ thumb  │ │ thumb  │ │ thumb  │ │ thumb  │          │
│ 📚 Library │  │ 12:40  │ │ 8:02   │ │ LIVE   │ │ ✅     │          │
│ ✎ Notes    │  └────────┘ └────────┘ └────────┘ └────────┘          │
│            │  Title (DeArrow clean)      Title                      │
│ ─────────  │  Channel · 2 din pehle     Channel · 1 hafta pehle     │
│ Tech    ▸  │                                                       │
│ Music   ▸  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│ News    ▸  │  ...                                                  │
└────────────┴──────────────────────────────────────────────────────┘
```
- Sidebar collapse ho sakta hai (icon-only), folders expandable.
- Card hover: quick actions (Download / Save / Notes / Don't recommend).

### B) Watch page — **3 modes** (ye PC ka sabse bada USP)
```
SPLIT (default)                        THEATER
┌──────────────────────┬───────────┐  ┌──────────────────────────────────┐
│                      │ Notes │ Tr │  │                                  │
│      ▶ PLAYER        │ Queue │ Cm │  │           ▶ PLAYER               │
│   [custom controls]  │           │  │       (wide, no chrome)          │
│                      │ 12:40 ──  │  └──────────────────────────────────┘
├──────────────────────┤ Rust own- │  ┌──────────────────────────────────┐
│ Title · channel · 👍 │ ership   │  │ Title · description · chapters   │
│ [⬇][✎][🔖][⋯]        │ 08:12 ──  │  └──────────────────────────────────┘
├──────────────────────┤ Async    │
│ Chapters ▸ Comments  │  awai..  │  CINEMA = everything dim except video
└──────────────────────┴───────────┘
```
- Right panel **resizable + 4 tabs**: Notes · Transcript (searchable) · Queue · Comments.
- Panel width save hoti hai (aapka workflow yaad rehta hai).
- Player controls: speed pill (0.5×–3× quick, all), A-B loop, chapters, quality, PiP, theater, fullscreen.
- `Ctrl+K` command palette: "search Rust", "focus mode", "download this", "open notes".

### C) Downloads / Gallery
```
┌────────────┬──────────────────────────────────────────────────────┐
│ ⬇ Downloads│  [Sab] [Video] [Audio] [Sponsor-free]   💾 28.4 GB     │
│            │  ┌──────┐ Rust Ownership        ✅ 1080p · 245 MB     │
│            │  │ img  │ ────────────────▶ 60%                          │
│            │  ├──────┤ Async in Rust          ⬇ 45% · 3.2 MB/s      │
│            │  │ img  │ ────────▶                                      │
│            │  └──────┘ Tauri v2 Basics        ⏸ paused             │
└────────────┴──────────────────────────────────────────────────────┘
```
- Per-item: Open in folder · Play · Delete · Convert to audio · Re-download.
- Top: storage bar + "purge watched older than 30 days".

### D) Extra PC-only cheezein
- **Mini-player window** (always-on-top, 360×200, draggable) — kaam karte waqt corner me lecture.
- **Multi-window** — do videos side by side (notes wali window alag).
- **System tray** — play/pause, queue, download progress.
- **Global hotkey** — `Ctrl+Shift+Space` = play/pause kahin se bhi.

## 2.4 Phone layout (Android/iOS)

### A) Home
```
┌─────────────────────────────┐
│ LocalTube          🔍   ⬇   │
├─────────────────────────────┤
│ [Aaj ke naye][Continue][+]  │ ← scrollable chips
│                             │
│ ┌─────────────────────────┐ │
│ │        thumbnail        │ │
│ │                   12:40 │ │
│ └─────────────────────────┘ │
│ Title clean (DeArrow)       │
│ Channel · 2 din pehle   ⋯   │
│ ┌─────────────────────────┐ │
│ │        thumbnail        │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│  ⌂      ⊞       ⬇      📚   │ ← bottom nav (thumb zone)
│ Home   Subs  Downloads  You │
└─────────────────────────────┘
```
- **Bottom nav 4 items** (5 nahi — clutter): Home · Subscriptions · Downloads · You. Search top pe (one-hand reach ke liye bottom-right FAB bhi).
- **Bottom sheets** for actions (Download, Save, Add to queue) — modal se behtar.
- Pull-to-refresh, swipe between tabs.

### B) Player (landscape)
```
┌───────────────────────────────────────┐
│  10s ⏪   ▶   10s ⏩      ⚙  ⛶        │
│ ━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 12:40 / 24:10       [1.5×] [A-B] [⬇] │
└───────────────────────────────────────┘
  Gestures: double-tap L/R = ±10s
            vertical left = brightness
            vertical right = volume
            long-press = 2× speed
            swipe down = mini player
```
- **Portrait:** player top pe sticky, neeche scrollable — Up Next / Notes / Transcript / Comments (tabs).
- **Lock screen controls** (media session) — phone lock karke audio chalta rahe.
- **Mini player:** neeche patti, tap = full, swipe = close.

### C) Mobile-specific
- **Sleep timer** quick action (raat ko).
- **Offline mode banner** — "Aap offline ho, 12 downloaded videos available".
- **Safe areas** (notch, gesture bar) respect.
- **One-hand test:** har primary action screen ke neeche 40% me ho.

## 2.5 Consistency table — PC vs Phone

| Cheez | PC | Phone |
|---|---|---|
| Navigation | Left sidebar | Bottom nav (4 tab) |
| Search | `Ctrl+K` palette | Top bar + search screen |
| Player controls | Hover overlay + keyboard | Tap overlay + gestures |
| Notes panel | Right side panel (persistent) | Bottom sheet / tab |
| Downloads | Full page + storage mgmt | Tab + swipe actions |
| Multi-task | Mini window + multi-window | PiP + mini player |
| Density default | Comfortable 4-col | 2-col / list |
| Speed control | Keyboard `[` `]` | Pill menu |

---

# PART 3 — FINAL FEATURE LIST (priority ke saath)

## 🔴 v1 — Core (ye bina app adhoora)
| Feature | Kahan | Kaisa lagega |
|---|---|---|
| **Ad-free native player** (Engine B) | PC + Phone | YouTube player hi nahi, apna player |
| **Quality picker 360p–4K** | Dono | Settings gear me |
| **Speed 0.25×–3× + speed memory** | Dono | Per-channel default yaad |
| **A-B loop** | Dono | Player me [A-B] pill |
| **Background audio** (phone lock) | Phone | Media notification |
| **RSS subscription feed** | Dono | Chronological, koi algorithm nahi |
| **Folders / channel groups** | Dono | Sidebar / chips |
| **Local history + Continue Watching** | Dono | Home ka 2nd tab |
| **Download + Gallery** | PC + Android | ⬇ button + Gallery tab |
| **SponsorBlock skip** | Dono | Auto-skip + toast |
| **Timestamped notes** | PC (full) + Phone (basic) | Right panel / sheet |
| **Resume across devices** | Dono | Local + later sync |
| **OLED theme + dark** | Dono | Settings |

## 🟠 v1.5 — Personality (jo app ko "apna" banata hai)
- **DeArrow** (clean titles/thumbnails) + **RYD** (dislike count)
- **Watch Later queue + smart playlists**
- **Transcript panel + in-video search**
- **Sleep timer + focus mode**
- **Import**: Takeout subs + watch-history
- **Compact/grid densities**, custom accent color
- **Command palette** (PC)
- **Bulk/auto-download rules**

## 🟡 v2 — Standout (jo kisi me nahi)
- **Attention budget / per-folder rules** ("Tech sirf weekend")
- **"Why am I seeing this?" recommender**
- **Recall cards** (video → flashcards)
- **LAN sync** (phone ⇄ PC, bina cloud)
- **Watch party** (LAN)
- **AI summary** (offline model, optional)
- **Research bundle export**
- **iOS app** (download ke saath)

## Kya maine deliberately NAHI rakha (aur kyun)
- ❌ Comments posting, likes, subscribe actions → Google login chahiye, ToS risk, UX clutter. **Read-only** comments rakh sakte hain.
- ❌ Shorts player (special vertical UI) → v1 me nahi; sirf "shorts hide" toggle.
- ❌ Notifications for every channel upload → battery drain; v1.5 me digest.

---

# PART 4 — Build order (jo maine recommend kiya)

```
Week 0  → Extraction spike (2-3 din)  ← GO / NO-GO
Week 1-2 → Player + MediaResolver + UI shell
Week 3  → Background audio
Week 4  → RSS feed + folders + history
Week 5  → Notes + Continue Watching
Week 6  → DOWNLOAD VAULT + GALLERY  ← aapki original demand
Week 7  → SponsorBlock + DeArrow + RYD
Week 8  → Import/Export + search
Week 9  → Polish (themes, densities, palette)
Week 10 → v1 usable on PC
Week 11 → Android build + gallery (MediaStore)
Week 12+ → Sync, iOS, v2 features
```

---

# PART 5 — Kya confirm chahiye (aapke jawab)

1. **Pehla platform** — PC pehle ya Android pehle? (Mera suggestion: **PC pehle**, kyunki iterate karna 5x fast hai.)
2. **iOS chahiye ya nahi?** (Agar iPhone nahi hai to skip — 2-3 hafte bach jayenge.)
3. **Design direction** — OLED black + teal accent, ya kuch aur? (Mockups bhej raha hoon, dekh lo.)
4. **AI summary** — chahiye (1-2 GB model) ya skip?
5. **Notes** — sirf app ke andar, ya plain `.md` files me bhi save ho (Obsidian ke saath kaam kare)?
