//! Tauri command surface. Every function here is called from `src/lib/bridge.ts`
//! with the exact same name, so the frontend never touches Rust details.

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::{ChannelRow, Db, ProgressRow, VideoRow, WatchEventRow};
use crate::enrich;
use crate::error::{AppError, AppResult};
use crate::feed;
use crate::resolve;
use crate::vault::{self, DownloadRequest, VaultState};

pub struct AppState {
    pub db: Arc<Db>,
    pub http: reqwest::Client,
}

/* ══ playback ═══════════════════════════════════════════════ */

#[tauri::command]
pub async fn resolve_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    video_id: String,
    preferred_quality: Option<String>,
    engine: Option<String>,
) -> AppResult<resolve::StreamInfo> {
    let prefer = match engine.as_deref() {
        Some("ytdlp") => "ytdlp",
        Some("innertube") => "innertube",
        Some("official") => "official",
        _ => "auto",
    };

    let mut info = resolve::resolve(&state.db, &app, &video_id, prefer).await?;
    // "auto" = premium behaviour (keep every stream, highest first)
    let cap = resolve::height_cap(preferred_quality.as_deref().unwrap_or("auto"));
    resolve::apply_cap(&mut info, cap);
    Ok(info)
}

#[tauri::command]
pub async fn resolve_audio_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    video_id: String,
) -> AppResult<String> {
    resolve::resolve_audio(&state.db, &app, &video_id).await
}

/* ══ progress / history ═════════════════════════════════════ */

#[tauri::command]
pub async fn save_progress(state: State<'_, AppState>, progress: ProgressRow) -> AppResult<()> {
    state.db.set_progress(&progress)
}

#[tauri::command]
pub async fn get_progress(
    state: State<'_, AppState>,
    video_id: String,
) -> AppResult<Option<ProgressRow>> {
    state.db.get_progress(&video_id)
}

#[tauri::command]
pub async fn push_history(state: State<'_, AppState>, event: WatchEventRow) -> AppResult<()> {
    state.db.push_history(&event)
}

#[tauri::command]
pub async fn list_history(state: State<'_, AppState>, limit: Option<i64>) -> AppResult<Vec<WatchEventRow>> {
    state.db.history(limit.unwrap_or(200))
}

/* ══ subscriptions / feed ═══════════════════════════════════ */

#[tauri::command]
pub async fn resolve_channel(handle: String) -> AppResult<feed::ResolvedChannel> {
    feed::resolve_handle(&handle).await
}

#[tauri::command]
pub async fn add_channel(state: State<'_, AppState>, channel: ChannelRow) -> AppResult<()> {
    state.db.upsert_channel(&channel)
}

#[tauri::command]
pub async fn list_channels(state: State<'_, AppState>) -> AppResult<Vec<ChannelRow>> {
    state.db.list_channels()
}

#[tauri::command]
pub async fn refresh_feed(
    state: State<'_, AppState>,
    channel_ids: Vec<String>,
    api_key: Option<String>,
) -> AppResult<Vec<VideoRow>> {
    let videos = feed::refresh_all(&state.db, &channel_ids).await?;

    // enrich duration/views for items RSS couldn't describe (batched, 1 unit / 50)
    if let Some(key) = api_key.filter(|k| !k.is_empty()) {
        let needs: Vec<String> = videos
            .iter()
            .filter(|v| v.duration_sec == 0)
            .map(|v| v.id.clone())
            .take(100)
            .collect();
        if !needs.is_empty() {
            if let Ok(facts) = feed::enrich_videos(&key, &needs).await {
                let mut updated = videos.clone();
                for (id, dur, views) in facts {
                    if let Some(v) = updated.iter_mut().find(|v| v.id == id) {
                        v.duration_sec = dur;
                        v.views = Some(views);
                    }
                }
                let _ = state.db.upsert_videos(&updated);
                return Ok(updated);
            }
        }
    }
    Ok(videos)
}

#[tauri::command]
pub async fn get_feed(
    state: State<'_, AppState>,
    limit: Option<i64>,
    channel_ids: Option<Vec<String>>,
) -> AppResult<Vec<VideoRow>> {
    state.db.feed(limit.unwrap_or(100), channel_ids.as_deref())
}

#[tauri::command]
pub async fn search_videos(
    state: State<'_, AppState>,
    query: String,
    api_key: Option<String>,
) -> AppResult<Vec<VideoRow>> {
    // local first (free), API search only when the local result is thin
    let local = state.db.feed(50, None)?;
    let hits: Vec<VideoRow> = local
        .into_iter()
        .filter(|v| v.title.to_lowercase().contains(&query.to_lowercase()))
        .collect();

    if hits.len() >= 5 {
        return Ok(hits);
    }
    if let Some(key) = api_key.filter(|k| !k.is_empty()) {
        let remote = feed::search_youtube(&key, &query, 25).await?;
        let _ = state.db.upsert_videos(&remote);
        return Ok(remote);
    }
    Ok(hits)
}

/* ══ community metadata ═════════════════════════════════════ */

#[tauri::command]
pub async fn fetch_segments(
    state: State<'_, AppState>,
    video_id: String,
    categories: Vec<String>,
) -> AppResult<Vec<enrich::Segment>> {
    enrich::sponsor_segments(&state.db, &video_id, &categories).await
}

#[tauri::command]
pub async fn fetch_dearrow(
    state: State<'_, AppState>,
    video_ids: Vec<String>,
) -> AppResult<std::collections::HashMap<String, enrich::Branding>> {
    enrich::dearrow_batch(&state.db, &video_ids).await
}

#[tauri::command]
pub async fn fetch_votes(
    state: State<'_, AppState>,
    video_id: String,
) -> AppResult<Option<enrich::Votes>> {
    enrich::ryd_votes(&state.db, &video_id).await
}

#[tauri::command]
pub async fn fetch_transcript(
    state: State<'_, AppState>,
    video_id: String,
) -> AppResult<Vec<enrich::TranscriptLine>> {
    enrich::transcript(&state.db, &video_id).await
}

/* ══ downloads ══════════════════════════════════════════════ */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDownloadResult {
    pub job_id: String,
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    req: DownloadRequest,
) -> AppResult<StartDownloadResult> {
    let job_id = format!("dl_{}", chrono::Utc::now().timestamp_millis());
    vault::spawn_download(app, req, job_id.clone()).await?;
    Ok(StartDownloadResult { job_id })
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, Arc<VaultState>>, job_id: String) -> AppResult<()> {
    if let Ok(mut map) = state.running.lock() {
        map.remove(&job_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn reveal_in_folder(path: String) -> AppResult<()> {
    let p = std::path::Path::new(&path);
    let dir = if p.is_dir() { p } else { p.parent().unwrap_or(p) };

    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer").arg(dir).spawn();

    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(dir).spawn();

    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(dir).spawn();

    Ok(())
}

#[tauri::command]
pub async fn delete_download(path: String, to_trash: Option<bool>) -> AppResult<()> {
    if to_trash.unwrap_or(true) {
        // safer: let the OS handle it via the trash crate in a real build
        let _ = trash::delete(&path);
    } else {
        std::fs::remove_file(&path)?;
    }
    Ok(())
}

/* ══ extractor health ═══════════════════════════════════════ */

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractorStatus {
    pub version: String,
    pub updated_at: i64,
    pub available: bool,
}

#[tauri::command]
pub async fn extractor_status(app: AppHandle, state: State<'_, AppState>) -> AppResult<ExtractorStatus> {
    use tauri_plugin_shell::ShellExt;

    let version = match app.shell().sidecar("yt-dlp") {
        Ok(cmd) => match cmd.args(["--version"]).output().await {
            Ok(out) => String::from_utf8_lossy(&out.stdout).trim().to_string(),
            Err(_) => "unknown".into(),
        },
        Err(_) => "missing".into(),
    };

    let updated_at = state
        .db
        .pref_get("ytdlp_updated_at")?
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    Ok(ExtractorStatus {
        available: version != "missing",
        version,
        updated_at,
    })
}

/// Download the newest yt-dlp binary from GitHub releases and swap it in.
#[tauri::command]
pub async fn update_extractor(app: AppHandle, state: State<'_, AppState>) -> AppResult<ExtractorStatus> {
    let target = if cfg!(windows) {
        "yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "yt-dlp_macos"
    } else {
        "yt-dlp_linux"
    };

    let url = format!("https://github.com/yt-dlp/yt-dlp/releases/latest/download/{target}");
    let bytes = state.http.get(url).send().await?.bytes().await?;

    if bytes.len() < 1_000_000 {
        return Err(AppError::Extractor("download too small — GitHub rate limit?".into()));
    }

    // sidecar lives next to the executable in a Tauri bundle
    let exe = std::env::current_exe().map_err(AppError::Io)?;
    let dir = exe.parent().ok_or_else(|| AppError::Other("no exe dir".into()))?;
    let name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
    let path = dir.join(name);

    tokio::fs::write(&path, &bytes).await?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&path)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&path, perms)?;
    }

    let now = chrono::Utc::now().timestamp();
    state.db.pref_set("ytdlp_updated_at", &now.to_string())?;
    let _ = app.emit("extractor://updated", now);

    Ok(ExtractorStatus {
        version: "updated".into(),
        updated_at: now,
        available: true,
    })
}


/* ══ account (optional, guest mode is the default) ═════════ */

#[tauri::command]
pub async fn google_sign_in(state: State<'_, AppState>) -> AppResult<serde_json::Value> {
    // Real implementation: OAuth 2.0 device flow → store refresh token in the
    // OS keychain, then use the Data API with the user's own key.
    // Guest mode stays fully functional without it.
    let connected = state.db.pref_get("google_email")?.is_some();
    Ok(serde_json::json!({
        "connected": connected,
        "mode": if connected { "account" } else { "guest" },
        "note": "OAuth client id configure karo taaki ye real ho — abhi guest mode chalta hai."
    }))
}

#[tauri::command]
pub async fn google_sign_out(state: State<'_, AppState>) -> AppResult<()> {
    state.db.pref_set("google_email", "")?;
    Ok(())
}

/* ══ setup / backup ═════════════════════════════════════════ */

#[tauri::command]
pub async fn app_paths(app: AppHandle) -> AppResult<serde_json::Value> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(serde_json::json!({
        "dataDir": data,
        "dbPath": data.join("localtube.db"),
    }))
}

