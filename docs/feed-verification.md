# Feed and playback verification checklist

## Tests run in sandbox
`npm run test:regression`: settings defaults/migration, local subscription toggle,
API metadata normalization, duration parsing, popular/search/uploads page tokens,
missing-key rejection, 403/quota errors, channel-host validation, aborted requests,
feed-hook loading/paging/deduplication/concurrent-click guard/end-of-feed and error states.
Network mocked. `npm run build`: frontend typecheck and production bundle.

## Live setup (not yet verified in sandbox)
1. Enable YouTube Data API v3 in a Google Cloud project. Create and restrict an API
   key to the Data API and your deployment's HTTP referrers where appropriate.
   Native app API-key restrictions require separate configuration; do not embed a
   shared developer secret in the app. Key is saved in local settings, not encrypted.
2. Settings → Account → API key. No OAuth account is connected by this step.
3. Home → Popular in India → load next page. Search → submit → load next page.
4. Subscriptions → channel URL/@handle/UC ID → Subscribe → inspect latest uploads.
   Browser subscription pages use channels → uploads playlist → playlistItems →
   videos (no search call). API quotas apply; not unlimited.
5. Native, no key: subscribe via resolver → RSS newest uploads. RSS has approximately
   the latest 15 uploads per channel, not full-history pagination. Failed requests are
   errors, not a successful empty demo feed. Partial native RSS failures currently log
   warnings and may return a partial result; no per-channel retry status UI yet.
6. Open a video: title/channel/ID must match clicked card. Browser uses YouTube's
   official embed; may be blocked by the publisher/region/host. Use Watch on YouTube
   fallback. Native extractor must be compiled and sidecars installed before testing.
7. Native downloads: job ID is shared between frontend and backend before spawning.
   Startup failure must mark the item error, not success; native progress/done must
   update that same row. Cancel must kill the owned child handle. Pause/resume disabled
   until implemented. Verify actual file and audio on Windows, not just UI progress.

## Not ready
Rust compilation/Windows executable, Android APK, OAuth login and personalised feed,
adaptive split audio/video playback, background Android service. Do not label these
as tested based on mocked frontend tests. A Windows preview workflow is provided,
but its build must actually succeed and then pass manual playback/download tests.
