//! Community metadata clients: SponsorBlock, DeArrow, Return YouTube Dislike.
//!
//! All three are free public APIs. Rules we follow:
//!   * SponsorBlock → hash-prefix endpoint, so the exact video id never leaves
//!     the machine unless the segment exists (privacy-preserving).
//!   * 7-day SQLite cache for votes/branding, 6-hour for segments.
//!   * Fail silent: any network error returns an empty result, never an error
//!     that blocks playback.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::db::Db;
use crate::error::AppResult;

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("LocalTube/0.1 (personal use)")
        .build()
        .expect("http")
}

/* ── SponsorBlock ──────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub category: String,
    pub start_sec: f64,
    pub end_sec: f64,
    pub action: String,
    pub uuid: String,
    pub votes: i32,
}

#[derive(Debug, Deserialize)]
struct SbGroup {
    #[serde(rename = "videoID")]
    video_id: String,
    #[serde(default)]
    segments: Vec<SbSegment>,
}

#[derive(Debug, Deserialize)]
struct SbSegment {
    category: String,
    #[serde(rename = "actionType")]
    action_type: String,
    segment: (f64, f64),
    #[serde(rename = "UUID")]
    uuid: String,
    #[serde(default)]
    votes: i32,
}

pub async fn sponsor_segments(db: &Db, video_id: &str, categories: &[String]) -> AppResult<Vec<Segment>> {
    if let Some(cached) = db.sb_get(video_id, 6 * 3600)? {
        if let Ok(segs) = serde_json::from_str::<Vec<Segment>>(&cached) {
            return Ok(segs);
        }
    }

    // privacy: send only the first 4 hex chars of sha256(videoId)
    let digest = Sha256::digest(video_id.as_bytes());
    let prefix = hex::encode(digest)[..4].to_string();

    let mut req = http().get(format!("https://sponsor.ajay.app/api/skipSegments/{prefix}"));
    for c in categories {
        req = req.query(&[("category", c)]);
    }

    let segs = match req.send().await {
        Ok(res) if res.status().is_success() => match res.json::<Vec<SbGroup>>().await {
            Ok(groups) => groups
                .into_iter()
                .find(|g| g.video_id == video_id)
                .map(|g| {
                    g.segments
                        .into_iter()
                        .map(|s| Segment {
                            category: s.category,
                            start_sec: s.segment.0,
                            end_sec: s.segment.1,
                            action: s.action_type,
                            uuid: s.uuid,
                            votes: s.votes,
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
            Err(_) => Vec::new(),
        },
        // 404 = no segments for that prefix → legit empty
        _ => Vec::new(),
    };

    if let Ok(json) = serde_json::to_string(&segs) {
        let _ = db.sb_put(video_id, &json);
    }
    Ok(segs)
}

/* ── DeArrow ───────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branding {
    pub title: Option<String>,
    pub thumb: Option<String>,
}

pub async fn dearrow_batch(db: &Db, video_ids: &[String]) -> AppResult<std::collections::HashMap<String, Branding>> {
    let mut out = std::collections::HashMap::new();
    if video_ids.is_empty() {
        return Ok(out);
    }

    for chunk in video_ids.chunks(20) {
        let key = format!("dearrow:{}", chunk.join(","));
        if let Some(cached) = db.cache_get(&key, 7 * 86400)? {
            if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, Branding>>(&cached) {
                out.extend(map);
                continue;
            }
        }

        let mut req = http().get("https://dearrow.ajay.app/api/v1/branding");
        for id in chunk {
            req = req.query(&[("videoIDs", id.as_str())]);
        }
        let Ok(res) = req.send().await else { continue };
        let Ok(json) = res.json::<Value>().await else { continue };

        if let Some(arr) = json.as_array() {
            for item in arr {
                let Some(vid) = item["videoID"].as_str() else { continue };
                let title = item["titles"]
                    .as_array()
                    .and_then(|t| t.iter().find(|x| x["locked"].as_bool() == Some(true)).or_else(|| t.first()))
                    .and_then(|t| t["title"].as_str())
                    .filter(|s| !s.is_empty())
                    .map(str::to_string);

                let thumb = item["thumbnails"]
                    .as_array()
                    .and_then(|t| t.first())
                    .and_then(|t| t["timestamp"].as_f64())
                    .map(|ts| {
                        format!(
                            "https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID={vid}&time={ts}"
                        )
                    });

                if title.is_some() || thumb.is_some() {
                    out.insert(vid.to_string(), Branding { title, thumb });
                }
            }
        }

        if let Ok(json) = serde_json::to_string(&out) {
            let _ = db.cache_put(&key, &json);
        }
    }

    Ok(out)
}

/* ── Return YouTube Dislike ────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Votes {
    pub likes: i64,
    pub dislikes: i64,
    pub views: i64,
}

pub async fn ryd_votes(db: &Db, video_id: &str) -> AppResult<Option<Votes>> {
    let key = format!("ryd:{video_id}");
    if let Some(cached) = db.cache_get(&key, 7 * 86400)? {
        if let Ok(v) = serde_json::from_str::<Votes>(&cached) {
            return Ok(Some(v));
        }
    }

    let res = http()
        .get("https://returnyoutubedislikeapi.com/votes")
        .query(&[("videoId", video_id)])
        .send()
        .await;

    let Ok(res) = res else { return Ok(None) };
    if !res.status().is_success() {
        return Ok(None);
    }
    let Ok(json) = res.json::<Value>().await else {
        return Ok(None);
    };

    let votes = Votes {
        likes: json["likes"].as_f64().unwrap_or(0.0) as i64,
        dislikes: json["dislikes"].as_f64().unwrap_or(0.0) as i64,
        views: json["viewCount"].as_f64().unwrap_or(0.0) as i64,
    };
    if let Ok(s) = serde_json::to_string(&votes) {
        let _ = db.cache_put(&key, &s);
    }
    Ok(Some(votes))
}

/* ── transcripts ───────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptLine {
    pub t: f64,
    pub text: String,
}

/// Best-effort transcript: try the timedtext endpoint with the default
/// (auto-generated) English track. Returns empty on any failure.
pub async fn transcript(db: &Db, video_id: &str) -> AppResult<Vec<TranscriptLine>> {
    let key = format!("transcript:{video_id}");
    if let Some(cached) = db.cache_get(&key, 30 * 86400)? {
        if let Ok(lines) = serde_json::from_str::<Vec<TranscriptLine>>(&cached) {
            return Ok(lines);
        }
    }

    let url = format!(
        "https://www.youtube.com/api/timedtext?lang=en&v={video_id}&kind=asr&fmt=json3"
    );
    let Ok(res) = http().get(url).send().await else {
        return Ok(vec![]);
    };
    if !res.status().is_success() {
        return Ok(vec![]);
    }
    let Ok(json) = res.json::<Value>().await else {
        return Ok(vec![]);
    };

    let mut lines = Vec::new();
    if let Some(events) = json["events"].as_array() {
        for ev in events {
            let t = ev["tStartMs"].as_f64().unwrap_or(0.0) / 1000.0;
            let text: String = ev["segs"]
                .as_array()
                .map(|segs| {
                    segs.iter()
                        .filter_map(|s| s["utf8"].as_str())
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default();
            let text = text.trim().replace('\n', " ");
            if !text.is_empty() {
                lines.push(TranscriptLine { t, text });
            }
        }
    }

    if !lines.is_empty() {
        if let Ok(s) = serde_json::to_string(&lines) {
            let _ = db.cache_put(&key, &s);
        }
    }
    Ok(lines)
}
