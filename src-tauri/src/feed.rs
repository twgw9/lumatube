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
        .user_agent("LocalTube/0.1 (+personal)")
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
    let clean = handle.trim().trim_start_matches('@');
    // oEmbed gives us the author but not the channel id; the channel page html
    // contains the canonical id. This is a single cheap request, no API key.
    let url = format!("https://www.youtube.com/@{clean}");
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

    db.upsert_videos(&all)?;
    Ok(all)
}
