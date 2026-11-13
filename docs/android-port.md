# LumaTube Android preview status

Native Android implementation and debug APK pipeline are now in `android/` and
`.github/workflows/android-preview.yml`. See [module notes](../android/README.md)
for actual scope and limitations. Frontend build/regressions and Android APK assembly + lint pass in
[run 43482391240](https://github.com/twgw9/lumatube/actions/runs/43482391240)
at commit `165c4b5`. Device verification remains a separate gate.

[Download the debug APK artifact](https://github.com/twgw9/lumatube/actions/runs/43482391240/artifacts/14066366078)
(GitHub login may be required; extract ZIP, then install `app-debug.apk`; Android 10+).
Debug signing is not stable across builds; export local data before uninstalling an
older build if Android rejects an update. Do not describe untested playback/downloads
as verified.

The preview uses NewPipeExtractor, Media3 and system DownloadManager rather than
desktop sidecars. No custom foreground service is needed for DownloadManager jobs.
No production signing key or public APK release is configured.

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
Confirmed repository: https://github.com/twgw9/lumatube. Source and release links in src/lib/project.ts use this name.

## Test matrix before calling Android supported
Android 13+ notification permission denied/granted, background/kill/reboot, pause/
cancel/retry, Wi-Fi loss, storage full, scoped gallery save, signed APK in-place update,
OAuth cancellation/token revocation, narrow screens, TalkBack, reduced motion.
