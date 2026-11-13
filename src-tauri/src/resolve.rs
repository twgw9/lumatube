//! MediaResolver — the most important module in the app.
//!
//! Extraction chain (first success wins):
//!   1. yt-dlp sidecar   (`-J` JSON dump: formats, urls, subtitles)
//!   2. InnerTube / youtubei.js style ANDROID client request
//!   3. public Invidious / Piped instance (`/api/v1/videos/ID`)
//!   4. give up → frontend shows the official-embed fallback
//!
//! Everything is cached in SQLite (`meta_cache`) because a resolved URL is
//! valid for ~6 hours and each fresh resolve costs a YouTube request.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::Db;
use crate::error::{AppError, AppResult};

const URL_TTL_SECS: i64 = 6 * 3600;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Quality {
    pub label: String,
    pub height: u32,
    pub url: String,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamInfo {
    pub video_url: Option<String>,
    pub audio_url: Option<String>,
    pub muxed_url: Option<String>,
    pub duration_sec: f64,
    pub source: String,
    pub qualities: Vec<Quality>,
    pub expires_at: Option<i64>,
}

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        )
        .gzip(true)
        .build()
        .expect("http client")
}

/// Human string ("1080p") → pixel height cap ("auto" → None).
pub fn height_cap(quality: &str) -> Option<u32> {
    match quality {
        "4320p" => Some(4320),
        "2160p" => Some(2160),
        "1440p" => Some(1440),
        "1080p" => Some(1080),
        "720p" => Some(720),
        "480p" => Some(480),
        "360p" => Some(360),
        _ => None,
    }
}

/// Trim a resolved stream to the requested quality (keeps the best <= cap).
pub fn apply_cap(info: &mut StreamInfo, cap: Option<u32>) {
    let Some(cap) = cap else { return };
    info.qualities.retain(|q| q.height <= cap);
    if let Some(best) = info.qualities.first() {
        info.muxed_url = Some(best.url.clone());
    }
}

/// Resolve with the full fallback chain. `prefer` = "auto" | "ytdlp" | "innertube" | "official".
pub async fn resolve(
    db: &Db,
    app: &tauri::AppHandle,
    video_id: &str,
    prefer: &str,
) -> AppResult<StreamInfo> {
    if let Some(hit) = db.cache_get(&format!("stream:muxed-v2:{video_id}"), URL_TTL_SECS)? {
        if let Ok(info) = serde_json::from_str::<StreamInfo>(&hit) {
            return Ok(info);
        }
    }

    let engines: Vec<&str> = match prefer {
        "ytdlp" => vec!["ytdlp"],
        "innertube" => vec!["innertube", "instance"],
        _ => vec!["ytdlp", "innertube", "instance"],
    };

    let mut last_err = String::from("no engine configured");
    for engine in engines {
        let attempt = match engine {
            "ytdlp" => ytdlp_resolve(app, video_id).await,
            "innertube" => innertube_resolve(video_id).await,
            _ => instance_resolve(video_id).await,
        };
        match attempt {
            Ok(info) => {
                if let Ok(json) = serde_json::to_string(&info) {
                    let _ = db.cache_put(&format!("stream:muxed-v2:{video_id}"), &json);
                }
                tracing::info!(engine, video_id, "resolved stream");
                return Ok(info);
            }
            Err(e) => {
                tracing::warn!(engine, video_id, error = %e, "engine failed");
                last_err = format!("{engine}: {e}");
            }
        }
    }

    Err(AppError::Extractor(format!(
        "saare engines fail hue ({last_err}). Settings → Downloads → Update extractor karo."
    )))
}

/* ── 1. yt-dlp sidecar ─────────────────────────────────────── */

async fn ytdlp_resolve(app: &tauri::AppHandle, video_id: &str) -> AppResult<StreamInfo> {
    use tauri_plugin_shell::ShellExt;

    let url = format!("https://www.youtube.com/watch?v={video_id}");
    // `bv*+ba/b` already means "best video + best audio, or best muxed" — which
    // is exactly what Premium does: highest resolution and fps available.
    let out = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| AppError::Extractor(format!("sidecar missing: {e}")))?
        .args([
            "-J".to_string(),
            "--no-warnings".to_string(),
            "--no-playlist".to_string(),
            "-f".to_string(),
            "bv*+ba/b".to_string(),
            "--no-check-formats".to_string(),
            url.clone(),
        ])
        .output()
        .await
        .map_err(|e| AppError::Extractor(e.to_string()))?;

    if !out.status.success() {
        return Err(AppError::Extractor(
            String::from_utf8_lossy(&out.stderr).chars().take(400).collect(),
        ));
    }

    let json: Value = serde_json::from_slice(&out.stdout)
        .map_err(|e| AppError::Extractor(format!("bad json: {e}")))?;

    let duration = json["duration"].as_f64().unwrap_or(0.0);
    let mut qualities = Vec::new();
    let mut muxed = None;
    let mut video_only = None;
    let mut audio_only = None;

    if let Some(formats) = json["formats"].as_array() {
        for f in formats {
            let url = f["url"].as_str().unwrap_or_default();
            if url.is_empty() {
                continue;
            }
            let vcodec = f["vcodec"].as_str().unwrap_or("none");
            let acodec = f["acodec"].as_str().unwrap_or("none");
            let height = f["height"].as_u64().unwrap_or(0) as u32;
            let has_video = vcodec != "none";
            let has_audio = acodec != "none";

            if has_video && has_audio && muxed.is_none() {
                muxed = Some(url.to_string());
            }
            if has_video && !has_audio && video_only.is_none() && height >= 720 {
                video_only = Some(url.to_string());
            }
            if !has_video && has_audio && audio_only.is_none() {
                audio_only = Some(url.to_string());
            }
            if has_video && has_audio && height > 0 {
                let fps = f["fps"].as_f64().unwrap_or(30.0);
                let label = if fps >= 50.0 {
                    format!("{height}p{fps:.0}")
                } else {
                    format!("{height}p")
                };
                qualities.push(Quality {
                    label,
                    height,
                    url: url.to_string(),
                    size_bytes: f["filesize"].as_u64().or(f["filesize_approx"].as_u64()),
                });
            }
        }
    }

    if muxed.is_none() && video_only.is_none() && audio_only.is_none() {
        // direct_url fallback (single-file formats)
        if let Some(u) = json["url"].as_str() {
            muxed = Some(u.to_string());
        }
    }

    if !qualities.is_empty() {
        qualities.sort_by(|a, b| b.height.cmp(&a.height).then_with(|| b.label.cmp(&a.label)));
        muxed = qualities.first().map(|q| q.url.clone());
    }
    if muxed.is_none() {
        return Err(AppError::Extractor("No combined audio/video format available. Use the official YouTube fallback.".into()));
    }
    // Combined audio/video only until adaptive audio synchronization is implemented.
    // highest resolution first, highest fps kept per resolution
    qualities.sort_by(|a, b| b.height.cmp(&a.height).then_with(|| a.label.cmp(&b.label)));
    qualities.dedup_by(|a, b| a.height == b.height);

    Ok(StreamInfo {
        video_url: video_only,
        audio_url: audio_only,
        muxed_url: muxed,
        duration_sec: duration,
        source: "ytdlp".into(),
        qualities,
        expires_at: Some(chrono::Utc::now().timestamp() + URL_TTL_SECS),
    })
}

/* ── 2. InnerTube (ANDROID client, no signing needed for /player) ── */

async fn innertube_resolve(video_id: &str) -> AppResult<StreamInfo> {
    // Public web key shipped in every youtube.com page — not a secret.
    const KEY: &str = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "ANDROID",
                "clientVersion": "19.09.37",
                "androidSdkVersion": 30,
                "hl": "en",
                "gl": "IN"
            }
        },
        "videoId": video_id,
        "contentCheckOk": true,
        "racyCheckOk": true
    });

    let res: Value = http()
        .post(format!(
            "https://www.youtube.com/youtubei/v1/player?key={KEY}&prettyPrint=false"
        ))
        .json(&body)
        .header("X-YouTube-Client-Name", "3")
        .header("X-YouTube-Client-Version", "19.09.37")
        .send()
        .await?
        .json()
        .await?;

    let status = res["playabilityStatus"]["status"].as_str().unwrap_or("ERROR");
    if status != "OK" {
        return Err(AppError::Extractor(format!(
            "playability: {}",
            res["playabilityStatus"]["reason"].as_str().unwrap_or(status)
        )));
    }

    let duration = res["videoDetails"]["lengthSeconds"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let mut qualities = Vec::new();
    let mut muxed = None;
    if let Some(formats) = res["streamingData"]["formats"].as_array() {
        for f in formats {
            let Some(url) = f["url"].as_str() else { continue }; // cipher-only formats skipped
            let mime = f["mimeType"].as_str().unwrap_or("");
            let height = f["height"].as_u64().unwrap_or(0) as u32;
            if mime.starts_with("video") && height > 0 {
                qualities.push(Quality {
                    label: format!("{height}p"),
                    height,
                    url: url.to_string(),
                    size_bytes: f["contentLength"].as_str().and_then(|s| s.parse().ok()),
                });
            }
        }
    }
    if let Some(formats) = res["streamingData"]["formats"].as_array() {
        if let Some(f) = formats.first().and_then(|f| f["url"].as_str()) {
            muxed = Some(f.to_string());
        }
    }

    // highest resolution first, highest fps kept per resolution
    qualities.sort_by(|a, b| b.height.cmp(&a.height).then_with(|| a.label.cmp(&b.label)));
    qualities.dedup_by(|a, b| a.height == b.height);

    if muxed.is_none() {
        return Err(AppError::Extractor("innertube: no playable format".into()));
    }

    // pick best video-only URL as the adaptive stream
    let video_url = qualities.first().map(|q| q.url.clone());

    Ok(StreamInfo {
        video_url,
        audio_url: None,
        muxed_url: muxed,
        duration_sec: duration,
        source: "innertube".into(),
        qualities,
        expires_at: Some(chrono::Utc::now().timestamp() + URL_TTL_SECS),
    })
}

/* ── 3. public instance fallback ───────────────────────────── */

const INSTANCES: &[&str] = &[
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
];

async fn instance_resolve(video_id: &str) -> AppResult<StreamInfo> {
    let client = http();
    for base in INSTANCES {
        let url = format!("{base}/api/v1/videos/{video_id}");
        let Ok(res) = client.get(url).send().await else {
            continue;
        };
        if !res.status().is_success() {
            continue;
        }
        let Ok(json) = res.json::<Value>().await else {
            continue;
        };

        let duration = json["lengthSeconds"].as_f64().unwrap_or(0.0);
        let mut qualities = Vec::new();
        if let Some(formats) = json["formatStreams"].as_array() {
            for f in formats {
                let Some(u) = f["url"].as_str() else { continue };
                let h = f["resolution"].as_str().unwrap_or("");
                let height = h.trim_end_matches('p').parse::<u32>().unwrap_or(0);
                if height > 0 {
                    qualities.push(Quality {
                        label: h.to_string(),
                        height,
                        url: u.to_string(),
                        size_bytes: f["size"].as_str().and_then(|s| s.parse().ok()),
                    });
                }
            }
        }
        let muxed = json["formatStreams"]
            .as_array()
            .and_then(|a| a.first())
            .and_then(|f| f["url"].as_str())
            .map(str::to_string);

        qualities.sort_by(|a, b| b.height.cmp(&a.height));
        if muxed.is_some() {
            let video_url = qualities.first().map(|q| q.url.clone());
            return Ok(StreamInfo {
                video_url,
                audio_url: None,
                muxed_url: muxed,
                duration_sec: duration,
                source: "instance".into(),
                qualities,
                expires_at: Some(chrono::Utc::now().timestamp() + URL_TTL_SECS),
            });
        }
    }
    Err(AppError::Extractor("all instances failed".into()))
}

/* ── audio-only resolve (background / audio mode) ──────────── */

pub async fn resolve_audio(db: &Db, app: &tauri::AppHandle, video_id: &str) -> AppResult<String> {
    let info = resolve(db, app, video_id, "auto").await?;
    info.audio_url
        .or(info.muxed_url)
        .ok_or_else(|| AppError::Extractor("no audio stream".into()))
}
