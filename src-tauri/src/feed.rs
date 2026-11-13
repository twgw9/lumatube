//! Ingest: RSS first (free, no quota, 15 latest per channel), Data API only
//! for enrichment. Single rule: never burn quota for something an RSS feed
//! already gives us.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::{Db, VideoRow};
use crate::error::{AppResult, AppError};

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("LumaTube/0.1 (+personal)")
        .gzip(true)
        .build()
        .expect("http")
}

/* ── RSS: youtube.com/feeds/videos.xml?channel_id=… ────────── */

/// The YouTube Atom feed is flat and predictable; a small regex parser is
/// sturdier than a schema-bound deserializer (namespaces change).
pub async fn fetch_channel_rss(channel_id: &str) -> AppResult<Vec<VideoRow>> {
    let url = format!("https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}");
    let resp = http().get(url).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::NotFound(format!("rss {channel_id}: {}", resp.status())));
    }
    let xml = resp.text().await?;

    let entry_re = regex::Regex::new(r"(?s)<entry>(.*?)</entry>").unwrap();
    let video_re = regex::Regex::new(r"<yt:videoId>([^<]+)</yt:videoId>").unwrap();
    let ch_re = regex::Regex::new(r"<yt:channelId>([^<]+)</yt:channelId>").unwrap();
    let title_re = regex::Regex::new(r"<title>([^<]*)</title>").unwrap();
    let pub_re = regex::Regex::new(r"<published>([^<]+)</published>").unwrap();
    let thumb_re = regex::Regex::new(r#"<media:thumbnail url="([^"]+)""#).unwrap();
    let views_re = regex::Regex::new(r#"<media:statistics views="(\d+)""#).unwrap();
    let desc_re = regex::Regex::new(r"(?s)<media:description>(.*?)</media:description>").unwrap();

    let mut rows = Vec::new();
    for cap in entry_re.captures_iter(&xml) {
        let body = &cap[1];
        let Some(vid) = video_re.captures(body).map(|c| c[1].to_string()) else {
            continue;
        };
        let title = title_re
            .captures(body)
            .map(|c| html_unescape(&c[1]))
            .unwrap_or_default();
        let published_at = pub_re
            .captures(body)
            .and_then(|c| chrono::DateTime::parse_from_rfc3339(&c[1]).ok())
            .map(|d| d.timestamp());
        let views = views_re
            .captures(body)
            .and_then(|c| c[1].parse::<i64>().ok());

        rows.push(VideoRow {
            id: vid,
            channel_id: ch_re
                .captures(body)
                .map(|c| c[1].to_string())
                .unwrap_or_else(|| channel_id.to_string()),
            title: title.clone(),
            original_title: Some(title),
            description: desc_re.captures(body).map(|c| html_unescape(&c[1])),
            published_at,
            duration_sec: 0, // RSS carries no duration → enrichment fills it
            thumb: thumb_re.captures(body).map(|c| c[1].to_string()),
            views,
            likes: None,
            dislikes: None,
            is_live: false,
            is_short: false,
            dearrow_title: None,
            dearrow_thumb: None,
        });
    }
    Ok(rows)
}

fn html_unescape(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

/* ── channel resolve: @handle → UC… ────────────────────────── */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedChannel {
    pub id: String,
    pub name: String,
    pub avatar: Option<String>,
}

pub async fn resolve_handle(handle: &str) -> AppResult<ResolvedChannel> {
    let raw = handle.trim();
    let clean = raw.trim_start_matches("https://www.youtube.com/").trim_start_matches("https://youtube.com/").trim_start_matches("https://m.youtube.com/").trim_start_matches("channel/").trim_start_matches('@').trim_end_matches('/');
    let channel_id_re = regex::Regex::new(r"^UC[\w-]{22}$").unwrap();
    let handle_re = regex::Regex::new(r"^[\p{L}\p{N}_.-]+$").unwrap();
    if !handle_re.is_match(clean) {
        return Err(AppError::Other("Enter a valid YouTube @handle, channel URL or UC channel ID".into()));
    }
    // oEmbed gives us the author but not the channel id; the channel page html
    // contains the canonical id. This is a single cheap request, no API key.
    let url = if channel_id_re.is_match(clean) { format!("https://www.youtube.com/channel/{clean}") } else { format!("https://www.youtube.com/@{clean}") };
    let html = http()
        .get(url)
        .send()
        .await?
        .text()
        .await?;

    let re = regex::Regex::new(r#""externalId":"(UC[\w-]{22})""#).unwrap();
    let id = re
        .captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .ok_or_else(|| AppError::NotFound(format!("channel not found: {clean}")))?;

    let name_re = regex::Regex::new(r#"<meta property="og:title" content="([^"]+)""#).unwrap();
    let name = name_re
        .captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().replace(" - YouTube", ""))
        .unwrap_or_else(|| clean.to_string());

    let avatar_re = Regex_avatar();
    let avatar = avatar_re
        .captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());

    Ok(ResolvedChannel { id, name, avatar })
}

fn Regex_avatar() -> regex::Regex {
    regex::Regex::new(r#"<meta property="og:image" content="([^"]+)""#).unwrap()
}

/* ── Data API v3 enrichment (1 unit per 50 videos) ─────────── */

#[derive(Debug, Deserialize)]
struct VideosResponse {
    #[serde(default)]
    items: Vec<ApiVideo>,
}

#[derive(Debug, Deserialize)]
struct ApiVideo {
    id: String,
    #[serde(default)]
    content_details: serde_json::Value,
    #[serde(default)]
    statistics: serde_json::Value,
}

/// Fill in duration/views for videos that RSS couldn't provide.
/// Cost: videos.list = 1 quota unit per 50 ids.
pub async fn enrich_videos(api_key: &str, video_ids: &[String]) -> AppResult<Vec<(String, i64, i64)>> {
    if video_ids.is_empty() || api_key.is_empty() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for chunk in video_ids.chunks(50) {
        let ids = chunk.join(",");
        let res: VideosResponse = http()
            .get("https://www.googleapis.com/youtube/v3/videos")
            .query(&[
                ("part", "contentDetails,statistics"),
                ("id", ids.as_str()),
                ("key", api_key),
                ("maxResults", "50"),
            ])
            .send()
            .await?
            .json()
            .await?;

        for v in res.items {
            let duration = v
                .content_details
                .get("duration")
                .and_then(|d| d.as_str())
                .map(parse_iso8601_duration)
                .unwrap_or(0);
            let views = v
                .statistics
                .get("viewCount")
                .and_then(|x| x.as_str())
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0);
            out.push((v.id, duration, views));
        }
    }
    Ok(out)
}

/// "PT1H2M3S" → 3723
fn parse_iso8601_duration(s: &str) -> i64 {
    let mut secs = 0i64;
    let mut num = String::new();
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            num.push(ch);
        } else {
            let n: i64 = num.parse().unwrap_or(0);
            match ch {
                'H' => secs += n * 3600,
                'M' => secs += n * 60,
                'S' => secs += n,
                _ => {}
            }
            num.clear();
        }
    }
    secs
}

/* ── search (quota-aware) ──────────────────────────────────── */

pub async fn search_youtube(api_key: &str, q: &str, max: u32) -> AppResult<Vec<VideoRow>> {
    if api_key.is_empty() {
        return Err(AppError::Other("Data API key missing".into()));
    }
    let res: Value = http()
        .get("https://www.googleapis.com/youtube/v3/search")
        .query(&[
            ("part", "snippet"),
            ("type", "video"),
            ("q", q),
            ("maxResults", &max.clamp(1, 50).to_string()),
            ("key", api_key),
            ("videoEmbeddable", "true"),
        ])
        .send()
        .await?
        .json()
        .await?;

    let mut rows = Vec::new();
    if let Some(items) = res["items"].as_array() {
        for it in items {
            let id = it["id"]["videoId"].as_str().unwrap_or_default();
            if id.is_empty() {
                continue;
            }
            let sn = &it["snippet"];
            rows.push(VideoRow {
                id: id.to_string(),
                channel_id: sn["channelId"].as_str().unwrap_or_default().to_string(),
                title: sn["title"].as_str().unwrap_or_default().to_string(),
                original_title: sn["title"].as_str().map(str::to_string),
                description: sn["description"].as_str().map(str::to_string),
                published_at: sn["publishedAt"]
                    .as_str()
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|d| d.timestamp()),
                duration_sec: 0,
                thumb: sn["thumbnails"]["high"]["url"].as_str().map(str::to_string),
                views: None,
                likes: None,
                dislikes: None,
                is_live: false,
                is_short: false,
                dearrow_title: None,
                dearrow_thumb: None,
            });
        }
    }
    Ok(rows)
}

/* ── feed orchestration ────────────────────────────────────── */

/// Refresh every subscribed channel's RSS with bounded concurrency, then persist.
pub async fn refresh_all(db: &Db, channel_ids: &[String]) -> AppResult<Vec<VideoRow>> {
    let mut all: Vec<VideoRow> = Vec::new();

    for chunk in channel_ids.chunks(6) {
        let mut handles = Vec::with_capacity(chunk.len());
        for id in chunk {
            let id = id.clone();
            handles.push(tokio::spawn(async move { fetch_channel_rss(&id).await }));
        }
        for h in handles {
            match h.await {
                Ok(Ok(v)) => all.extend(v),
                Ok(Err(e)) => tracing::warn!(error = %e, "rss channel failed"),
                Err(e) => tracing::warn!(error = %e, "rss task panicked"),
            }
        }
    }

    if all.is_empty() && !channel_ids.is_empty() {
        return Err(AppError::Other("No channel feed could be loaded. Check channel IDs, connectivity and retry.".into()));
    }
    all.sort_by(|a, b| b.published_at.cmp(&a.published_at));
    all.dedup_by(|a, b| a.id == b.id);
    db.upsert_videos(&all)?;
    Ok(all)
}

/// Public discovery without Google credentials. Unofficial: yt-dlp may break when
/// YouTube changes. API-key discovery remains the fallback, never sample data.
#[tauri::command]
pub async fn discover_videos(app: tauri::AppHandle, query: String, page: u32) -> AppResult<serde_json::Value> {
    use tauri_plugin_shell::ShellExt;
    let query = query.trim();
    if query.chars().count() < 2 || query.chars().count() > 100 || page >= 12 {
        return Err(AppError::Other("Search must be 2–100 characters, with at most 12 pages".into()));
    }
    let start = page * 24 + 1;
    let end = (page + 1) * 24;
    let output = app.shell().sidecar("yt-dlp")
        .map_err(|e| AppError::Extractor(e.to_string()))?
        .args(vec!["--flat-playlist".to_string(), "--dump-single-json".into(), "--skip-download".into(), "--no-warnings".into(), "--socket-timeout".into(), "15".into(), "--retries".into(), "1".into(), "--playlist-start".into(), start.to_string(), "--playlist-end".into(), end.to_string(), format!("ytsearch{end}:{query}")])
        .output().await.map_err(|e| AppError::Extractor(e.to_string()))?;
    if !output.status.success() {
        return Err(AppError::Extractor("Discovery failed. Update yt-dlp or configure a Data API key in Settings → Account.".into()));
    }
    let data: Value = serde_json::from_slice(&output.stdout).map_err(|e| AppError::Extractor(e.to_string()))?;
    let entries = data["entries"].as_array().ok_or_else(|| AppError::Extractor("Discovery returned no result list".into()))?;
    let valid_id = regex::Regex::new(r"^[A-Za-z0-9_-]{11}$").unwrap();
    let videos: Vec<Value> = entries.iter().filter_map(|v| {
        let id = v["id"].as_str()?;
        if !valid_id.is_match(id) { return None; }
        let published = v["upload_date"].as_str()
            .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y%m%d").ok())
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|d| d.and_utc().to_rfc3339()).unwrap_or_default();
        Some(serde_json::json!({
            "id": id, "title": v["title"].as_str().unwrap_or("YouTube video"),
            "channelId": v["channel_id"].as_str().unwrap_or(""),
            "channelName": v["channel"].as_str().or(v["uploader"].as_str()).unwrap_or("YouTube"),
            "thumb": format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg"),
            "publishedAt": published, "durationSec": v["duration"].as_f64().unwrap_or(0.0),
            "views": v["view_count"].as_u64(), "description": v["description"].as_str()
        }))
    }).collect();
    let next = if entries.len() == 24 && page < 11 { Some((page + 1).to_string()) } else { None };
    Ok(serde_json::json!({ "videos": videos, "nextPageToken": next }))
}
