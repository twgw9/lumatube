# LumaTube Android preview

Independent Android shell for the shared React UI; not desktop Tauri sidecars.
Android 10+ (API 29), native Kotlin + WebViewAssetLoader, NewPipeExtractor v0.27.1,
Media3 player, Android DownloadManager. No Google account or Data API key required
for native search/discovery or RSS subscriptions.

## Initial scope
- Query/cursor discovery and local search-based recommendation mix.
- RSS subscriptions, local notes/history/themes/inbox from shared frontend.
- Separate native Media3 player: progressive video + audio merging for playback,
  available resolution menu, up to 4x speed, resume saved when player pauses.
- Background system downloads: available combined MP4 streams capped at 720p or
  M4A audio. Movies/Music/LumaTube when gallery on, app-private external files otherwise.
  Android shows system download notifications; no custom foreground download service.
- Gallery scanning/indexing depends on Android/OEM media indexing. Not device tested.

## Not supported yet
Adaptive download merging, MP3 conversion, sponsor-cut files, embedded chapters/
thumbnail, Android SponsorBlock playback, native-player notes overlay, background
playback/PiP, live/DASH/HLS, Google OAuth, signed release updates, automatic subscription
polling. Unsupported Android download presets are hidden; incompatible streams fail
explicitly rather than downloading a silent video-only file.

## Build
CI builds pinned NewPipeExtractor source to local Maven, builds React, packages a
local-only CSP-restricted WebView page, then Gradle assembles a debug APK and lints.
The Linux sandbox has no Java/Android SDK; compile verification runs in Actions.
Source revision and GPL dependency/license notices ship alongside the APK.
Read NOTICE.md before redistributing (root/shared frontend license decision pending).

Debug signing is for personal testing only. CI debug keys can change between runs;
updates may require uninstalling an older debug build (which deletes local app data).
Export data first. For durable in-place updates configure a private release signing
key in GitHub Actions secrets, never in source/chat. No signing secrets are committed.

Security: local appassets origin only, blocked frames, no file/content access from
WebView, HTTPS external navigation only, exported launcher only, no Google credentials
collected, private app data excluded from Android backup. Extraction is unofficial
and may break or be rate-limited; fallback is watch on YouTube or a future APK update.
