# Desktop preview and Windows installer

## Current changes
- YouTube-inspired Guest profile menu with history, history pause/resume, account
  options, appearance and source/update navigation.
- Searchable local history, including entries with metadata not in the demo list.
- Paused history stops new history entries and playback-progress writes; it does
  not erase previously saved progress. Clearing history intentionally retains progress.
- Notes OFF for new installs and a one-time version-0 migration. Users can opt back in.
- Native CSP permits GitHub release discovery (previously blocked in the packaged app).

## Open-source references (ideas only, no implementation copied)
Reviewed upstream repository metadata and README on 2026-11-13:
- https://github.com/FreeTubeApp/FreeTube — local subscriptions/history and privacy-oriented
  UX inspired the Guest menu and explicit local-only history controls. AGPL-3.0.
- https://github.com/TeamNewPipe/NewPipe — account-free viewing and library organization
  informed keeping subscriptions separate from Google authentication. GPL-3.0.
These are independent projects, not endorsements or dependencies. Their license does
not automatically license this repository. Choose a project license before calling
LumaTube fully open source; source availability alone is not an open-source license.

## Build an unsigned Windows preview
The manual `Windows preview installer` GitHub Actions workflow runs on Windows,
installs Rust/Node, runs regression checks, downloads upstream desktop sidecars,
generates icons and attempts an NSIS .exe installer. It uploads an artifact only on
success. It does NOT publish a release, sign the executable or claim Windows testing.
The workflow must be present on GitHub before it can be manually selected under Actions.
The native crate has not yet been compiled in this sandbox; first builds may fail.

Artifacts: Actions → Windows preview installer → successful run →
LumaTube-Windows-preview-unsigned. Extract the ZIP, inspect notices, then the .exe.
Windows may warn about an unsigned executable. Do not disable system protections;
review the source/build logs and obtain a signed build if required.

Sidecar tools are downloaded at build time; yt-dlp is checked against upstream SHA256.
Review FFmpeg source/build provenance, binary hashes, licensing notices and corresponding
source obligations before distributing builds. The tools are not pinned/reproducible yet.
No Android APK is produced by this workflow. Native playback/authentication/device tests
remain separate tasks. This is not an automatic in-app updater.
