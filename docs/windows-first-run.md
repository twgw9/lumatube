# LumaTube Windows preview: first run

## Download
[Installer artifact ZIP](https://github.com/twgw9/lumatube/actions/runs/43472982948/artifacts/14063100916)
[Successful build](https://github.com/twgw9/lumatube/actions/runs/43472982948)

Windows x64 only, verified build commit c27642d. GitHub sign-in may be required to
download the artifact. Artifacts expire; this is not a permanent release link.
Extract the ZIP, review notices, and run the included .exe only if you trust the source.
The preview is unsigned: never disable Windows security protections to install it.

## No Google/API configuration for native discovery
1. Open the installed app, skip or finish the welcome tour.
2. Home → For you should attempt public discovery using the bundled yt-dlp tool.
3. Search for a topic, e.g. Rust programming. Return Home to inspect discovery topics.
4. Subscribe from a video or Subscriptions → @handle/channel URL.
5. Open Subscriptions and refresh. No-key subscriptions use RSS (recent uploads only).
6. Try a video. Native combined audio/video formats are exposed; unavailable streams
   must show an error, not a sample clip. Separate adaptive A/V playback is not ready.
7. Try one short download. Confirm the file exists and plays with audio externally.
8. Bell alerts are based on a baseline subscription refresh followed by later refreshes;
   there is no background push service. Mute is available beside Subscribe.

## If something fails
Report your Windows version, exact error message and the steps that produced it.
Do not send passwords, API keys, OAuth tokens, cookies or exported private history.
Build success is verified; actual installation/live playback/downloads need device tests.
Google OAuth, Android APK and signed automatic updates are not implemented.
Browser preview is separate: browser feeds still need a Data API key.

## Verified download hardening build
The download runner now provides the bundled ffmpeg directory explicitly, requests
machine-readable final paths after post-processing, and verifies a finalized,
non-empty file before emitting download completion. Audio conversion paths and
subtitle paths are handled separately. Sponsor removal uses yt-dlp's native
SponsorBlock/ffmpeg pipeline rather than a no-op post-completion stage. Network
availability/segment accuracy and the resulting files still require runtime tests.
Focus mode also prevents autoplay-next when its disable-autoplay preference is set.

Windows build, NSIS packaging and both native vault parser tests passed in run 43472982948. Live downloads/file playback remain device tests, not covered by parser unit tests.
