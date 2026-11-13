# Local discovery mix

For you is LumaTube's own discovery system, not Google's authenticated Home feed.
Submitted searches (not keystrokes) update a device-local, bounded interest list.
Top five recent/frequent topics seed retrieval, with a popular-exploration batch every
third request. Each topic keeps its own pagination cursor. Exhausted sources do not
restart at page one; duplicate videos are removed. Maximum twelve batches per refresh
bounds expensive discovery requests. New searches change topics when Home is opened.

Ranking uses matching title/channel tokens, upload recency, completed-video demotion
and channel diversity. Not interested hides an item from Home; reset clears choices.
Turning learning off stops recording submitted searches and uses popular discovery
instead. Existing saved interests remain until reset. Focus mode uses subscriptions
only and bypasses the discovery mix. Keywords/channel blocklists still apply.

Privacy: topic selection/ranking stays local; selected queries necessarily go to
YouTube (through Data API or native yt-dlp). Stored preferences are not encrypted.
No Google OAuth or Google-account personalised Home is implemented.

Browser: user Data API v3 key required; search costs quota. Native: new discover_videos
command uses bundled yt-dlp with flat metadata and bounded public search pages, no
Google key/login. [Unofficial / Risky] extraction may break or be rate-limited; fallback
is configuring a Data API key or opening YouTube. Native no-key Popular is search
for popular videos India, NOT an official trending chart. Native discovery returns
flat metadata; dates/views/durations can be missing and are not invented.

Validation: frontend build, pure ranking/preferences tests, mocked Data API tests,
and jsdom hook tests for rotation, source-specific cursors and exhaustion. Rust command compiled successfully in the remote Windows installer build (run 43466613113), but live YouTube/network and native playback are not exercised in this sandbox. Build success is not proof of working live playback.

## Clean Home and subscription inbox
Home now contains compact For you / Subscriptions / Explore / Continue watching tabs,
a video grid and a bottom pagination button. Discovery explanations and controls live
at Settings → Feed & interests. Continue watching no longer fetches unrelated feed
pages, and recommendations-off does not fetch discovery results.
The bell inbox only detects unseen IDs after a subscription refresh baseline has been
established. It does not promise background polling or OS push. Mute is per channel.
