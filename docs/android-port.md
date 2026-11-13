# LumaTube Android readiness and release plan

## Implemented shared UI
Responsive bottom navigation, themes, first-launch skippable tour, local history toggle,
optional notes, manual GitHub release discovery, download notification preference and
native Tauri notification event integration (permission requested only when enabled).
Notifications replace an item by stable job ID, at most once per 15 seconds, with
percentage, bytes downloaded/remaining and ETA. These are text notifications while
the app is active, NOT an Android foreground-service progress bar.

## NOT implemented / NOT device-tested
- Android foreground download service (required for reliable background operation)
- MediaStore/gallery scoped-storage bridge
- Android extraction/playback engine replacing desktop yt-dlp/ffmpeg sidecars
- OAuth Authorization Code + PKCE, callback handling and secure token storage
- Signed APK build pipeline and APK releases
- Silent auto-update (intentionally not offered)

Desktop process sidecars are not an Android implementation. Do not ship the current
crate as a working Android downloader. No APK is produced by this change.

## APK update requirements
Use one stable Android applicationId and keep the signing key private and backed up.
Publish signed universal or ABI-labelled APKs plus SHA256SUMS and release notes to
GitHub Releases. Subsequent updates MUST use the same ID and signing certificate.
Settings → About checks /releases/latest; the user opens GitHub, downloads the APK,
and approves the Android package installer. Handle unknown-app install permission
in Android settings; do not bypass it. A GitHub source ZIP is NOT an installable APK.
Set a network security policy; never accept arbitrary release asset URLs or execute
remote scripts. Test install/update with existing user data on real devices.

## Repository rename
Requested name: lumatube. GitHub integration returned HTTP 403 on rename.
Owner can rename through Repository Settings → General → Repository name, then
update src/lib/project.ts. Existing links remain current until the rename succeeds.

## Test matrix before calling Android supported
Android 13+ notification permission denied/granted, background/kill/reboot, pause/
cancel/retry, Wi-Fi loss, storage full, scoped gallery save, signed APK in-place update,
OAuth cancellation/token revocation, narrow screens, TalkBack, reduced motion.
